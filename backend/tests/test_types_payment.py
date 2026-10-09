"""Payment question type: the creator's limits, the stored proof of payment, and how it reads in results and CSV.

The respondent types their own amount; the Razorpay round trip lives in test_payments.py.
"""

import random
from datetime import datetime

import pytest
from pydantic import ValidationError

from app.models import Question
from app.question_types import AnswerError, get_spec
from app.schemas.properties import PaymentProperties

ANSWER = {
    "payment_id": "pay_Abc123XyZ456",
    "order_id": "order_Abc123XyZ456",
    "signature": "f" * 64,
    "amount": 49_900,
    "currency": "INR",
}


def spec():
    return get_spec("payment")


def props(**changes):
    return {**spec().defaults(), **changes}


def validate(value, **changes):
    return spec().validate(value, props(**changes))


def test_defaults_are_rupees_from_one_rupee_up() -> None:
    assert spec().defaults() == {"currency": "INR", "description": "", "business_name": "", "min_amount": 100, "max_amount": 10_000_000}


def test_accepts_a_payment_and_keeps_only_known_fields() -> None:
    assert validate({**ANSWER, "extra": "dropped"}) == ANSWER


@pytest.mark.parametrize("amount", [100, 49_900, 10_000_000])
def test_accepts_amounts_within_the_limits(amount) -> None:
    assert validate({**ANSWER, "amount": amount})["amount"] == amount


@pytest.mark.parametrize(
    "value",
    [
        "pay_Abc123XyZ456",
        None,
        {},
        {**ANSWER, "payment_id": "Abc123"},
        {**ANSWER, "payment_id": "order_Abc123XyZ456"},
        {**ANSWER, "payment_id": "pay_<script>"},
        {**ANSWER, "order_id": "pay_Abc123XyZ456"},
        {**ANSWER, "order_id": 5},
        {**ANSWER, "signature": ""},
        {**ANSWER, "signature": "z" * 64},
        {**ANSWER, "amount": "499"},
        {**ANSWER, "amount": 499.5},
        {**ANSWER, "amount": True},
        {**ANSWER, "amount": 99},
        {**ANSWER, "amount": 10_000_001},
        {**ANSWER, "currency": "USD"},
    ],
)
def test_rejects_anything_that_is_not_a_payment_within_the_limits(value) -> None:
    with pytest.raises(AnswerError):
        validate(value)


def test_limits_come_from_the_question() -> None:
    assert validate({**ANSWER, "amount": 500}, min_amount=500, max_amount=500)["amount"] == 500
    with pytest.raises(AnswerError, match="₹5.00"):
        validate({**ANSWER, "amount": 499}, min_amount=500, max_amount=1_000)
    with pytest.raises(AnswerError, match="₹10.00"):
        validate({**ANSWER, "amount": 1_001}, min_amount=500, max_amount=1_000)


def test_currency_must_match_the_question() -> None:
    assert validate({**ANSWER, "currency": "USD"}, currency="USD")["currency"] == "USD"
    with pytest.raises(AnswerError):
        validate(ANSWER, currency="USD")


def test_a_payment_is_always_required() -> None:
    assert spec().always_required is True
    assert spec().required_message == "Please complete the payment"


def test_format_is_the_amount_and_the_payment_id() -> None:
    assert spec().format(ANSWER, props()) == "₹499.00 (pay_Abc123XyZ456)"
    assert spec().format({**ANSWER, "amount": 150_000_00, "currency": "USD"}, props()) == "$150,000.00 (pay_Abc123XyZ456)"
    assert spec().format({**ANSWER, "amount": 5, "currency": "EUR"}, props()) == "€0.05 (pay_Abc123XyZ456)"


def test_no_branching_on_payments() -> None:
    assert spec().logic_ops == frozenset()


def test_sample_answer_is_valid_for_its_question() -> None:
    sample = spec().sample(props(min_amount=500, max_amount=2_000), random.Random(1))
    assert validate(sample, min_amount=500, max_amount=2_000) == sample


def test_summary_totals_what_was_collected() -> None:
    question = Question(id=7, form_id=1, type="payment", title="Donate", position=0, properties=props())
    older, newer = datetime(2026, 1, 1), datetime(2026, 1, 2)
    summary = spec().summarize(question, [ANSWER, {**ANSWER, "payment_id": "pay_Second00000001", "amount": 10_000}], [newer, older])
    assert summary.type == "payment"
    assert summary.answered == 2
    assert summary.currency == "INR"
    assert summary.total_amount == 59_900
    assert [p.payment_id for p in summary.payments] == ["pay_Abc123XyZ456", "pay_Second00000001"]
    assert summary.payments[0].submitted_at == newer


# ---- the creator's settings --------------------------------------------------------------------------------------


def test_creator_settings_are_checked() -> None:
    assert PaymentProperties(currency="USD", suggested_amount=2_500).currency == "USD"
    with pytest.raises(ValidationError):
        PaymentProperties(currency="JPY")
    with pytest.raises(ValidationError):
        PaymentProperties(min_amount=99)
    with pytest.raises(ValidationError):
        PaymentProperties(max_amount=50_000_001)
    with pytest.raises(ValidationError, match="minimum"):
        PaymentProperties(min_amount=1_000, max_amount=500)
    with pytest.raises(ValidationError, match="suggested"):
        PaymentProperties(min_amount=1_000, max_amount=5_000, suggested_amount=999)
    with pytest.raises(ValidationError):
        PaymentProperties(description="x" * 256)
