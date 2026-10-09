"""Partial Submit Point: reaching it counts a response as submitted, even if the respondent never finishes.

The respondent's browser says it has reached the point (`partial_submit` on a progress save); the response is then
completed with the answers so far, can still be added to, and the final submit completes that same response.
"""

import pytest


def make(client, make_form, add_question, *, with_point=True):
    form = make_form("Survey")
    name = add_question(form["id"], "short_text", title="Name")
    email = add_question(form["id"], "email", title="Email")
    point = add_question(form["id"], "partial_submit") if with_point else None
    later = add_question(form["id"], "short_text", title="Comments", required=True)
    client.post(f"/api/forms/{form['id']}/publish")
    return form, name, email, point, later


def start(client, form):
    started = client.post(f"/api/public/forms/{form['slug']}/responses/start").json()
    return f"/api/public/responses/{started['response_id']}", started["token"]


def progress(client, url, token, answers, **flags):
    return client.patch(url, json={"token": token, "answers": {str(q["id"]): v for q, v in answers}, **flags})


def summary(client, form):
    return client.get(f"/api/forms/{form['id']}/summary").json()


def test_the_point_is_a_block_with_a_default_name_and_no_answer(client, make_form, add_question) -> None:
    form, _, _, point, _ = make(client, make_form, add_question)
    assert point["type"] == "partial_submit"
    assert point["title"] == "Partial submit point"
    assert point["properties"] == {}
    # Like a statement, it takes no answer, so results and the CSV never list it.
    assert all(q["type"] != "partial_submit" for q in summary(client, form)["questions"])
    header = client.get(f"/api/forms/{form['id']}/responses/export.csv").text.splitlines()[0]
    assert "Partial submit point" not in header


def test_reaching_the_point_counts_the_response_as_submitted(client, make_form, add_question) -> None:
    form, name, email, _, _ = make(client, make_form, add_question)
    url, token = start(client, form)
    assert progress(client, url, token, [(name, "Ana")]).status_code == 200
    assert summary(client, form)["completed"] == 0  # progress alone is not a submission

    # The required question after the point is still empty, and that is fine at the point.
    res = progress(client, url, token, [(name, "Ana"), (email, "ana@example.com")], partial_submit=True)
    assert res.status_code == 200, res.text
    assert summary(client, form)["completed"] == 1
    [item] = client.get(f"/api/forms/{form['id']}/responses").json()["items"]
    assert item["status"] == "completed" and item["submitted_at"] is not None


def test_answers_keep_arriving_and_the_final_submit_completes_the_same_response(client, make_form, add_question) -> None:
    form, name, email, _, later = make(client, make_form, add_question)
    url, token = start(client, form)
    progress(client, url, token, [(name, "Ana"), (email, "ana@example.com")], partial_submit=True)

    # More progress after the point is accepted and the response stays submitted.
    assert progress(client, url, token, [(name, "Ana"), (email, "ana@example.com"), (later, "half")]).status_code == 200
    assert summary(client, form)["completed"] == 1

    done = progress(client, url, token, [(name, "Ana"), (email, "ana@example.com"), (later, "All done")], complete=True)
    assert done.status_code == 200, done.text
    page = client.get(f"/api/forms/{form['id']}/responses").json()
    assert page["total"] == 1 and summary(client, form)["completed"] == 1
    assert page["items"][0]["answers"][str(later["id"])] == "All done"

    # Once finished, the response is closed like any other.
    assert progress(client, url, token, [(name, "Changed")]).status_code == 409


def test_the_final_submit_still_enforces_required_questions(client, make_form, add_question) -> None:
    form, name, email, _, later = make(client, make_form, add_question)
    url, token = start(client, form)
    progress(client, url, token, [(name, "Ana")], partial_submit=True)
    res = progress(client, url, token, [(name, "Ana")], complete=True)
    assert res.status_code == 422 and str(later["id"]) in res.json()["detail"]["errors"]


def test_answers_up_to_the_point_must_still_be_valid(client, make_form, add_question) -> None:
    form, name, email, _, _ = make(client, make_form, add_question)
    url, token = start(client, form)
    res = progress(client, url, token, [(name, "Ana"), (email, "not-an-email")], partial_submit=True)
    assert res.status_code == 422 and str(email["id"]) in res.json()["detail"]["errors"]
    assert summary(client, form)["completed"] == 0


def test_without_a_point_the_flag_changes_nothing(client, make_form, add_question) -> None:
    form, name, _, _, _ = make(client, make_form, add_question, with_point=False)
    url, token = start(client, form)
    assert progress(client, url, token, [(name, "Ana")], partial_submit=True).status_code == 200
    assert summary(client, form)["completed"] == 0


def test_a_submission_without_the_flag_stays_in_progress(client, make_form, add_question) -> None:
    form, name, _, _, _ = make(client, make_form, add_question)
    url, token = start(client, form)
    progress(client, url, token, [(name, "Ana")])
    assert summary(client, form)["completed"] == 0


def test_reaching_the_point_adds_the_contact(client, make_form, add_question) -> None:
    form, name, email, _, _ = make(client, make_form, add_question)
    url, token = start(client, form)
    progress(client, url, token, [(name, "Ana"), (email, "ana@example.com")], partial_submit=True)
    contacts = client.get("/api/contacts").json()
    assert [c["email"] for c in contacts["items"]] == ["ana@example.com"]


@pytest.mark.parametrize("position", [0, 1])
def test_the_point_can_sit_anywhere_in_the_form(client, make_form, add_question, position) -> None:
    form = make_form("F")
    first = add_question(form["id"], "short_text", title="Q1")
    point = add_question(form["id"], "partial_submit")
    if position == 0:
        client.put(f"/api/forms/{form['id']}/questions/order", json={"ordered_ids": [point["id"], first["id"]]})
    client.post(f"/api/forms/{form['id']}/publish")
    url, token = start(client, form)
    assert progress(client, url, token, [(first, "x")], partial_submit=True).status_code == 200
    assert summary(client, form)["completed"] == 1
