import pytest
from sqlalchemy import func, select

from app.models import Answer, Response, ResponseStatus
from app.seed import seed


def _questions(client, form_id: int) -> list[dict]:
    return client.get(f"/api/forms/{form_id}").json()["questions"]


@pytest.mark.parametrize(
    ("qtype", "expected"),
    [
        ("short_text", {}),
        ("long_text", {}),
        ("email", {}),
        ("yes_no", {}),
        ("number", {}),
        ("rating", {"max": 5, "shape": "star"}),
    ],
)
def test_default_properties(make_form, add_question, qtype, expected):
    q = add_question(make_form()["id"], qtype)
    assert q["type"] == qtype
    assert q["properties"] == expected
    assert q["title"] == "" and q["required"] is False and q["position"] == 0


@pytest.mark.parametrize("qtype", ["multiple_choice", "dropdown"])
def test_choice_defaults_have_two_options(make_form, add_question, qtype):
    props = add_question(make_form()["id"], qtype)["properties"]
    assert [o["label"] for o in props["options"]] == ["Choice 1", "Choice 2"]
    assert len({o["id"] for o in props["options"]}) == 2


def test_create_validates_properties_against_type(client, make_form):
    form = make_form()
    url = f"/api/forms/{form['id']}/questions"

    res = client.post(url, json={"type": "rating", "properties": {"max": 11}})
    assert res.status_code == 422
    assert "properties.max" in res.json()["detail"]["errors"]

    res = client.post(url, json={"type": "email", "properties": {"options": []}})
    assert "properties.options" in res.json()["detail"]["errors"]

    res = client.post(url, json={"type": "dropdown", "properties": {"options": [{"id": "a", "label": "A"}] * 2}})
    assert res.status_code == 422

    res = client.post(url, json={"type": "number", "properties": {"min": 10, "max": 1}})
    assert res.status_code == 422

    assert client.post(url, json={"type": "file_upload"}).status_code == 422


def test_create_missing_form_is_404(client):
    assert client.post("/api/forms/42/questions", json={"type": "email"}).status_code == 404


def test_insert_at_position(client, make_form, add_question):
    form = make_form()
    a = add_question(form["id"], title="A")
    b = add_question(form["id"], title="B")
    c = add_question(form["id"], title="C", position=1)
    add_question(form["id"], title="D", position=99)  # clamped to the end

    qs = _questions(client, form["id"])
    assert [q["title"] for q in qs] == ["A", "C", "B", "D"]
    assert [q["position"] for q in qs] == [0, 1, 2, 3]
    assert [q["id"] for q in qs[:3]] == [a["id"], c["id"], b["id"]]


def test_patch_question(client, make_form, add_question):
    q = add_question(make_form()["id"], "multiple_choice")
    url = f"/api/questions/{q['id']}"

    res = client.patch(
        url,
        json={
            "title": "Favourite colour?",
            "description": "Pick one",
            "required": True,
            "properties": {"options": [{"id": "r", "label": "Red"}], "allow_multiple": True},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Favourite colour?"
    assert body["required"] is True
    assert body["properties"] == {
        "options": [{"id": "r", "label": "Red"}],
        "allow_multiple": True,
        "allow_other": False,
        "none_of_the_above": False,
        "randomize": False,
    }

    # Partial: only description changes.
    body = client.patch(url, json={"description": None}).json()
    assert body["description"] is None and body["title"] == "Favourite colour?"


def test_patch_question_validation(client, make_form, add_question):
    q = add_question(make_form()["id"], "rating")
    url = f"/api/questions/{q['id']}"

    res = client.patch(url, json={"properties": {"max": 2}})
    assert res.status_code == 422
    assert "properties.max" in res.json()["detail"]["errors"]
    assert client.patch(url, json={"title": None}).status_code == 422
    assert client.patch("/api/questions/999", json={"title": "x"}).status_code == 404


def test_delete_question_renumbers_and_cascades_answers(client, db, make_form, add_question):
    form = make_form()
    a, b, c = (add_question(form["id"], title=t) for t in "ABC")
    db.add(Response(form_id=form["id"], status=ResponseStatus.COMPLETED, answers=[Answer(question_id=b["id"], value="x")]))
    db.commit()

    assert client.delete(f"/api/questions/{b['id']}").status_code == 204
    qs = _questions(client, form["id"])
    assert [(q["title"], q["position"]) for q in qs] == [("A", 0), ("C", 1)]
    assert db.scalar(select(func.count()).select_from(Answer)) == 0
    assert client.delete(f"/api/questions/{b['id']}").status_code == 404


def test_reorder(client, make_form, add_question):
    form = make_form()
    ids = [add_question(form["id"], title=t)["id"] for t in "ABCD"]
    url = f"/api/forms/{form['id']}/questions/order"

    new_order = [ids[3], ids[0], ids[2], ids[1]]
    res = client.put(url, json={"ordered_ids": new_order})
    assert res.status_code == 200, res.text
    assert [q["id"] for q in res.json()] == new_order

    qs = _questions(client, form["id"])
    assert [q["id"] for q in qs] == new_order
    assert [q["position"] for q in qs] == [0, 1, 2, 3]


@pytest.mark.parametrize(
    "bad",
    [
        lambda ids: ids[:-1],  # missing one
        lambda ids: ids + [ids[0]],  # duplicate
        lambda ids: ids[:-1] + [9999],  # foreign id
    ],
)
def test_reorder_rejects_invalid_ids(client, make_form, add_question, bad):
    form = make_form()
    ids = [add_question(form["id"])["id"] for _ in range(3)]
    res = client.put(f"/api/forms/{form['id']}/questions/order", json={"ordered_ids": bad(ids)})
    assert res.status_code == 400
    assert [q["id"] for q in _questions(client, form["id"])] == ids


def test_seed_is_idempotent(client):
    assert seed() == (3, 52, 30)
    assert seed() == (0, 0, 0)
    forms = {f["slug"]: f for f in client.get("/api/forms").json()}
    assert {slug: f["status"] for slug, f in forms.items()} == {
        "demo-feedback": "published",
        "demo-event": "published",
        "demo-draft": "draft",
    }
    assert [forms[slug]["response_count"] for slug in ("demo-feedback", "demo-event", "demo-draft")] == [26, 19, 0]
