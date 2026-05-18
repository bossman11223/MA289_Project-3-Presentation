// ── Helpers ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function fmt(amount, currency = "USD") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtNum(n, decimals = 4) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: decimals });
}

let _toastTimer = null;
function toast(msg, duration = 3000) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

// ── Charts ───────────────────────────────────────────────────────────────────

let chartNW = null;
let chartAlloc = null;

const PALETTE = [
  "#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#10b981","#f97316","#6366f1",
];

function destroyChart(ref) { if (ref) ref.destroy(); }

function renderNetWorthChart(assets, liabilities) {
  destroyChart(chartNW);
  const ctx = $("chart-networth");
  chartNW = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Assets", "Liabilities"],
      datasets: [{
        data: [assets, liabilities],
        backgroundColor: ["#22c55e", "#ef4444"],
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderAllocationChart(holdings) {
  destroyChart(chartAlloc);
  const ctx = $("chart-allocation");
  if (!holdings.length) {
    chartAlloc = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["No holdings data"],
        datasets: [{ data: [1], backgroundColor: ["#e2e8f0"], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "65%",
        plugins: { legend: { display: false } },
      },
    });
    return;
  }

  // Group by security type, then by ticker for the rest
  const byTicker = {};
  for (const h of holdings) {
    const key = h.ticker || h.name || "Unknown";
    byTicker[key] = (byTicker[key] || 0) + (h.institution_value || 0);
  }
  const sorted = Object.entries(byTicker)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // top 10

  chartAlloc = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: PALETTE,
        borderWidth: 2,
        borderColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

// ── Accounts ─────────────────────────────────────────────────────────────────

function renderAccounts(accounts) {
  const grid = $("accounts-grid");
  if (!accounts.length) {
    grid.innerHTML = '<p style="color:#718096">No accounts found.</p>';
    return;
  }
  grid.innerHTML = accounts.map((a) => {
    const bal = a.balance_current;
    const neg = bal != null && bal < 0;
    return `
      <div class="account-card">
        <div class="acct-institution">${a.institution_name}</div>
        <div class="acct-name">${a.name}</div>
        <div class="acct-subtype">${a.subtype || a.type}</div>
        <div class="acct-balance ${neg ? "negative" : ""}">${fmt(bal, a.iso_currency_code)}</div>
      </div>`;
  }).join("");
}

// ── Transactions ──────────────────────────────────────────────────────────────

function renderTransactions(txns) {
  const tbody = $("txn-tbody");
  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#718096">No transactions found.</td></tr>';
    return;
  }
  tbody.innerHTML = txns.slice(0, 200).map((t) => {
    const isNeg = t.amount > 0; // Plaid: positive = debit
    const amtClass = isNeg ? "amount-negative" : "amount-positive";
    const sign = isNeg ? "-" : "+";
    const cat = (t.category || []).slice(-1)[0] || "—";
    const status = t.pending
      ? '<span class="badge badge-pending">Pending</span>'
      : '<span class="badge badge-posted">Posted</span>';
    return `
      <tr>
        <td>${t.date}</td>
        <td>${t.name}</td>
        <td>${t.institution_name}</td>
        <td>${cat}</td>
        <td>${status}</td>
        <td style="text-align:right" class="${amtClass}">${sign}${fmt(Math.abs(t.amount), t.iso_currency_code)}</td>
      </tr>`;
  }).join("");
}

// ── Holdings ─────────────────────────────────────────────────────────────────

function renderHoldings(holdings) {
  const tbody = $("holdings-tbody");
  if (!holdings.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:#718096">No investment holdings found.</td></tr>';
    return;
  }
  tbody.innerHTML = holdings.map((h) => {
    const gainLoss = h.institution_value != null && h.cost_basis != null
      ? h.institution_value - h.cost_basis : null;
    const glClass = gainLoss == null ? "" : gainLoss >= 0 ? "amount-positive" : "amount-negative";
    const glStr = gainLoss == null ? "—" : `${gainLoss >= 0 ? "+" : ""}${fmt(gainLoss, h.iso_currency_code)}`;
    return `
      <tr>
        <td><strong>${h.ticker || "—"}</strong></td>
        <td>${h.name || "—"}</td>
        <td>${h.type || "—"}</td>
        <td>${h.institution_name}</td>
        <td style="text-align:right">${fmtNum(h.quantity)}</td>
        <td style="text-align:right">${fmt(h.institution_price, h.iso_currency_code)}</td>
        <td style="text-align:right"><strong>${fmt(h.institution_value, h.iso_currency_code)}</strong></td>
        <td style="text-align:right">${fmt(h.cost_basis, h.iso_currency_code)}</td>
        <td style="text-align:right" class="${glClass}">${glStr}</td>
      </tr>`;
  }).join("");
}

// ── Items list ────────────────────────────────────────────────────────────────

function renderItems(items) {
  const el = $("items-list");
  if (!items.length) { el.innerHTML = "<p>None</p>"; return; }
  el.innerHTML = `
    <table style="width:100%">
      <thead>
        <tr>
          <th>Institution</th>
          <th>Item ID</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it) => `
          <tr>
            <td><strong>${it.institution_name}</strong></td>
            <td style="color:#718096;font-size:12px">${it.item_id}</td>
            <td style="text-align:right">
              <button class="btn btn-danger" onclick="disconnectItem('${it.item_id}')">Disconnect</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

// ── Plaid Link ────────────────────────────────────────────────────────────────

async function openPlaidLink() {
  const btn = $("btn-connect");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Initializing…';
  try {
    const resp = await fetch("/api/create_link_token", { method: "POST" });
    if (!resp.ok) throw new Error(await resp.text());
    const { link_token } = await resp.json();

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (publicToken, metadata) => {
        toast("Connecting account…");
        const institution = metadata.institution?.name || "Unknown";
        const ex = await fetch("/api/exchange_public_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken, institution_name: institution }),
        });
        if (!ex.ok) {
          toast("Error connecting account: " + (await ex.text()));
          return;
        }
        toast(`${institution} connected!`);
        await loadDashboard();
      },
      onExit: (err) => {
        if (err) toast("Plaid Link error: " + err.display_message);
      },
    });

    handler.open();
  } catch (err) {
    toast("Failed to open Plaid Link: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = "+ Connect Account";
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function showTab(name) {
  ["transactions", "holdings"].forEach((t) => {
    $(`tab-${t}`).style.display = t === name ? "" : "none";
  });
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.textContent.toLowerCase().includes(name === "transactions" ? "trans" : "hold"));
  });
}

// ── Disconnect item ───────────────────────────────────────────────────────────

async function disconnectItem(itemId) {
  if (!confirm("Disconnect this institution? You can always re-link it.")) return;
  await fetch(`/api/items/${itemId}`, { method: "DELETE" });
  toast("Institution disconnected.");
  await loadDashboard();
}

// ── Main load ─────────────────────────────────────────────────────────────────

async function loadDashboard() {
  const itemsResp = await fetch("/api/items").catch(() => null);
  if (!itemsResp || !itemsResp.ok) {
    toast("Could not reach backend. Is the server running?");
    return;
  }
  const items = await itemsResp.json();

  if (!items.length) {
    $("empty-state").style.display = "";
    $("dashboard").style.display = "none";
    $("btn-refresh").style.display = "none";
    return;
  }

  $("empty-state").style.display = "none";
  $("dashboard").style.display = "";
  $("btn-refresh").style.display = "";
  $("connected-items").textContent = `(${items.map((i) => i.institution_name).join(", ")})`;

  renderItems(items);

  // Parallel data fetch
  const [nwData, acctData, txnData, holdData] = await Promise.all([
    fetch("/api/net_worth").then((r) => r.json()).catch(() => ({})),
    fetch("/api/accounts").then((r) => r.json()).catch(() => ({ accounts: [] })),
    fetch("/api/transactions?days=90").then((r) => r.json()).catch(() => ({ transactions: [] })),
    fetch("/api/investments/holdings").then((r) => r.json()).catch(() => ({ holdings: [] })),
  ]);

  // Summary stats
  $("stat-net-worth").textContent  = fmt(nwData.net_worth);
  $("stat-assets").textContent     = fmt(nwData.assets);
  $("stat-liabilities").textContent = fmt(nwData.liabilities);
  $("stat-accounts").textContent   = nwData.account_count ?? "—";

  // Charts
  renderNetWorthChart(nwData.assets || 0, nwData.liabilities || 0);
  renderAllocationChart(holdData.holdings || []);

  // Tables
  renderAccounts(acctData.accounts || []);
  renderTransactions(txnData.transactions || []);
  renderHoldings(holdData.holdings || []);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", loadDashboard);
