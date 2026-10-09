"""Razorpay payments through the public API: creating an order, and checking the payment when a response is submitted.

Razorpay itself is replaced by FakeRazorpay at the HTTP boundary (an httpx MockTransport), so the real service code
runs: request building, auth, signature check, and the comparison against what Razorpay says happened.
"""

import base64
import hashlib
import hmac
import json

import httpx
import pytest

from app.core.config import get_settings
from app.services import payments

KEY_ID = "rzp_test_abc123"
KEY_SECRET = "secret_for_tests"


def sign(order_id: str, payment_id: str, secret: str = KEY_SECRET) -> str:
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


class FakeRazorpay:
    """The slice of Razorpay's API the app uses: create/get order, get payment, with Basic auth."""

    def __init__(self) -> None:
        self.orders: dict[str, dict] = {}
        self.payments: dict[str, dict] = {}
        self.requests: list[httpx.Request] = []
        self.down = False
        self.fail_orders_with: int | None = None

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.down:
            raise httpx.ConnectError("Razorpay is unreachable")
        token = base64.b64encode(f"{KEY_ID}:{KEY_SECRET}".encode()).decode()
        if request.headers.get("authorization") != f"Basic {token}":
            return httpx.Response(401, json={"error": {"description": "Authentication failed"}})

        parts = request.url.path.strip("/").split("/")  # ["v1", "orders", ...]
        if request.method == "POST" and parts[1:] == ["orders"]:
            if self.fail_orders_with:
                return httpx.Response(self.fail_orders_with, json={"error": {"description": "boom"}})
            body = json.loads(request.content)
            order_id = f"order_Fake{len(self.orders) + 1:06d}"
            self.orders[order_id] = {"id": order_id, "status": "created", **body}
            return httpx.Response(200, json=self.orders[order_id])
        if request.method == "GET" and parts[1] == "orders" and parts[2] in self.orders:
            return httpx.Response(200, json=self.orders[parts[2]])
        if request.method == "GET" and parts[1] == "payments" and parts[2] in self.payments:
            return httpx.Response(200, json=self.payments[parts[2]])
        return httpx.Response(404, json={"error": {"description": "Not found"}})

    def pay(self, order_id: str, status: str = "captured", amount: int | None = None) -> dict:
        """The respondent pays an order; returns what Razorpay Checkout hands back, shaped as the form's answer."""
        order = self.orders[order_id]
        payment_id = f"pay_Fake{len(self.payments) + 1:06d}"
        self.payments[payment_id] = {
            "id": payment_id,
            "order_id": order_id,
            "status": status,
            "amount": order["amount"] if amount is None else amount,
            "currency": order["currency"],
        }
        return {
            "payment_id": payment_id,
            "order_id": order_id,
            "signature": sign(order_id, payment_id),
            "amount": order["amount"],
            "currency": order["currency"],
        }


@pytest.fixture
def razorpay(monkeypatch) -> FakeRazorpay:
    fake = FakeRazorpay()
    settings = get_settings()
    monkeypatch.setattr(settings, "razorpay_key_id", KEY_ID)
    monkeypatch.setattr(settings, "razorpay_key_secret", KEY_SECRET)
    monkeypatch.setattr(
        payments,
        "_client",
        lambda: httpx.Client(
            base_url="https://api.razorpay.test/v1", auth=(KEY_ID, KEY_SECRET), transport=httpx.MockTransport(fake.handler)
        ),
    )
    return fake


def published_form(client, make_form, add_question, *, title="Support us", **properties):
    form = make_form(title)
    q = add_question(form["id"], "payment", title="How much would you like to give?", properties=properties)
    client.post(f"/api/forms/{form['id']}/publish")
    return form, q


def order_url(form) -> str:
    return f"/api/public/forms/{form['slug']}/payments/order"


def start_order(client, form, q, amount=49_900):
    return client.post(order_url(form), json={"question_id": q["id"], "amount": amount})


def checkout(client, razorpay, form, q, amount=49_900, **pay_options) -> dict:
    order = start_order(client, form, q, amount)
    assert order.status_code == 200, order.text
    return razorpay.pay(order.json()["order_id"], **pay_options)


def submit(client, form, q, answer):
    return client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {str(q["id"]): answer}})


# ---- creating the order ------------------------------------------------------------------------------------------


def test_an_order_is_created_at_razorpay_for_the_amount_the_respondent_typed(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question, business_name="Acme", description="Thanks for your support")
    res = start_order(client, form, q, 49_900)
    assert res.status_code == 200, res.text
    assert res.json() == {
        "order_id": "order_Fake000001",
        "key_id": KEY_ID,
        "amount": 49_900,
        "currency": "INR",
        "name": "Acme",
        "description": "Thanks for your support",
    }
    sent = json.loads(razorpay.requests[0].content)
    assert sent["amount"] == 49_900 and sent["currency"] == "INR"
    # Binds the order to this question, so its payment can't be handed in for another one.
    assert sent["notes"] == {"form_id": str(form["id"]), "question_id": str(q["id"])}


def test_checkout_is_named_after_the_form_when_the_creator_gave_no_business_name(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question, title="Charity run")
    assert start_order(client, form, q).json()["name"] == "Charity run"


def test_the_key_secret_never_reaches_the_browser(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    assert KEY_SECRET not in start_order(client, form, q).text


@pytest.mark.parametrize("amount", [99, 10_000_001, 0, -500])
def test_an_amount_outside_the_creators_limits_gets_no_order(client, make_form, add_question, razorpay, amount) -> None:
    form, q = published_form(client, make_form, add_question)
    res = start_order(client, form, q, amount)
    assert res.status_code == 422
    assert "amount" in res.json()["detail"]["errors"]
    assert razorpay.requests == []


def test_the_limits_come_from_the_question(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question, min_amount=500, max_amount=1_000)
    assert start_order(client, form, q, 499).status_code == 422
    assert start_order(client, form, q, 1_001).status_code == 422
    assert start_order(client, form, q, 750).status_code == 200


def test_only_a_payment_question_of_a_published_form_can_start_an_order(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    other_form, other_q = published_form(client, make_form, add_question)
    text = add_question(form["id"], "short_text", title="Name")

    assert client.post(order_url(form), json={"question_id": other_q["id"], "amount": 500}).status_code == 404
    assert client.post(order_url(form), json={"question_id": text["id"], "amount": 500}).status_code == 404
    assert client.post(order_url(form), json={"question_id": 99_999, "amount": 500}).status_code == 404

    draft = make_form()
    draft_q = add_question(draft["id"], "payment", title="Pay")
    assert start_order(client, draft, draft_q).status_code == 404
    assert razorpay.requests == []


def test_without_razorpay_keys_the_order_says_payments_arent_set_up(client, make_form, add_question, razorpay, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "razorpay_key_secret", "")
    form, q = published_form(client, make_form, add_question)
    res = start_order(client, form, q)
    assert res.status_code == 503
    assert "set up" in res.json()["detail"]
    assert razorpay.requests == []


def test_a_razorpay_failure_is_a_gateway_error_not_a_crash(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    razorpay.fail_orders_with = 500
    assert start_order(client, form, q).status_code == 502
    razorpay.fail_orders_with = None
    razorpay.down = True
    assert start_order(client, form, q).status_code == 502


# ---- checking the payment on submit ------------------------------------------------------------------------------


def test_a_paid_response_is_accepted_and_shows_in_results(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    res = submit(client, form, q, answer)
    assert res.status_code == 201, res.text

    summary = client.get(f"/api/forms/{form['id']}/summary").json()["questions"][0]
    assert summary["type"] == "payment"
    assert summary["answered"] == 1 and summary["total_amount"] == 49_900 and summary["currency"] == "INR"
    assert summary["payments"][0]["payment_id"] == answer["payment_id"]

    csv = client.get(f"/api/forms/{form['id']}/responses/export.csv").text
    assert f"₹499.00 ({answer['payment_id']})" in csv


def test_an_authorized_payment_counts_too(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    assert submit(client, form, q, checkout(client, razorpay, form, q, status="authorized")).status_code == 201


@pytest.mark.parametrize("status", ["created", "failed", "refunded"])
def test_a_payment_that_did_not_go_through_is_rejected(client, make_form, add_question, razorpay, status) -> None:
    form, q = published_form(client, make_form, add_question)
    res = submit(client, form, q, checkout(client, razorpay, form, q, status=status))
    assert res.status_code == 422
    assert str(q["id"]) in res.json()["detail"]["errors"]


def test_a_forged_signature_is_rejected(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    answer["signature"] = sign(answer["order_id"], answer["payment_id"], secret="not_the_secret")
    res = submit(client, form, q, answer)
    assert res.status_code == 422 and str(q["id"]) in res.json()["detail"]["errors"]


def test_a_payment_id_that_razorpay_does_not_know_is_rejected(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    answer["payment_id"] = "pay_NeverHappened"
    answer["signature"] = sign(answer["order_id"], answer["payment_id"])
    assert submit(client, form, q, answer).status_code == 422


def test_claiming_a_bigger_amount_than_was_paid_is_rejected(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q, amount=100)  # really paid ₹1.00
    answer["amount"] = 49_900  # the signature doesn't cover the amount, so only Razorpay's record can catch this
    res = submit(client, form, q, answer)
    assert res.status_code == 422 and str(q["id"]) in res.json()["detail"]["errors"]


def test_a_payment_smaller_than_its_order_is_rejected(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    # The order and the answer say ₹499.00 but Razorpay's payment record says only ₹1.00 arrived.
    order = start_order(client, form, q, 49_900).json()
    answer = razorpay.pay(order["order_id"], amount=100)
    assert answer["amount"] == 49_900
    res = submit(client, form, q, answer)
    assert res.status_code == 422 and str(q["id"]) in res.json()["detail"]["errors"]


def test_a_payment_for_one_question_cant_be_handed_in_for_another(client, make_form, add_question, razorpay) -> None:
    form, first = published_form(client, make_form, add_question)
    second = add_question(form["id"], "payment", title="Tip")
    answer = checkout(client, razorpay, form, first)
    res = client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {str(first["id"]): answer, str(second["id"]): answer}})
    errors = res.json()["detail"]["errors"]
    assert res.status_code == 422 and str(second["id"]) in errors and str(first["id"]) not in errors


def test_a_payment_made_for_another_form_cant_be_handed_in(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    other_form, other_q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, other_form, other_q)
    assert submit(client, form, q, answer).status_code == 422


def test_one_payment_pays_for_one_response(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    assert submit(client, form, q, answer).status_code == 201
    again = submit(client, form, q, answer)
    assert again.status_code == 422
    assert "already" in again.json()["detail"]["errors"][str(q["id"])]


def test_a_payment_is_required_even_when_the_question_says_optional(client, make_form, add_question, razorpay) -> None:
    form = make_form()
    q = add_question(form["id"], "payment", title="Pay", required=False)
    client.post(f"/api/forms/{form['id']}/publish")
    res = client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {}})
    assert res.status_code == 422 and res.json()["detail"]["errors"][str(q["id"])] == "Please complete the payment"


def test_when_razorpay_cant_be_reached_the_respondent_can_try_again(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    razorpay.down = True
    res = submit(client, form, q, answer)
    assert res.status_code == 422 and "try again" in res.json()["detail"]["errors"][str(q["id"])]
    # Nothing was stored, and the same payment works once Razorpay is back.
    razorpay.down = False
    assert submit(client, form, q, answer).status_code == 201


def test_without_keys_a_payment_answer_cant_be_verified(client, make_form, add_question, razorpay, monkeypatch) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    monkeypatch.setattr(get_settings(), "razorpay_key_secret", "")
    res = submit(client, form, q, answer)
    assert res.status_code == 422 and "set up" in res.json()["detail"]["errors"][str(q["id"])]


def test_saving_progress_does_not_call_razorpay_but_completing_does(client, make_form, add_question, razorpay) -> None:
    form, q = published_form(client, make_form, add_question)
    answer = checkout(client, razorpay, form, q)
    calls_before = len(razorpay.requests)

    started = client.post(f"/api/public/forms/{form['slug']}/responses/start").json()
    url = f"/api/public/responses/{started['response_id']}"
    saved = client.patch(url, json={"token": started["token"], "answers": {str(q["id"]): answer}, "complete": False})
    assert saved.status_code == 200, saved.text
    assert len(razorpay.requests) == calls_before

    # The answer saved above doesn't count as "already used" against the response that holds it.
    done = client.patch(url, json={"token": started["token"], "answers": {str(q["id"]): answer}, "complete": True})
    assert done.status_code == 200, done.text
    assert len(razorpay.requests) > calls_before
    assert client.get(f"/api/forms/{form['id']}/summary").json()["questions"][0]["answered"] == 1
