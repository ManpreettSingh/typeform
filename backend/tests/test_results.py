from collections import Counter

import pytest

from app.seed import COMPLETED, SEED_FORMS, seed

DEMO = SEED_FORMS[0]


@pytest.fixture
def demo(client):
    seed()
    form = next(f for f in client.get("/api/forms").json() if f["slug"] == DEMO["slug"])
    return client.get(f"/api/forms/{form['id']}").json()


def _completed_values(position: int) -> list:
    """Raw seeded answers for one question, completed responses only, most recent first."""
    rows = sorted((r for r in DEMO["responses"] if r[0] == COMPLETED), key=lambda r: r[1])
    return [r[2][position] for r in rows if r[2][position] is not None]


# ---- Summary ---------------------------------------------------------------


def test_summary_matches_seeded_raw_data(client, demo):
    summary = client.get(f"/api/forms/{demo['id']}/summary").json()
    total = len(DEMO["responses"])
    completed = sum(1 for r in DEMO["responses"] if r[0] == COMPLETED)
    assert summary["total_responses"] == total
    assert summary["completed"] == completed
    assert summary["completion_rate"] == pytest.approx(completed / total)
    assert [q["question_id"] for q in summary["questions"]] == [q["id"] for q in demo["questions"]]

    name, rating, features, comments = summary["questions"]

    assert name["type"] == "short_text"
    assert name["answered"] == completed
    assert name["recent"] == _completed_values(0)[:5]

    ratings = _completed_values(1)
    assert rating["answered"] == len(ratings)
    assert rating["average"] == pytest.approx(round(sum(ratings) / len(ratings), 2))
    assert rating["max"] == 5
    assert rating["distribution"] == {str(i): Counter(ratings)[i] for i in range(1, 6)}

    picks = _completed_values(2)
    assert features["answered"] == len(picks)
    expected = Counter(option for pick in picks for option in pick)
    assert [(c["option_id"], c["label"], c["count"]) for c in features["counts"]] == [
        ("builder", "Form builder", expected["builder"]),
        ("sharing", "Sharing", expected["sharing"]),
        ("results", "Results", expected["results"]),
    ]

    assert comments["answered"] == len(_completed_values(3))
    assert comments["recent"] == _completed_values(3)[:5]


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


def test_list_responses_newest_first_with_pagination(client, demo):
    url = f"/api/forms/{demo['id']}/responses"
    first = client.get(url, params={"page_size": 4}).json()
    assert first["total"] == len(DEMO["responses"])
    assert (first["page"], first["page_size"]) == (1, 4)
    # Newest first: the two partial responses are the most recent rows in the seed.
    assert [i["status"] for i in first["items"]] == ["partial", "partial", "completed", "completed"]
    name_id = str(demo["questions"][0]["id"])
    assert first["items"][2]["answers"][name_id] == "Omar"

    last = client.get(url, params={"page_size": 4, "page": 3}).json()
    assert len(last["items"]) == 2
    assert client.get(url, params={"page": 9}).json()["items"] == []

    completed = client.get(url, params={"status": "completed"}).json()
    assert completed["total"] == 8
    assert all(i["submitted_at"] for i in completed["items"])


@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 0}, {"page_size": 101}, {"status": "nope"}])
def test_list_responses_rejects_bad_params(client, demo, params):
    assert client.get(f"/api/forms/{demo['id']}/responses", params=params).status_code == 422


def test_response_detail_in_question_order(client, demo):
    items = client.get(f"/api/forms/{demo['id']}/responses", params={"status": "completed"}).json()["items"]
    omar = items[0]
    detail = client.get(f"/api/forms/{demo['id']}/responses/{omar['id']}").json()
    assert detail["status"] == "completed"
    assert [(a["question_title"], a["question_type"], a["value"]) for a in detail["answers"]] == [
        ("What's your name?", "short_text", "Omar"),
        ("How would you rate your experience?", "rating", 4),
        ("Which features do you use most?", "multiple_choice", ["builder", "results"]),
        ("Anything else you'd like to tell us?", "long_text", "Great experience overall!"),
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
    assert client.get(f"/api/forms/{demo['id']}").json()["response_count"] == 7
    assert client.get(f"/api/forms/{demo['id']}/summary").json()["completed"] == 7


# ---- CSV export ---------------------------------------------------------------


def test_csv_export(client, demo):
    res = client.get(f"/api/forms/{demo['id']}/responses/export.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert 'filename="Customer-feedback-responses.csv"' in res.headers["content-disposition"]
    text = res.content.decode("utf-8")
    assert text.startswith("﻿")
    lines = text.lstrip("﻿").splitlines()
    assert lines[0] == (
        "Response ID,Status,Started at,Submitted at,What's your name?,How would you rate your experience?,"
        "Which features do you use most?,Anything else you'd like to tell us?"
    )
    assert len(lines) == 1 + len(DEMO["responses"])
    omar = next(line for line in lines if ",Omar," in line)
    assert omar.endswith(",Omar,4/5,Form builder; Results,Great experience overall!")
    assert ",partial," in lines[1]


def test_csv_escapes_formulas(client, make_form, add_question):
    form = make_form("Inject")
    q = add_question(form["id"], "short_text", title="=cmd")
    client.post(f"/api/forms/{form['id']}/publish")
    client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {q["id"]: "=HYPERLINK(1)"}})
    text = client.get(f"/api/forms/{form['id']}/responses/export.csv").content.decode("utf-8")
    assert "'=cmd" in text.splitlines()[0]
    assert "'=HYPERLINK(1)" in text.splitlines()[1]
