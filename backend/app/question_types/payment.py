"""Payment: the respondent types an amount and pays it through Razorpay Checkout. The answer is the proof of payment:
{"payment_id", "order_id", "signature", "amount", "currency"} (amount in minor units, 49900 = ₹499.00).

Here a stored answer is only checked for shape and the question's limits. Whether the money really arrived is checked
against Razorpay when the response is submitted (services/payments.py).
"""

import random
import re
import string
from datetime import datetime
from typing import Any

from app.models import Question, QuestionType
from app.question_types.base import AnswerError, Properties, QuestionTypeSpec
from app.schemas.properties import PaymentProperties
from app.schemas.response import PaymentRecord, PaymentSummary

PAYMENT_ERROR = "Please complete the payment"
SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}

_PAYMENT_ID = re.compile(r"^pay_[A-Za-z0-9]{6,40}$")
_ORDER_ID = re.compile(r"^order_[A-Za-z0-9]{6,40}$")
_SIGNATURE = re.compile(r"^[0-9a-f]{64}$")
_SAMPLE_AMOUNTS = [19_900, 49_900, 99_900, 250_000]


def format_money(amount: int, currency: str) -> str:
    """49900 + INR → "₹499.00". Every supported currency has two decimals."""
    return f"{SYMBOLS.get(currency, currency + ' ')}{amount / 100:,.2f}"


def _is_whole(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _validate(value: Any, props: Properties) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AnswerError(PAYMENT_ERROR)
    payment_id, order_id = value.get("payment_id"), value.get("order_id")
    signature, amount, currency = value.get("signature"), value.get("amount"), value.get("currency")
    if not isinstance(payment_id, str) or not _PAYMENT_ID.match(payment_id):
        raise AnswerError(PAYMENT_ERROR)
    if not isinstance(order_id, str) or not _ORDER_ID.match(order_id):
        raise AnswerError(PAYMENT_ERROR)
    if not isinstance(signature, str) or not _SIGNATURE.match(signature):
        raise AnswerError(PAYMENT_ERROR)
    if not _is_whole(amount) or currency != props["currency"]:
        raise AnswerError(PAYMENT_ERROR)
    if amount < props["min_amount"]:
        raise AnswerError(f"The amount must be at least {format_money(props['min_amount'], currency)}")
    if amount > props["max_amount"]:
        raise AnswerError(f"The amount can't be more than {format_money(props['max_amount'], currency)}")
    return {"payment_id": payment_id, "order_id": order_id, "signature": signature, "amount": amount, "currency": currency}


def _format(value: Any, _props: Properties) -> str:
    if isinstance(value, dict) and _is_whole(value.get("amount")):
        return f"{format_money(value['amount'], str(value.get('currency')))} ({value.get('payment_id')})"
    return str(value)


def _summarize(question: Question, values: list[Any], times: list[datetime]) -> PaymentSummary:
    currency = question.properties.get("currency", "INR")
    payments = [
        PaymentRecord(payment_id=str(v["payment_id"]), amount=int(v["amount"]), currency=str(v.get("currency", currency)), submitted_at=t)
        for v, t in zip(values, times, strict=True)
        if isinstance(v, dict) and v.get("payment_id") and _is_whole(v.get("amount"))
    ]
    total = sum(p.amount for p in payments if p.currency == currency)
    return PaymentSummary(
        question_id=question.id,
        type=QuestionType.PAYMENT,
        title=question.title,
        answered=len(payments),
        currency=currency,
        total_amount=total,
        payments=payments,
    )


def _sample(props: Properties, rng: random.Random) -> dict[str, Any]:
    low, high = props["min_amount"], props["max_amount"]
    amount = min(max(rng.choice(_SAMPLE_AMOUNTS), low), high)

    def token() -> str:
        return "".join(rng.choices(string.ascii_letters + string.digits, k=14))

    return {
        "payment_id": f"pay_{token()}",
        "order_id": f"order_{token()}",
        "signature": f"{rng.getrandbits(256):064x}",
        "amount": amount,
        "currency": props["currency"],
    }


SPECS = [
    QuestionTypeSpec(
        key=QuestionType.PAYMENT,
        properties_model=PaymentProperties,
        answerable=True,
        defaults=lambda: PaymentProperties().model_dump(exclude_none=True),
        validate=_validate,
        format=_format,
        summarize=_summarize,
        sample=_sample,
        required_message=PAYMENT_ERROR,
        always_required=True,
    )
]
