from sqlalchemy import func, select

from app.models import Answer, Question, Response, ResponseStatus


def _add_response(db, form_id: int, question_id: int, status=ResponseStatus.COMPLETED) -> None:
    response = Response(form_id=form_id, status=status, answers=[Answer(question_id=question_id, value="hi")])
    db.add(response)
    db.commit()


def _count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def test_create_form_defaults(client):
    res = client.post("/api/forms")
    assert res.status_code == 201
    form = res.json()
    assert form["title"] == "New form"
    assert form["status"] == "draft"
    assert form["questions"] == []
    assert form["response_count"] == 0
    assert len(form["slug"]) == 8 and form["slug"].isalnum()
    assert form["theme"]["button_color"] == "#2A222B"
    assert form["thank_you"]["title"]
    assert form["published_at"] is None
    assert form["created_at"].endswith("Z") or "+00:00" in form["created_at"]


def test_create_form_rejects_blank_title(client):
    res = client.post("/api/forms", json={"title": "   "})
    assert res.status_code == 422
    assert "title" in res.json()["detail"]["errors"]


def test_get_missing_form_is_404(client):
    res = client.get("/api/forms/999")
    assert res.status_code == 404
    assert res.json() == {"detail": "Form not found"}


def test_list_forms_with_counts(client, db, make_form, add_question):
    older = make_form("Older")
    newer = make_form("Newer")
    q = add_question(older["id"])
    _add_response(db, older["id"], q["id"])
    _add_response(db, older["id"], q["id"], status=ResponseStatus.PARTIAL)

    items = client.get("/api/forms").json()
    # Adding a question touched "Older", so it is now the most recently updated.
    assert [i["title"] for i in items] == ["Older", "Newer"]
    by_id = {i["id"]: i for i in items}
    assert by_id[older["id"]]["response_count"] == 1  # partial responses are not counted
    assert by_id[older["id"]]["response_total"] == 2  # ...but are in the total
    assert by_id[older["id"]]["theme"]["button_color"] == "#2A222B"
    assert by_id[older["id"]]["question_count"] == 1
    assert by_id[newer["id"]]["response_count"] == 0
    assert set(items[0]) >= {"id", "title", "status", "slug", "response_count", "updated_at"}


def test_patch_form(client, make_form):
    form = make_form()
    res = client.patch(
        f"/api/forms/{form['id']}",
        json={
            "title": "Renamed",
            "description": "Hello",
            "theme": {"background": "#000000", "text_color": "#FFFFFF", "button_color": "#FF0000", "font": "Inter"},
            "thank_you": {"title": "Bye", "message": "See you", "button_text": "Home", "button_url": "https://x.io"},
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Renamed"
    assert body["description"] == "Hello"
    assert body["theme"]["background"] == "#000000"
    assert body["thank_you"]["button_url"] == "https://x.io"

    # Omitted fields are untouched; description can be cleared with null.
    res = client.patch(f"/api/forms/{form['id']}", json={"description": None})
    assert res.json()["title"] == "Renamed"
    assert res.json()["description"] is None


def test_patch_form_validation(client, make_form):
    form = make_form()
    url = f"/api/forms/{form['id']}"

    errors = client.patch(url, json={"title": None}).json()["detail"]["errors"]
    assert errors == {"body": "title cannot be null"}

    res = client.patch(url, json={"theme": {"background": "red"}})
    assert res.status_code == 422
    assert "theme.background" in res.json()["detail"]["errors"]

    assert client.patch(url, json={"status": "published"}).status_code == 422  # not patchable


def test_delete_form_cascades(client, db, make_form, add_question):
    form = make_form()
    q = add_question(form["id"])
    _add_response(db, form["id"], q["id"])

    assert client.delete(f"/api/forms/{form['id']}").status_code == 204
    assert client.get(f"/api/forms/{form['id']}").status_code == 404
    db.expire_all()
    assert _count(db, Question) == 0
    assert _count(db, Response) == 0
    assert _count(db, Answer) == 0


def test_duplicate_copies_questions_not_responses(client, db, make_form, add_question):
    form = make_form("Survey")
    q1 = add_question(form["id"], "multiple_choice", title="Pick one", required=True)
    add_question(form["id"], "rating", title="Rate us")
    _add_response(db, form["id"], q1["id"])
    client.post(f"/api/forms/{form['id']}/publish")

    res = client.post(f"/api/forms/{form['id']}/duplicate")
    assert res.status_code == 201
    clone = res.json()
    assert clone["id"] != form["id"]
    assert clone["slug"] != form["slug"]
    assert clone["title"] == "Survey (copy)"
    assert clone["status"] == "draft"
    assert clone["published_at"] is None
    assert clone["response_count"] == 0

    original = client.get(f"/api/forms/{form['id']}").json()
    strip = lambda q: {k: v for k, v in q.items() if k not in ("id", "form_id")}  # noqa: E731
    assert [strip(q) for q in clone["questions"]] == [strip(q) for q in original["questions"]]
    assert {q["id"] for q in clone["questions"]}.isdisjoint(q["id"] for q in original["questions"])


def test_duplicate_missing_form_is_404(client):
    assert client.post("/api/forms/123/duplicate").status_code == 404


def test_publish_rules(client, make_form, add_question):
    form = make_form()
    url = f"/api/forms/{form['id']}"

    res = client.post(f"{url}/publish")
    assert res.status_code == 400
    assert res.json() == {"detail": "Add at least one question before publishing."}

    add_question(form["id"])
    published = client.post(f"{url}/publish").json()
    assert published["status"] == "published"
    assert published["published_at"] is not None

    draft = client.post(f"{url}/unpublish").json()
    assert draft["status"] == "draft"
    assert client.get(url).json()["status"] == "draft"
