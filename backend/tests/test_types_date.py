"""The date question type."""

import pytest
from pydantic import ValidationError

from app.question_types import AnswerError, get_spec
from app.schemas.properties import DateProperties

# Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
INVALID = "That date doesn't look valid—it's incomplete or doesn't exist"
REVERSED = "That date isn't valid. Check the month and day aren't reversed."


def validate(value, **props):
    spec = get_spec("date")
    return spec.validate(value, {**spec.defaults(), **props})


def message(value, **props) -> str:
    with pytest.raises(AnswerError) as error:
        validate(value, **props)
    return str(error.value)


def test_a_leap_day_is_accepted_and_the_value_is_normalised() -> None:
    assert validate("2028-02-29") == "2028-02-29"
    assert validate("2026-1-5") == "2026-01-05"
    assert validate(" 2026-01-05 ") == "2026-01-05"


@pytest.mark.parametrize("value", ["2026-02-30", "2027-02-29", "2026-04-31", "0000-01-01", "2026-00-10", "2026-10-00"])
def test_a_date_that_does_not_exist_is_rejected(value: str) -> None:
    assert message(value) == INVALID


@pytest.mark.parametrize("value", ["2026-", "2026-05-", "20-5-7", "abc", "", "2026/05/07", 20260507, True, ["2026-05-07"]])
def test_incomplete_or_malformed_values_are_rejected(value) -> None:
    assert message(value) == INVALID


def test_a_swapped_day_and_month_gets_the_reversed_message() -> None:
    assert message("2026-13-01") == REVERSED
    assert message("2026-25-12") == REVERSED
    # Not a swap: 13 is no day of any month.
    assert message("2026-13-13") == INVALID


def test_a_date_before_the_start_uses_the_on_or_after_message() -> None:
    assert message("2026-01-14", start_date="2026-01-15") == "Choose a date on or after 01/15/2026."
    assert validate("2026-01-15", start_date="2026-01-15") == "2026-01-15"


def test_a_date_after_the_end_uses_the_on_or_before_message() -> None:
    assert message("2027-01-01", end_date="2026-12-31") == "Choose a date on or before 12/31/2026."
    assert validate("2026-12-31", end_date="2026-12-31") == "2026-12-31"


def test_both_limits_use_the_between_message() -> None:
    limits = {"start_date": "2026-01-15", "end_date": "2026-12-31"}
    assert message("2025-12-31", **limits) == "Choose a date between 01/15/2026 and 12/31/2026."
    assert message("2027-01-01", **limits) == "Choose a date between 01/15/2026 and 12/31/2026."
    assert validate("2026-06-01", **limits) == "2026-06-01"


def test_messages_show_dates_in_the_questions_own_format() -> None:
    props = {"format": "YYYYMMDD", "separator": "-", "start_date": "2026-01-15"}
    assert message("2026-01-14", **props) == "Choose a date on or after 2026-01-15."
    props = {"format": "DDMMYYYY", "separator": ".", "start_date": "2026-01-15"}
    assert message("2026-01-14", **props) == "Choose a date on or after 15.01.2026."


def test_properties_reject_bad_formats_dates_and_reversed_limits() -> None:
    assert DateProperties().model_dump() == {"format": "MMDDYYYY", "separator": "/", "start_date": None, "end_date": None}
    for bad in (
        {"format": "MM-DD"},
        {"separator": "|"},
        {"start_date": "2026-13-45"},
        {"end_date": "tomorrow"},
        {"start_date": "2026-05-01", "end_date": "2026-04-01"},
    ):
        with pytest.raises(ValidationError):
            DateProperties(**bad)
    assert DateProperties(start_date="2026-05-01", end_date="2026-05-01").end_date == "2026-05-01"


def test_a_date_is_shown_in_the_questions_format() -> None:
    spec = get_spec("date")
    assert spec.format("2026-03-07", {"format": "DDMMYYYY", "separator": "."}) == "07.03.2026"
    assert spec.format("2026-03-07", spec.defaults()) == "03/07/2026"
    assert spec.format("garbled", spec.defaults()) == "garbled"


def test_dates_branch_by_before_after_and_equality() -> None:
    spec = get_spec("date")
    assert set(spec.logic_ops) == {"is", "is_not", "lt", "lte", "gt", "gte"}
    assert spec.logic_match("lt", "2026-06-01", "2026-05-31", {}) is True
    assert spec.logic_match("gte", "2026-06-01", "2026-06-01", {}) is True
    assert spec.logic_match("is", "2026-06-01", "2026-06-02", {}) is False
    assert spec.logic_match("gt", "not a date", "2026-06-02", {}) is False
    assert spec.logic_value_error("2026-06-01") is None
    assert spec.logic_value_error("soon") is not None
    assert spec.logic_value_error(5) is not None


# ---- through the API -------------------------------------------------------


def test_a_new_date_question_gets_its_defaults(make_form, add_question) -> None:
    question = add_question(make_form()["id"], "date")
    assert question["properties"] == {"format": "MMDDYYYY", "separator": "/"}


def test_reversed_limits_are_rejected_by_the_api(client, make_form, add_question) -> None:
    question = add_question(make_form()["id"], "date")
    res = client.patch(
        f"/api/questions/{question['id']}",
        json={"properties": {"format": "MMDDYYYY", "separator": "/", "start_date": "2026-05-01", "end_date": "2026-04-01"}},
    )
    assert res.status_code == 422


def test_a_submission_stores_the_normalised_date_and_the_summary_lists_it(client, make_form, add_question) -> None:
    form = make_form()
    question = add_question(form["id"], "date", title="When?", properties={"format": "DDMMYYYY", "separator": "."})
    published = client.post(f"/api/forms/{form['id']}/publish").json()
    res = client.post(f"/api/public/forms/{published['slug']}/responses", json={"answers": {str(question["id"]): "2026-3-7"}})
    assert res.status_code == 201, res.text
    items = client.get(f"/api/forms/{form['id']}/responses").json()["items"]
    assert items[0]["answers"] == {str(question["id"]): "2026-03-07"}
    summary = client.get(f"/api/forms/{form['id']}/summary").json()["questions"][0]
    assert summary["type"] == "date" and [a["value"] for a in summary["answers"]] == ["07.03.2026"]


def test_an_impossible_date_is_rejected_with_the_message_on_that_question(client, make_form, add_question) -> None:
    form = make_form()
    question = add_question(form["id"], "date")
    published = client.post(f"/api/forms/{form['id']}/publish").json()
    res = client.post(f"/api/public/forms/{published['slug']}/responses", json={"answers": {str(question["id"]): "2026-02-30"}})
    assert res.status_code == 422
    assert res.json()["detail"]["errors"] == {str(question["id"]): INVALID}
