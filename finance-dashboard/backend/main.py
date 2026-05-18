from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from database import delete_item, init_db, list_items, upsert_item
from plaid_client import create_plaid_client

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Personal Finance Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-initialised so missing env vars don't crash import during tests
_plaid: object = None


def plaid():
    global _plaid
    if _plaid is None:
        _plaid = create_plaid_client()
    return _plaid


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ── Plaid Link token creation ────────────────────────────────────────────────

@app.post("/api/create_link_token")
def create_link_token():
    try:
        from plaid.model.country_code import CountryCode
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.products import Products

        req = LinkTokenCreateRequest(
            products=[Products("transactions"), Products("investments")],
            client_name="Finance Dashboard",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id="local-user-001"),
        )
        resp = plaid().link_token_create(req)
        return {"link_token": resp["link_token"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Public-token exchange ────────────────────────────────────────────────────

class ExchangeBody(BaseModel):
    public_token: str
    institution_name: Optional[str] = "Unknown"


@app.post("/api/exchange_public_token")
def exchange_public_token(body: ExchangeBody):
    try:
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

        req = ItemPublicTokenExchangeRequest(public_token=body.public_token)
        resp = plaid().item_public_token_exchange(req)
        access_token: str = resp["access_token"]
        item_id: str = resp["item_id"]
        upsert_item(item_id, access_token, body.institution_name or "Unknown")
        return {"item_id": item_id, "status": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Connected items ──────────────────────────────────────────────────────────

@app.get("/api/items")
def get_items():
    return [
        {"item_id": it["item_id"], "institution_name": it["institution_name"]}
        for it in list_items()
    ]


@app.delete("/api/items/{item_id}")
def remove_item(item_id: str):
    delete_item(item_id)
    return {"status": "deleted"}


# ── Accounts & net worth ─────────────────────────────────────────────────────

def _fetch_accounts() -> list[dict]:
    accounts = []
    for item in list_items():
        try:
            from plaid.model.accounts_get_request import AccountsGetRequest

            resp = plaid().accounts_get(AccountsGetRequest(access_token=item["access_token"]))
            for acct in resp["accounts"]:
                accounts.append(
                    {
                        "item_id":            item["item_id"],
                        "institution_name":   item["institution_name"],
                        "account_id":         acct["account_id"],
                        "name":               acct["name"],
                        "official_name":      acct.get("official_name"),
                        "type":               str(acct["type"]),
                        "subtype":            str(acct.get("subtype", "")),
                        "balance_current":    acct["balances"]["current"],
                        "balance_available":  acct["balances"].get("available"),
                        "iso_currency_code":  acct["balances"].get("iso_currency_code", "USD"),
                    }
                )
        except Exception:
            continue
    return accounts


@app.get("/api/accounts")
def get_accounts():
    return {"accounts": _fetch_accounts()}


@app.get("/api/net_worth")
def get_net_worth():
    accounts = _fetch_accounts()
    asset_types = {"investment", "depository", "brokerage"}
    liability_types = {"credit", "loan"}

    assets = sum(
        (a["balance_current"] or 0) for a in accounts if a["type"] in asset_types
    )
    liabilities = sum(
        (a["balance_current"] or 0) for a in accounts if a["type"] in liability_types
    )
    return {
        "assets":        round(assets, 2),
        "liabilities":   round(liabilities, 2),
        "net_worth":     round(assets - liabilities, 2),
        "account_count": len(accounts),
    }


# ── Transactions ─────────────────────────────────────────────────────────────

@app.get("/api/transactions")
def get_transactions(days: int = 90):
    start = date.today() - timedelta(days=days)
    end   = date.today()
    txns: list[dict] = []

    for item in list_items():
        try:
            from plaid.model.transactions_get_request import TransactionsGetRequest

            resp = plaid().transactions_get(
                TransactionsGetRequest(
                    access_token=item["access_token"],
                    start_date=start,
                    end_date=end,
                )
            )
            for t in resp["transactions"]:
                txns.append(
                    {
                        "transaction_id":   t["transaction_id"],
                        "account_id":       t["account_id"],
                        "institution_name": item["institution_name"],
                        "name":             t["name"],
                        "amount":           t["amount"],
                        "date":             str(t["date"]),
                        "category":         t.get("category") or [],
                        "pending":          t["pending"],
                        "iso_currency_code": t.get("iso_currency_code", "USD"),
                    }
                )
        except Exception:
            continue

    txns.sort(key=lambda x: x["date"], reverse=True)
    return {"transactions": txns}


# ── Investment holdings ──────────────────────────────────────────────────────

@app.get("/api/investments/holdings")
def get_holdings():
    holdings: list[dict] = []

    for item in list_items():
        try:
            from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest

            resp = plaid().investments_holdings_get(
                InvestmentsHoldingsGetRequest(access_token=item["access_token"])
            )
            securities = {
                s["security_id"]: {
                    "name":        s.get("name"),
                    "ticker":      s.get("ticker_symbol"),
                    "type":        str(s.get("type", "")),
                    "close_price": s.get("close_price"),
                }
                for s in resp["securities"]
            }
            for h in resp["holdings"]:
                sec = securities.get(h["security_id"], {})
                holdings.append(
                    {
                        "account_id":         h["account_id"],
                        "institution_name":   item["institution_name"],
                        "security_id":        h["security_id"],
                        "name":               sec.get("name"),
                        "ticker":             sec.get("ticker"),
                        "type":               sec.get("type"),
                        "quantity":           h.get("quantity"),
                        "institution_price":  h.get("institution_price"),
                        "institution_value":  h.get("institution_value"),
                        "cost_basis":         h.get("cost_basis"),
                        "iso_currency_code":  h.get("iso_currency_code", "USD"),
                    }
                )
        except Exception:
            continue

    return {"holdings": holdings}


# ── Alpaca placeholder ───────────────────────────────────────────────────────

@app.get("/api/alpaca/status")
def alpaca_status():
    """Placeholder — Alpaca trade execution not yet implemented."""
    return {
        "status":  "not_implemented",
        "message": "Alpaca integration is a planned feature. Set ALPACA_API_KEY and ALPACA_SECRET_KEY in .env when ready.",
    }


# ── Serve frontend ───────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))
