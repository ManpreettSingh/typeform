from sqlalchemy import select

from app.models import Answer, Response


def _set_logic(client, question_id, rules):
    return client.patch(f"/api/questions/{question_id}", json={"logic": {"rules": rules} if rules is not None else None})


def _branching_form(client, make_form, add_question):
    """Q1 yes/no (No → end), Q2 choice (b → Q4), Q3 required text, Q4 required rating."""
    form = make_form("Branching")
    q1 = add_question(form["id"], "yes_no", title="Do you code?", required=True)
    q2 = add_question(
        form["id"],
        "multiple_choice",
        title="Language",
        required=True,
        properties={"options": [{"id": "a", "label": "Python"}, {"id": "b", "label": "Go"}]},
    )
    q3 = add_question(form["id"], "short_text", title="Why Python?", required=True)
    q4 = add_question(form["id"], "rating", title="Rate us", required=True)
    assert _set_logic(client, q1["id"], [{"op": "is", "value": False, "to": "end"}]).status_code == 200
    assert _set_logic(client, q2["id"], [{"op": "is", "value": "b", "to": q4["id"]}]).status_code == 200
    assert client.post(f"/api/forms/{form['id']}/publish").status_code == 200
    return form, q1, q2, q3, q4


def _submit(client, slug, answers):
    return client.post(f"/api/public/forms/{slug}/responses", json={"answers": answers})


# ---- Saving rules ----------------------------------------------------------


def test_logic_is_saved_returned_and_cleared(client, make_form, add_question):
    form = make_form()
    q1 = add_question(form["id"], "number", title="Age")
    q2 = add_question(form["id"], "short_text", title="Name")
    rules = [{"op": "gte", "value": 18, "to": q2["id"]}, {"op": "lt", "value": 18, "to": "end"}]
    res = _set_logic(client, q1["id"], rules)
    assert res.status_code == 200, res.text
    assert res.json()["logic"] == {"rules": rules}
    assert client.get(f"/api/forms/{form['id']}").json()["questions"][0]["logic"] == {"rules": rules}

    assert _set_logic(client, q1["id"], []).json()["logic"] is None
    assert _set_logic(client, q1["id"], None).json()["logic"] is None


def test_logic_rejects_bad_rules(client, make_form, add_question):
    form = make_form()
    other = make_form("Other")
    choice = add_question(form["id"], "dropdown", title="Pick")
    target = add_question(form["id"], "short_text")
    foreign = add_question(other["id"], "short_text")

    cases = [
        ([{"op": "gt", "value": "x", "to": "end"}], "logic.rules.0.op"),
        ([{"op": "is", "value": 3, "to": "end"}], "logic.rules.0.value"),
        ([{"op": "is", "value": "x", "to": foreign["id"]}], "logic.rules.0.to"),
        ([{"op": "is", "value": "x", "to": choice["id"]}], "logic.rules.0.to"),  # itself
        ([{"op": "is", "value": "x", "to": "start"}], "logic.rules.0.to"),
        ([{"op": "is", "value": "x", "to": "end", "extra": 1}], "logic.rules.0.extra"),
    ]
    for rules, key in cases:
        res = _set_logic(client, choice["id"], rules)
        assert res.status_code == 422, (rules, res.text)
        assert key in res.json()["detail"]["errors"], (rules, res.json())

    ok = _set_logic(client, choice["id"], [{"op": "is_not", "value": "x", "to": target["id"]}])
    assert ok.status_code == 200


def test_deleting_a_target_drops_jumps_to_it(client, make_form, add_question):
    form = make_form()
    q1 = add_question(form["id"], "yes_no")
    q2 = add_question(form["id"], "short_text")
    q3 = add_question(form["id"], "short_text")
    _set_logic(
        client,
        q1["id"],
        [{"op": "is", "value": True, "to": q3["id"]}, {"op": "is", "value": False, "to": "end"}],
    )
    assert client.delete(f"/api/questions/{q3['id']}").status_code == 204
    questions = client.get(f"/api/forms/{form['id']}").json()["questions"]
    assert questions[0]["logic"] == {"rules": [{"op": "is", "value": False, "to": "end"}]}

    _set_logic(client, q1["id"], [{"op": "is", "value": True, "to": q2["id"]}])
    client.delete(f"/api/questions/{q2['id']}")
    assert client.get(f"/api/forms/{form['id']}").json()["questions"][0]["logic"] is None


def test_duplicate_points_jumps_at_the_copies(client, make_form, add_question):
    form = make_form()
    q1 = add_question(form["id"], "yes_no")
    add_question(form["id"], "short_text")
    q3 = add_question(form["id"], "short_text")
    _set_logic(client, q1["id"], [{"op": "is", "value": True, "to": q3["id"]}])

    copy = client.post(f"/api/forms/{form['id']}/duplicate").json()
    copied = copy["questions"]
    assert copied[0]["logic"] == {"rules": [{"op": "is", "value": True, "to": copied[2]["id"]}]}
    assert copied[2]["id"] != q3["id"]


def test_public_form_includes_logic(client, make_form, add_question):
    form, q1, *_ = _branching_form(client, make_form, add_question)
    questions = client.get(f"/api/public/forms/{form['slug']}").json()["questions"]
    assert questions[0]["logic"] == {"rules": [{"op": "is", "value": False, "to": "end"}]}


# ---- Submissions follow the path --------------------------------------------


def test_jump_to_end_skips_required_questions(client, db, make_form, add_question):
    form, q1, q2, q3, q4 = _branching_form(client, make_form, add_question)
    res = _submit(client, form["slug"], {str(q1["id"]): False})
    assert res.status_code == 201, res.text
    stored = db.scalars(select(Answer).where(Answer.response_id == res.json()["id"])).all()
    assert {a.question_id: a.value for a in stored} == {q1["id"]: False}


def test_jump_skips_question_and_drops_its_answer(client, db, make_form, add_question):
    form, q1, q2, q3, q4 = _branching_form(client, make_form, add_question)
    answers = {str(q1["id"]): True, str(q2["id"]): "b", str(q3["id"]): "left over", str(q4["id"]): 4}
    res = _submit(client, form["slug"], answers)
    assert res.status_code == 201, res.text
    stored = db.scalars(select(Answer).where(Answer.response_id == res.json()["id"])).all()
    assert {a.question_id for a in stored} == {q1["id"], q2["id"], q4["id"]}


def test_required_questions_on_the_path_are_enforced(client, make_form, add_question):
    form, q1, q2, q3, q4 = _branching_form(client, make_form, add_question)
    res = _submit(client, form["slug"], {str(q1["id"]): True, str(q2["id"]): "a"})
    assert res.status_code == 422
    assert set(res.json()["detail"]["errors"]) == {str(q3["id"]), str(q4["id"])}


def test_backward_jumps_are_ignored(client, make_form, add_question):
    form = make_form()
    q1 = add_question(form["id"], "short_text", title="First", required=True)
    q2 = add_question(form["id"], "yes_no", title="Loop?", required=True)
    q3 = add_question(form["id"], "short_text", title="Last", required=True)
    # Forward when saved; reordering makes it point backwards.
    _set_logic(client, q2["id"], [{"op": "is", "value": True, "to": q3["id"]}])
    order = [q3["id"], q1["id"], q2["id"]]
    assert client.put(f"/api/forms/{form['id']}/questions/order", json={"ordered_ids": order}).status_code == 200
    client.post(f"/api/forms/{form['id']}/publish")

    res = _submit(client, form["slug"], {str(q3["id"]): "z", str(q1["id"]): "a", str(q2["id"]): True})
    assert res.status_code == 201, res.text


def test_text_and_number_conditions(client, make_form, add_question):
    form = make_form()
    q1 = add_question(form["id"], "short_text", title="Name")
    q2 = add_question(form["id"], "number", title="Age")
    q3 = add_question(form["id"], "short_text", title="Only for adults", required=True)
    _set_logic(client, q1["id"], [{"op": "contains", "value": "BOT", "to": "end"}])
    _set_logic(client, q2["id"], [{"op": "lt", "value": 18, "to": "end"}])
    client.post(f"/api/forms/{form['id']}/publish")

    assert _submit(client, form["slug"], {str(q1["id"]): "a robot"}).status_code == 201
    assert _submit(client, form["slug"], {str(q1["id"]): "Ada", str(q2["id"]): 12}).status_code == 201
    res = _submit(client, form["slug"], {str(q1["id"]): "Ada", str(q2["id"]): 30})
    assert res.status_code == 422
    assert set(res.json()["detail"]["errors"]) == {str(q3["id"])}


# ---- Partial responses -------------------------------------------------------


def _start(client, slug):
    res = client.post(f"/api/public/forms/{slug}/responses/start")
    assert res.status_code == 201, res.text
    return res.json()


def _patch(client, started, answers, **extra):
    body = {"token": started["token"], "answers": answers, **extra}
    return client.patch(f"/api/public/responses/{started['response_id']}", json=body)


def test_partial_progress_then_complete(client, db, make_form, add_question):
    form, q1, q2, q3, q4 = _branching_form(client, make_form, add_question)
    started = _start(client, form["slug"])
    assert set(started) == {"response_id", "token"}

    res = _patch(client, started, {str(q1["id"]): True})
    assert res.status_code == 200, res.text
    assert res.json() == {"id": started["response_id"], "status": "partial"}
    res = _patch(client, started, {str(q1["id"]): True, str(q2["id"]): "a"})
    assert res.status_code == 200

    response = db.get(Response, started["response_id"])
    assert response.status == "partial" and response.submitted_at is None
    assert {a.question_id: a.value for a in response.answers} == {q1["id"]: True, q2["id"]: "a"}

    page = client.get(f"/api/forms/{form['id']}/responses").json()
    assert page["items"][0]["status"] == "partial"
    assert "token" not in str(page)

    # Changing branch replaces the stored answers.
    res = _patch(client, started, {str(q1["id"]): True, str(q2["id"]): "b", str(q4["id"]): 5}, complete=True)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "completed"
    db.expire_all()
    response = db.get(Response, started["response_id"])
    assert response.submitted_at is not None
    assert {a.question_id: a.value for a in response.answers} == {q1["id"]: True, q2["id"]: "b", q4["id"]: 5}
    assert client.get(f"/api/forms/{form['id']}").json()["response_count"] == 1


def test_partial_validates_values_but_not_required(client, make_form, add_question):
    form, q1, q2, q3, q4 = _branching_form(client, make_form, add_question)
    started = _start(client, form["slug"])
    assert _patch(client, started, {}).status_code == 200
    res = _patch(client, started, {str(q2["id"]): "nope", "999": "x"})
    assert res.status_code == 422
    assert set(res.json()["detail"]["errors"]) == {str(q2["id"]), "999"}

    res = _patch(client, started, {str(q1["id"]): True}, complete=True)
    assert res.status_code == 422
    assert set(res.json()["detail"]["errors"]) == {str(q2["id"]), str(q3["id"]), str(q4["id"])}


def test_partial_requires_matching_token_and_open_response(client, make_form, add_question):
    form, q1, *_ = _branching_form(client, make_form, add_question)
    started = _start(client, form["slug"])

    wrong = {**started, "token": "x" * 22}
    assert _patch(client, wrong, {}).status_code == 404
    missing = {**started, "response_id": 9999}
    assert _patch(client, missing, {}).status_code == 404

    assert _patch(client, started, {str(q1["id"]): False}, complete=True).status_code == 200
    res = _patch(client, started, {str(q1["id"]): True})
    assert res.status_code == 409

    other = _start(client, form["slug"])
    client.post(f"/api/forms/{form['id']}/unpublish")
    assert _patch(client, other, {}).status_code == 404
    assert client.post(f"/api/public/forms/{form['slug']}/responses/start").status_code == 404
