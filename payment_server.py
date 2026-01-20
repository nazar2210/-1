"""
API для оплаты полной версии через СБП (ЮKassa).
Запуск: uvicorn payment_server:app --host 0.0.0.0 --port 9000
"""
from datetime import datetime
import hashlib
import hmac
import json
import sqlite3
import urllib.parse
import uuid

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from yookassa import Configuration, Payment

import config


DB_PATH = config.DATABASE_PATH
logger = logging.getLogger("payment_server")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS payments (
            payment_id TEXT PRIMARY KEY,
            user_id INTEGER,
            status TEXT,
            amount_rub TEXT,
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS premium_users (
            user_id INTEGER PRIMARY KEY,
            is_active INTEGER NOT NULL DEFAULT 0,
            activated_at TEXT,
            payment_id TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def ensure_yookassa_configured():
    if not config.YOOKASSA_SHOP_ID or not config.YOOKASSA_SECRET_KEY:
        raise HTTPException(status_code=500, detail="YOOKASSA credentials not configured")
    Configuration.account_id = config.YOOKASSA_SHOP_ID
    Configuration.secret_key = config.YOOKASSA_SECRET_KEY


def parse_and_verify_init_data(init_data: str) -> dict:
    if not config.BOT_TOKEN or config.BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        raise HTTPException(status_code=500, detail="BOT_TOKEN not configured for initData validation")

    parsed = dict(urllib.parse.parse_qsl(init_data, strict_parsing=True))
    received_hash = parsed.get("hash")
    if not received_hash:
        raise HTTPException(status_code=400, detail="Missing initData hash")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items()) if k != "hash"
    )
    secret_key = hashlib.sha256(config.BOT_TOKEN.encode("utf-8")).digest()
    calculated_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    if calculated_hash != received_hash:
        token_suffix = (config.BOT_TOKEN or "")[-4:]
        bot_id = (config.BOT_TOKEN or "").split(":", 1)[0]
        logger.warning(
            "InitData signature mismatch: bot_id=%s token_suffix=%s",
            bot_id,
            token_suffix,
        )
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    return parsed


def upsert_payment(payment_id: str, user_id: int | None, status: str, amount_rub: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """
        INSERT INTO payments (payment_id, user_id, status, amount_rub, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(payment_id) DO UPDATE SET
            user_id=excluded.user_id,
            status=excluded.status,
            amount_rub=excluded.amount_rub,
            updated_at=excluded.updated_at
        """,
        (payment_id, user_id, status, amount_rub, now, now),
    )
    conn.commit()
    conn.close()


def set_premium_active(user_id: int, payment_id: str | None = None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """
        INSERT INTO premium_users (user_id, is_active, activated_at, payment_id)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            is_active=1,
            activated_at=excluded.activated_at,
            payment_id=excluded.payment_id
        """,
        (user_id, now, payment_id),
    )
    conn.commit()
    conn.close()


def get_premium_status(user_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT is_active FROM premium_users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return bool(row and row[0])


class CreatePaymentRequest(BaseModel):
    user_id: int | None = None
    init_data: str | None = None
    plan: str = "premium"


class AdminGrantRequest(BaseModel):
    user_id: int


app = FastAPI(title="Payments API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:9000",
        "https://nazar-roan.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/api/payments/create")
def create_payment(payload: CreatePaymentRequest):
    ensure_yookassa_configured()

    user_id = payload.user_id
    if payload.init_data:
        parsed = parse_and_verify_init_data(payload.init_data)
        user_raw = parsed.get("user")
        if user_raw:
            try:
                user = json.loads(user_raw)
                user_id = user.get("id", user_id)
            except json.JSONDecodeError:
                pass

    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")

    idempotence_key = str(uuid.uuid4())
    payment = Payment.create(
        {
            "amount": {"value": config.PREMIUM_PRICE_RUB, "currency": "RUB"},
            "confirmation": {"type": "redirect", "return_url": config.PAYMENT_RETURN_URL},
            "capture": True,
            "description": "Полная версия игры «Мор. Эпоха мёртвых»",
            "metadata": {"user_id": user_id, "plan": payload.plan},
            "payment_method_data": {"type": "sbp"},
        },
        idempotence_key,
    )

    upsert_payment(payment.id, user_id, payment.status, str(payment.amount.value))

    confirmation_url = None
    if payment.confirmation:
        confirmation_url = payment.confirmation.confirmation_url

    if not confirmation_url:
        raise HTTPException(status_code=500, detail="Missing confirmation URL")

    return {"payment_id": payment.id, "confirmation_url": confirmation_url}


@app.get("/api/payments/status")
def payment_status(payment_id: str):
    ensure_yookassa_configured()
    payment = Payment.find_one(payment_id)

    user_id = None
    if payment.metadata and "user_id" in payment.metadata:
        try:
            user_id = int(payment.metadata["user_id"])
        except (TypeError, ValueError):
            user_id = None

    upsert_payment(payment.id, user_id, payment.status, str(payment.amount.value))

    if payment.status == "succeeded" and user_id:
        set_premium_active(user_id, payment.id)

    return {
        "payment_id": payment.id,
        "status": payment.status,
        "paid": payment.status == "succeeded",
    }


@app.get("/api/premium/status")
def premium_status(user_id: int):
    return {"user_id": user_id, "active": get_premium_status(user_id)}


@app.post("/api/yookassa/webhook")
async def yookassa_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event")
    payment = payload.get("object") or {}
    payment_id = payment.get("id")
    status = payment.get("status")
    metadata = payment.get("metadata") or {}

    if payment_id and status:
        user_id = metadata.get("user_id")
        try:
            user_id = int(user_id) if user_id is not None else None
        except (TypeError, ValueError):
            user_id = None

        amount = payment.get("amount", {}).get("value", config.PREMIUM_PRICE_RUB)
        upsert_payment(payment_id, user_id, status, str(amount))

        if event == "payment.succeeded" and user_id:
            set_premium_active(user_id, payment_id)

    return {"status": "ok"}


@app.post("/api/admin/grant")
def admin_grant(payload: AdminGrantRequest, request: Request):
    token = request.headers.get("X-Admin-Token", "")
    if not config.ADMIN_API_TOKEN or token != config.ADMIN_API_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    set_premium_active(payload.user_id, payment_id="admin_grant")
    return {"user_id": payload.user_id, "active": True}


@app.get("/api/debug/bot")
def debug_bot():
    bot_token = config.BOT_TOKEN or ""
    bot_id = bot_token.split(":", 1)[0] if ":" in bot_token else ""
    return {
        "bot_id": bot_id,
        "token_suffix": bot_token[-4:] if bot_token else "",
        "token_len": len(bot_token),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("payment_server:app", host="0.0.0.0", port=9000, reload=True)
