from sqlalchemy import select

from app.models import Answer, Response


def _published_form(client, make_form, add_question):
    form = make_form("Survey")
    name = add_question(form["id"], "short_text", title="Name", required=True)
    email = add_question(form["id"], "email", title="Email")
    rating = add_question(form["id"], "rating", title="Rate us", required=True)
    choice = add_question(
        form["id"],
        "multiple_choice",
        title="Pick",
        properties={"options": [{"id": "x", "label": "X"}, {"id": "y", "label": "Y"}], "allow_multiple": True},
    )
    assert client.post(f"/api/forms/{form['id']}/publish").status_code == 200
    return form, {"name": name, "email": email, "rating": rating, "choice": choice}


def _submit(client, slug, answers):
    return client.post(f"/api/public/forms/{slug}/responses", json={"answers": answers})


def test_get_public_form(client, make_form, add_question):
    form, qs = _published_form(client, make_form, add_question)
    res = client.get(f"/api/public/forms/{form['slug']}")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"slug", "title", "description", "theme", "thank_you", "questions", "welcome", "submission_count", "endings"}
    assert [q["id"] for q in body["questions"]] == [qs[k]["id"] for k in ("name", "email", "rating", "choice")]
    assert set(body["questions"][0]) == {"id", "type", "title", "description", "required", "properties", "logic", "group_id", "group_title"}


def test_draft_and_missing_forms_are_404(client, make_form, add_question):
    form = make_form("Draft")
    question = add_question(form["id"])
    for slug in (form["slug"], "missing1"):
        assert client.get(f"/api/public/forms/{slug}").status_code == 404
        res = _submit(client, slug, {str(question["id"]): "hi"})
        assert res.status_code == 404
        assert res.json() == {"detail": "Form not found"}


def test_unpublished_form_is_404(client, make_form, add_question):
    form, _ = _published_form(client, make_form, add_question)
    client.post(f"/api/forms/{form['id']}/unpublish")
    assert client.get(f"/api/public/forms/{form['slug']}").status_code == 404


def test_submit_persists_completed_response(client, db, make_form, add_question):
    form, qs = _published_form(client, make_form, add_question)
    answers = {
        str(qs["name"]["id"]): "  Ada ",
        str(qs["email"]["id"]): "",  # optional + empty → not stored
        str(qs["rating"]["id"]): 4,
        str(qs["choice"]["id"]): ["y", "x"],
    }
    res = _submit(client, form["slug"], answers)
    assert res.status_code == 201, res.text
    response_id = res.json()["id"]

    response = db.get(Response, response_id)
    assert response.status == "completed"
    assert response.submitted_at is not None
    stored = {a.question_id: a.value for a in db.scalars(select(Answer).where(Answer.response_id == response_id))}
    assert stored == {qs["name"]["id"]: "Ada", qs["rating"]["id"]: 4, qs["choice"]["id"]: ["x", "y"]}
    assert client.get(f"/api/forms/{form['id']}").json()["response_count"] == 1


def test_submit_rejects_invalid_answers_without_saving(client, db, make_form, add_question):
    form, qs = _published_form(client, make_form, add_question)
    answers = {str(qs["email"]["id"]): "not-an-email", str(qs["rating"]["id"]): 9, "123456": "who?"}
    res = _submit(client, form["slug"], answers)
    assert res.status_code == 422
    assert res.json()["detail"]["errors"] == {
        str(qs["name"]["id"]): "Please fill this in",
        str(qs["email"]["id"]): "Hmm… that email doesn't look right",
        str(qs["rating"]["id"]): "Please choose a rating",
        "123456": "Unknown question",
    }
    assert db.scalar(select(Response.id)) is None


def test_submit_rejects_question_from_another_form(client, make_form, add_question):
    form, qs = _published_form(client, make_form, add_question)
    other = add_question(make_form("Other")["id"])
    answers = {str(qs["name"]["id"]): "Ada", str(qs["rating"]["id"]): 3, str(other["id"]): "sneaky"}
    res = _submit(client, form["slug"], answers)
    assert res.status_code == 422
    assert res.json()["detail"]["errors"] == {str(other["id"]): "Unknown question"}


def test_submit_body_shape(client, make_form, add_question):
    form, _ = _published_form(client, make_form, add_question)
    url = f"/api/public/forms/{form['slug']}/responses"
    assert "answers" in client.post(url, json={}).json()["detail"]["errors"]
    assert "answers" in client.post(url, json={"answers": []}).json()["detail"]["errors"]
    assert client.post(url, json={"answers": {}, "extra": 1}).status_code == 422
