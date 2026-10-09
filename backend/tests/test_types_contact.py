"""Website and phone number question types."""

import pytest
from pydantic import ValidationError

from app.question_types import AnswerError, get_spec
from app.schemas.properties import PhoneProperties

# Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
WEB_ERROR = "Hmm… that web address doesn’t look right. Check for any typos or errors."
PHONE_ERROR = "Hmm... that phone number doesn't look right"


def validate(qtype: str, value, **props):
    spec = get_spec(qtype)
    return spec.validate(value, {**spec.defaults(), **props})


# ---- website ---------------------------------------------------------------


def test_website_accepts_a_bare_domain() -> None:
    assert validate("website", "  example.com ") == "example.com"


@pytest.mark.parametrize("url", ["https://example.com/path?x=1#frag", "http://sub.example.co.uk", "www.example.com/a b".replace(" ", "%20")])
def test_website_accepts_full_urls(url: str) -> None:
    assert validate("website", url) == url


@pytest.mark.parametrize("url", ["javascript:alert(1)", "ftp://example.com", "data:text/html,x", "mailto:a@b.c", "//example.com"])
def test_website_rejects_other_schemes(url: str) -> None:
    with pytest.raises(AnswerError, match="web address"):
        validate("website", url)


@pytest.mark.parametrize("text", ["hello", "exa mple.com", "http://localhost", "example.", ".com", "https://", "http://a b.com"])
def test_website_rejects_text_that_is_not_an_address(text: str) -> None:
    with pytest.raises(AnswerError) as error:
        validate("website", text)
    assert str(error.value) == WEB_ERROR


def test_website_rejects_non_text_and_very_long_text() -> None:
    for value in (5, True, ["example.com"], "https://example.com/" + "a" * 2000):
        with pytest.raises(AnswerError):
            validate("website", value)


# ---- phone number ----------------------------------------------------------


def test_phone_normalizes_a_national_number_with_the_default_country() -> None:
    assert validate("phone_number", "(201) 555-0123") == "+12015550123"


def test_phone_uses_the_questions_default_country() -> None:
    assert validate("phone_number", "020 7946 0958", default_country="GB") == "+442079460958"


def test_phone_accepts_international_format_whatever_the_default() -> None:
    assert validate("phone_number", "+44 20 7946 0958") == "+442079460958"
    assert validate("phone_number", "+44 20 7946 0958", default_country="IN") == "+442079460958"


@pytest.mark.parametrize("text", ["123", "abc", "+1 555", "(201) 555-01", "++44 20"])
def test_phone_rejects_short_or_nonsense_numbers(text: str) -> None:
    with pytest.raises(AnswerError) as error:
        validate("phone_number", text)
    assert str(error.value) == PHONE_ERROR


def test_phone_rejects_non_text() -> None:
    for value in (2015550123, True, ["+12015550123"]):
        with pytest.raises(AnswerError):
            validate("phone_number", value)


def test_phone_default_country_must_be_a_real_region() -> None:
    assert PhoneProperties(default_country="gb").default_country == "GB"
    for bad in ("ZZ", "USA", "", "1"):
        with pytest.raises(ValidationError):
            PhoneProperties(default_country=bad)


def test_phone_is_shown_in_international_format() -> None:
    spec = get_spec("phone_number")
    assert spec.format("+442079460958", spec.defaults()) == "+44 20 7946 0958"
    # A number from before a rule changed still shows as stored rather than failing.
    assert spec.format("not a number", spec.defaults()) == "not a number"


def test_website_is_shown_as_typed() -> None:
    spec = get_spec("website")
    assert spec.format("example.com", spec.defaults()) == "example.com"


def test_new_types_branch_like_text() -> None:
    website = get_spec("website")
    assert website.logic_match("contains", "example", "https://www.example.com", {}) is True
    assert get_spec("phone_number").logic_match("is", "+12015550123", "+12015550123", {}) is True


# ---- through the API -------------------------------------------------------


def test_new_questions_get_their_defaults(make_form, add_question) -> None:
    form = make_form()
    assert add_question(form["id"], "website")["properties"] == {}
    assert add_question(form["id"], "phone_number")["properties"] == {"default_country": "US"}


def test_phone_properties_are_validated_through_the_api(client, make_form, add_question) -> None:
    question = add_question(make_form()["id"], "phone_number")
    res = client.patch(f"/api/questions/{question['id']}", json={"properties": {"default_country": "ZZ"}})
    assert res.status_code == 422
    assert "properties.default_country" in res.json()["detail"]["errors"]


def _published_form_with(client, make_form, add_question):
    form = make_form()
    website = add_question(form["id"], "website", title="Site?")
    phone = add_question(form["id"], "phone_number", title="Phone?")
    published = client.post(f"/api/forms/{form['id']}/publish").json()
    return published, website, phone


def test_a_submission_stores_the_normalized_phone_and_the_website(client, make_form, add_question) -> None:
    form, website, phone = _published_form_with(client, make_form, add_question)
    res = client.post(
        f"/api/public/forms/{form['slug']}/responses",
        json={"answers": {str(website["id"]): " example.com ", str(phone["id"]): "(201) 555-0123"}},
    )
    assert res.status_code == 201, res.text
    items = client.get(f"/api/forms/{form['id']}/responses").json()["items"]
    assert items[0]["answers"] == {str(website["id"]): "example.com", str(phone["id"]): "+12015550123"}


def test_a_bad_phone_is_rejected_with_the_message_on_that_question(client, make_form, add_question) -> None:
    form, _website, phone = _published_form_with(client, make_form, add_question)
    res = client.post(
        f"/api/public/forms/{form['slug']}/responses", json={"answers": {str(phone["id"]): "123"}}
    )
    assert res.status_code == 422
    assert res.json()["detail"]["errors"] == {str(phone["id"]): PHONE_ERROR}


def test_the_summary_lists_website_and_phone_answers(client, make_form, add_question) -> None:
    form, website, phone = _published_form_with(client, make_form, add_question)
    client.post(
        f"/api/public/forms/{form['slug']}/responses",
        json={"answers": {str(website["id"]): "example.com", str(phone["id"]): "(201) 555-0123"}},
    )
    summary = client.get(f"/api/forms/{form['id']}/summary").json()
    by_type = {q["type"]: q for q in summary["questions"]}
    assert [a["value"] for a in by_type["website"]["answers"]] == ["example.com"]
    assert [a["value"] for a in by_type["phone_number"]["answers"]] == ["+12015550123"]
