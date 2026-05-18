import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "finance.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS items (
                item_id          TEXT PRIMARY KEY,
                access_token     TEXT NOT NULL,
                institution_name TEXT NOT NULL DEFAULT 'Unknown',
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


def upsert_item(item_id: str, access_token: str, institution_name: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO items (item_id, access_token, institution_name)
            VALUES (?, ?, ?)
            ON CONFLICT(item_id) DO UPDATE SET
                access_token     = excluded.access_token,
                institution_name = excluded.institution_name
            """,
            (item_id, access_token, institution_name),
        )
        conn.commit()


def list_items() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT item_id, access_token, institution_name, created_at FROM items ORDER BY created_at"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_item(item_id: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM items WHERE item_id = ?", (item_id,))
        conn.commit()
