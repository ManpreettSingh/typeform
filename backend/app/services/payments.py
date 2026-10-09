"""Razorpay payments: opening an order for a payment question, and checking a payment when its response is submitted.

The browser is never trusted. The amount of an order is checked against the question's limits here, and a submitted
payment only counts once Razorpay itself says it was paid, for that amount, on an order made for that very question.
Razorpay is called over its REST API with the key id and secret as Basic auth (no SDK).
"""

import hashlib
import hmac
import logging
import secrets
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import lock_for_write
from app.core.errors import BadGatewayError, FieldValidationError, ServiceUnavailableError
from app.models import Answer, Form, Question, QuestionType, Response, ResponseStatus
from app.question_types.payment import format_money
from app.schemas.public import PaymentOrderOut

logger = logging.getLogger(__name__)

NOT_SET_UP = "Payments aren't set up yet"
NOT_CONFIRMED = "We couldn't confirm this payment. Please complete the payment again."
TRY_AGAIN = "We couldn't confirm your payment right now. Please try again in a moment."
ALREADY_USED = "This payment was already used for another response"

# Razorpay payment states that mean the money is on its way: "captured" (taken) or "authorized" (held, captured by
# the account's auto-capture setting). Anything else ("created", "failed", "refunded") is not a payment.
_PAID = {"authorized", "captured"}
_TIMEOUT = httpx.Timeout(10.0)


def _client() -> httpx.Client:
    settings = get_settings()
    return httpx.Client(
        base_url=settings.razorpay_api_base,
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
        timeout=_TIMEOUT,
    )


def _is_set_up() -> bool:
    settings = get_settings()
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


class _Rejected(Exception):
    """Razorpay says no such thing (a 4xx): the payment can't be confirmed."""


def _get(client: httpx.Client, path: str) -> dict[str, Any]:
    """GET one Razorpay entity. A 4xx means it doesn't exist (_Rejected); an outage or 5xx raises httpx.HTTPError."""
    res = client.get(path)
    if 400 <= res.status_code < 500:
        logger.warning("Razorpay refused GET %s: %s", path, res.status_code)
        if res.status_code in (401, 403):
            # Wrong keys are our problem, not the respondent's: ask them to retry rather than call the payment fake.
            raise httpx.HTTPError(f"Razorpay rejected our keys ({res.status_code})")
        raise _Rejected
    res.raise_for_status()
    return res.json()


def create_order(form: Form, question: Question, amount: int) -> PaymentOrderOut:
    """Opens a Razorpay order for `amount` (minor units) on a payment question, bound to it through the order's notes."""
    props = question.properties
    if not props["min_amount"] <= amount <= props["max_amount"]:
        low, high = format_money(props["min_amount"], props["currency"]), format_money(props["max_amount"], props["currency"])
        raise FieldValidationError({"amount": f"Please enter an amount between {low} and {high}"})
    if not _is_set_up():
        raise ServiceUnavailableError(NOT_SET_UP)

    body = {
        "amount": amount,
        "currency": props["currency"],
        "receipt": f"q{question.id}-{secrets.token_hex(6)}",
        "notes": {"form_id": str(form.id), "question_id": str(question.id)},
    }
    try:
        with _client() as client:
            res = client.post("orders", json=body)
            res.raise_for_status()
            order_id = res.json()["id"]
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        logger.warning("Razorpay order failed: %s", exc)
        raise BadGatewayError("We couldn't start the payment. Please try again.") from exc

    return PaymentOrderOut(
        order_id=order_id,
        key_id=get_settings().razorpay_key_id,
        amount=amount,
        currency=props["currency"],
        name=props["business_name"] or form.title,
        description=props["description"],
    )


def _signature_matches(answer: dict[str, Any]) -> bool:
    secret = get_settings().razorpay_key_secret.encode()
    expected = hmac.new(secret, f"{answer['order_id']}|{answer['payment_id']}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, answer["signature"])


def _notes_match(order: dict[str, Any], form: Form, question: Question) -> bool:
    notes = order.get("notes")
    # Razorpay renders "no notes" as an empty list.
    return isinstance(notes, dict) and notes.get("form_id") == str(form.id) and notes.get("question_id") == str(question.id)


def _confirm(form: Form, question: Question, answer: dict[str, Any]) -> str | None:
    """None when Razorpay confirms this payment; otherwise what to tell the respondent."""
    if not _is_set_up():
        return NOT_SET_UP
    if not _signature_matches(answer):
        return NOT_CONFIRMED
    try:
        with _client() as client:
            payment = _get(client, f"payments/{answer['payment_id']}")
            order = _get(client, f"orders/{answer['order_id']}")
    except _Rejected:
        return NOT_CONFIRMED
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Razorpay could not confirm %s: %s", answer["payment_id"], exc)
        return TRY_AGAIN

    paid = (
        payment.get("status") in _PAID
        and payment.get("order_id") == answer["order_id"]
        and payment.get("amount") == answer["amount"]
        and payment.get("currency") == answer["currency"]
        and order.get("amount") == answer["amount"]
        and order.get("currency") == answer["currency"]
        and _notes_match(order, form, question)
    )
    return None if paid else NOT_CONFIRMED


def _already_used(db: Session, payment_id: str, response_id: int | None) -> bool:
    """Whether a completed response (other than `response_id`) already holds this payment."""
    stmt = (
        select(func.count())
        .select_from(Answer)
        .join(Response, Answer.response_id == Response.id)
        .where(
            Response.status == ResponseStatus.COMPLETED,
            func.json_extract(Answer.value, "$.payment_id") == payment_id,
        )
    )
    if response_id is not None:
        stmt = stmt.where(Answer.response_id != response_id)
    return bool(db.scalar(stmt))


def verify_submission(db: Session, form: Form, cleaned: dict[int, Any], response_id: int | None = None) -> None:
    """Checks every payment answer of a response that is about to be completed.

    Raises FieldValidationError keyed by question id for each payment that doesn't hold up. `response_id` is the
    response being completed, whose own earlier-saved answers don't count as "already used".
    On success the database write lock is held until the caller commits, so two submissions can't both claim one payment.
    """
    to_check = [(q, cleaned[q.id]) for q in form.questions if q.type == QuestionType.PAYMENT and q.id in cleaned]
    if not to_check:
        return

    # Ask Razorpay first and without the lock: a slow answer must not stall every other write.
    errors = {str(q.id): message for q, answer in to_check if (message := _confirm(form, q, answer))}
    if errors:
        raise FieldValidationError(errors)

    lock_for_write(db)
    errors = {str(q.id): ALREADY_USED for q, answer in to_check if _already_used(db, answer["payment_id"], response_id)}
    if errors:
        raise FieldValidationError(errors)
