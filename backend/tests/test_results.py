import csv
import io
from collections import Counter

import pytest

from app.models import Response
from app.seed import SEED_FORMS, seed

DEMO = SEED_FORMS[0]  # Customer Feedback: text, rating, multi-choice, yes/no (with a jump), dropdown, email


@pytest.fixture
def demo(client):
    seed()
    form = next(f for f in client.get("/api/forms").json() if f["slug"] == DEMO["slug"])
    return client.get(f"/api/forms/{form['id']}").json()


def _raw(db, form_id: int) -> list[Response]:
    """Seeded rows straight from the DB, newest first (by submission, else start)."""
    rows = db.query(Response).filter(Response.form_id == form_id).all()
    return sorted(rows, key=lambda r: (r.submitted_at or r.started_at, r.id), reverse=True)


def _completed_values(rows: list[Response], question_id: int) -> list:
    return [a.value for r in rows if r.status == "completed" for a in r.answers if a.question_id == question_id]


# ---- Summary ---------------------------------------------------------------


def test_summary_matches_seeded_raw_data(client, db, demo):
    rows = _raw(db, demo["id"])
    completed = sum(r.status == "completed" for r in rows)
    summary = client.get(f"/api/forms/{demo['id']}/summary").json()
    assert summary["total_responses"] == len(rows) == DEMO["responses"]["count"]
    assert summary["completed"] == completed == DEMO["responses"]["count"] - DEMO["responses"]["partial"]
    assert summary["completion_rate"] == round(completed / len(rows), 4)
    assert [q["question_id"] for q in summary["questions"]] == [q["id"] for q in demo["questions"]]

    by_type = {q["type"]: (q, s) for q, s in zip(demo["questions"], summary["questions"], strict=True)}

    question, name = by_type["short_text"]
    assert name["answered"] == completed
    assert name["recent"] == _completed_values(rows, question["id"])[:5]

    question, nps = by_type["rating"]
    scores = _completed_values(rows, question["id"])
    assert nps["max"] == 10
    assert nps["average"] == pytest.approx(round(sum(scores) / len(scores), 2))
    assert nps["distribution"] == {str(i): Counter(scores)[i] for i in range(1, 11)}

    question, features = by_type["multiple_choice"]
    picks = _completed_values(rows, question["id"])
    assert features["answered"] == len(picks)
    expected = Counter(option for pick in picks for option in pick)
    assert [(c["option_id"], c["count"]) for c in features["counts"]] == [
        (o["id"], expected[o["id"]]) for o in question["properties"]["options"]
    ]

    # Branching: only respondents who answered Yes reached the follow-up question.
    _, frustrated = by_type["yes_no"]
    yes = next(c["count"] for c in frustrated["counts"] if c["option_id"] == "yes")
    assert by_type["long_text"][1]["answered"] == yes > 0
    assert by_type["dropdown"][1]["answered"] == completed


def test_seeded_responses_follow_the_branching(client, db, demo):
    frustrated_id, follow_up_id = (q["id"] for q in demo["questions"] if q["type"] in ("yes_no", "long_text"))
    for r in _raw(db, demo["id"]):
        answers = {a.question_id: a.value for a in r.answers}
        if answers.get(frustrated_id) is False:
            assert follow_up_id not in answers


def test_summary_for_other_types(client, make_form, add_question):
    form = make_form("Types")
    yes_no = add_question(form["id"], "yes_no")
    number = add_question(form["id"], "number")
    dropdown = add_question(
        form["id"], "dropdown", properties={"options": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}]}
    )
    rating = add_question(form["id"], "rating", properties={"max": 3, "shape": "number"})
    client.post(f"/api/forms/{form['id']}/publish")
    for answers in (
        {yes_no["id"]: True, number["id"]: 10, dropdown["id"]: "b"},
        {yes_no["id"]: True, number["id"]: -2.5, dropdown["id"]: "b"},
        {yes_no["id"]: False, number["id"]: 4},
        {},
    ):
        res = client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": answers})
        assert res.status_code == 201, res.text

    by_id = {q["question_id"]: q for q in client.get(f"/api/forms/{form['id']}/summary").json()["questions"]}
    assert [(c["label"], c["count"]) for c in by_id[yes_no["id"]]["counts"]] == [("Yes", 2), ("No", 1)]
    assert by_id[number["id"]] | {"title": None} == {
        "question_id": number["id"],
        "type": "number",
        "title": None,
        "answered": 3,
        "min": -2.5,
        "max": 10,
        "average": 3.83,
    }
    assert [c["count"] for c in by_id[dropdown["id"]]["counts"]] == [0, 2]
    assert by_id[rating["id"]]["answered"] == 0
    assert by_id[rating["id"]]["average"] is None
    assert by_id[rating["id"]]["distribution"] == {"1": 0, "2": 0, "3": 0}


def test_summary_of_form_without_responses(client, make_form, add_question):
    form = make_form()
    add_question(form["id"], "number")
    summary = client.get(f"/api/forms/{form['id']}/summary").json()
    assert summary["total_responses"] == 0
    assert summary["completion_rate"] == 0
    assert summary["questions"][0]["min"] is None


def test_summary_missing_form_is_404(client):
    assert client.get("/api/forms/999/summary").status_code == 404


# ---- Responses list / detail / delete ---------------------------------------


def test_list_responses_newest_first_with_pagination(client, db, demo):
    rows = _raw(db, demo["id"])
    url = f"/api/forms/{demo['id']}/responses"
    first = client.get(url, params={"page_size": 4}).json()
    assert first["total"] == len(rows) == 30
    assert (first["page"], first["page_size"]) == (1, 4)
    assert [i["id"] for i in first["items"]] == [r.id for r in rows[:4]]

    last = client.get(url, params={"page_size": 4, "page": 8}).json()
    assert [i["id"] for i in last["items"]] == [r.id for r in rows[28:]]
    assert client.get(url, params={"page": 9}).json()["items"] == []

    completed = client.get(url, params={"status": "completed", "page_size": 100}).json()
    assert completed["total"] == 26
    assert all(i["submitted_at"] for i in completed["items"])
    partial = client.get(url, params={"status": "partial"}).json()
    assert partial["total"] == 4
    assert all(i["submitted_at"] is None for i in partial["items"])


@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 0}, {"page_size": 101}, {"status": "nope"}])
def test_list_responses_rejects_bad_params(client, demo, params):
    assert client.get(f"/api/forms/{demo['id']}/responses", params=params).status_code == 422


def test_response_detail_in_question_order(client, db, demo):
    newest = next(r for r in _raw(db, demo["id"]) if r.status == "completed")
    detail = client.get(f"/api/forms/{demo['id']}/responses/{newest.id}").json()
    assert detail["status"] == "completed"
    stored = {a.question_id: a.value for a in newest.answers}
    assert [(a["question_id"], a["question_title"], a["question_type"], a["value"]) for a in detail["answers"]] == [
        (q["id"], q["title"], q["type"], stored[q["id"]]) for q in demo["questions"] if q["id"] in stored
    ]


def test_response_from_another_form_is_404(client, demo, make_form):
    other = make_form("Other")
    rid = client.get(f"/api/forms/{demo['id']}/responses").json()["items"][0]["id"]
    assert client.get(f"/api/forms/{other['id']}/responses/{rid}").status_code == 404
    assert client.delete(f"/api/forms/{other['id']}/responses/{rid}").status_code == 404
    assert client.get(f"/api/forms/{demo['id']}/responses/99999").json() == {"detail": "Response not found"}


def test_delete_response(client, demo):
    url = f"/api/forms/{demo['id']}/responses"
    rid = client.get(url, params={"status": "completed"}).json()["items"][0]["id"]
    assert client.delete(f"{url}/{rid}").status_code == 204
    assert client.get(f"{url}/{rid}").status_code == 404
    assert client.get(f"/api/forms/{demo['id']}").json()["response_count"] == 25
    assert client.get(f"/api/forms/{demo['id']}/summary").json()["completed"] == 25


# ---- CSV export ---------------------------------------------------------------


def test_csv_export(client, db, demo):
    res = client.get(f"/api/forms/{demo['id']}/responses/export.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert 'filename="Customer-Feedback-responses.csv"' in res.headers["content-disposition"]
    text = res.content.decode("utf-8")
    assert text.startswith("\ufeff")
    rows = list(csv.reader(io.StringIO(text.lstrip("\ufeff"))))
    assert rows[0] == ["Response ID", "Status", "Started at", "Submitted at", *(q["title"] for q in demo["questions"])]
    assert len(rows) == 1 + DEMO["responses"]["count"]

    # One full row checked against the stored answers, formatted for humans.
    raw = next(r for r in _raw(db, demo["id"]) if r.status == "completed")
    row = next(r for r in rows[1:] if r[0] == str(raw.id))
    stored = {a.question_id: a.value for a in raw.answers}
    name, nps, features, *_ = demo["questions"]
    labels = {o["id"]: o["label"] for o in features["properties"]["options"]}
    assert row[1] == "completed"
    assert row[4] == stored[name["id"]]
    assert row[5] == f"{stored[nps['id']]}/10"
    assert row[6] == "; ".join(labels[o] for o in stored.get(features["id"], []))
    assert sum(r[1] == "partial" for r in rows[1:]) == DEMO["responses"]["partial"]


def test_csv_escapes_formulas(client, make_form, add_question):
    form = make_form("Inject")
    q = add_question(form["id"], "short_text", title="=cmd")
    client.post(f"/api/forms/{form['id']}/publish")
    client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {q["id"]: "=HYPERLINK(1)"}})
    text = client.get(f"/api/forms/{form['id']}/responses/export.csv").content.decode("utf-8")
    assert "'=cmd" in text.splitlines()[0]
    assert "'=HYPERLINK(1)" in text.splitlines()[1]
