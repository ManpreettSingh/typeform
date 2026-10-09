"""Templates gallery: the JSON files in app/templates, GET /api/templates[/{slug}] and POST /api/forms/from-template/{slug}."""

import json
from pathlib import Path

import pytest

from app.models import QuestionType
from app.schemas.form import FormOut
from app.schemas.properties import validate_properties
from app.services import templates as template_service

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "app" / "templates"
FILES = sorted(TEMPLATES_DIR.glob("*.json"))
SLUGS = [f.stem for f in FILES]

ROLES = {"sales", "product", "marketing", "hr", "customer-success"}
GOALS = {"get-feedback", "make-sales", "plan-events", "conduct-research", "engage-audience", "recruit-talent", "generate-leads"}
TYPES = {"forms", "surveys", "quizzes", "polls"}


def _raw(slug: str) -> dict:
    return json.loads((TEMPLATES_DIR / f"{slug}.json").read_text(encoding="utf-8"))


# ---- the files ---------------------------------------------------------------------------------------------------


def test_there_are_about_sixteen_or_more_templates():
    assert len(FILES) >= 16


def test_every_category_has_a_template():
    tags = [_raw(slug)["tags"] for slug in SLUGS]
    assert {r for t in tags for r in t["role"]} == ROLES
    assert {g for t in tags for g in t["goal"]} == GOALS
    assert {k for t in tags for k in t["type"]} == TYPES


def test_templates_show_a_good_mix_of_question_types():
    used = {q["type"] for slug in SLUGS for q in _raw(slug)["questions"]}
    assert len(used) >= 15, sorted(used)
    assert used <= {t.value for t in QuestionType}


def test_templates_do_not_use_logic_yet():
    # Logic and scoring in templates is deferred (docs/superpowers/DEFERRED.md).
    for slug in SLUGS:
        raw = _raw(slug)
        assert "logic" not in raw
        assert all("logic" not in q for q in raw["questions"]), slug


@pytest.mark.parametrize("slug", SLUGS)
def test_template_file_is_valid(slug):
    raw = _raw(slug)
    assert raw["slug"] == slug  # the file name is the slug
    definition = template_service.get_template(slug)
    assert definition.title and definition.description
    assert len(definition.questions) >= 3
    assert len(definition.endings) >= 1
    assert definition.questions[0].type != QuestionType.STATEMENT or len(definition.questions) > 3
    for question in definition.questions:
        # Properties are checked against the same models as manual creation.
        if question.properties is not None:
            validate_properties(question.type, question.properties)
        assert question.title.strip()
    for category in ("role", "goal", "type"):
        assert getattr(definition.tags, category), f"{slug}: no {category} tag"


def test_every_template_theme_is_in_the_seeded_gallery(db):
    from app.models.theme import ThemeGallery
    from app.seed import _seed_themes
    from sqlalchemy import select

    _seed_themes(db)
    db.commit()
    gallery = set(db.scalars(select(ThemeGallery.name)))
    for slug in SLUGS:
        assert _raw(slug)["theme"] in gallery, slug


# ---- GET /api/templates ------------------------------------------------------------------------------------------


def test_list_templates_shape(client):
    res = client.get("/api/templates")
    assert res.status_code == 200
    items = res.json()
    assert [i["slug"] for i in items] == sorted((i["slug"] for i in items), key=lambda s: _raw(s)["title"].lower())
    assert {i["slug"] for i in items} == set(SLUGS)
    for item in items:
        assert set(item) >= {"slug", "title", "description", "tags", "question_count", "question_types", "theme", "theme_name"}
        raw = _raw(item["slug"])
        assert item["title"] == raw["title"]
        assert item["question_count"] == len(raw["questions"])
        assert item["question_types"] == list(dict.fromkeys(q["type"] for q in raw["questions"]))
        assert set(item["theme"]) == {"question", "answer", "button", "background", "font", "background_image"}
        assert item["tags"] == raw["tags"]


def test_list_filters_by_role(client):
    items = client.get("/api/templates", params={"role": "hr"}).json()
    expected = {s for s in SLUGS if "hr" in _raw(s)["tags"]["role"]}
    assert expected and {i["slug"] for i in items} == expected


def test_list_filters_by_goal_and_type(client):
    items = client.get("/api/templates", params={"goal": "generate-leads", "type": "forms"}).json()
    expected = {
        s for s in SLUGS if "generate-leads" in _raw(s)["tags"]["goal"] and "forms" in _raw(s)["tags"]["type"]
    }
    assert expected and {i["slug"] for i in items} == expected


def test_list_repeated_values_in_a_category_match_either(client):
    items = client.get("/api/templates", params=[("role", "sales"), ("role", "hr")]).json()
    expected = {s for s in SLUGS if {"sales", "hr"} & set(_raw(s)["tags"]["role"])}
    assert {i["slug"] for i in items} == expected


def test_list_unknown_filter_value_matches_nothing(client):
    assert client.get("/api/templates", params={"role": "astronaut"}).json() == []


def test_list_search_matches_title_description_and_question_titles(client):
    items = client.get("/api/templates", params={"q": "NPS"}).json()
    assert "nps-survey" in {i["slug"] for i in items}
    needle = "recommend"
    expected = {
        s
        for s in SLUGS
        if needle in " ".join([_raw(s)["title"], _raw(s)["description"], *[q["title"] for q in _raw(s)["questions"]]]).lower()
    }
    assert expected
    assert {i["slug"] for i in client.get("/api/templates", params={"q": "  Recommend "}).json()} == expected
    assert client.get("/api/templates", params={"q": "zzzzqqqq"}).json() == []


def test_list_combines_search_and_filters(client):
    everything = {i["slug"] for i in client.get("/api/templates", params={"q": "survey"}).json()}
    surveys = {i["slug"] for i in client.get("/api/templates", params={"q": "survey", "type": "surveys"}).json()}
    assert surveys <= everything


# ---- GET /api/templates/{slug} -----------------------------------------------------------------------------------


@pytest.mark.parametrize("slug", SLUGS)
def test_template_detail(client, slug):
    res = client.get(f"/api/templates/{slug}")
    assert res.status_code == 200
    body = res.json()
    raw = _raw(slug)
    assert body["slug"] == slug
    assert [(q["type"], q["title"]) for q in body["questions"]] == [(q["type"], q["title"]) for q in raw["questions"]]
    assert all(set(q) >= {"type", "title", "description", "required"} for q in body["questions"])
    assert len(body["endings"]) == len(raw["endings"])
    assert body["question_count"] == len(body["questions"])


def test_template_detail_unknown_slug_is_404(client):
    res = client.get("/api/templates/no-such-template")
    assert res.status_code == 404
    assert res.json() == {"detail": "Template not found"}


# ---- POST /api/forms/from-template/{slug} ------------------------------------------------------------------------


@pytest.mark.parametrize("slug", SLUGS)
def test_from_template_creates_a_valid_draft_form(client, slug):
    raw = _raw(slug)
    res = client.post(f"/api/forms/from-template/{slug}")
    assert res.status_code == 201, res.text
    body = res.json()
    form = FormOut.model_validate(body)  # same schema as a manually created form

    assert form.status == "draft"
    assert form.title == raw["title"]
    assert form.description == raw["description"]
    assert form.response_count == 0
    assert [q.type for q in form.questions] == [q["type"] for q in raw["questions"]]
    assert [q.title for q in form.questions] == [q["title"] for q in raw["questions"]]
    assert [q.position for q in form.questions] == list(range(len(raw["questions"])))
    assert [e.position for e in form.endings] == list(range(len(raw["endings"])))
    assert [e.title for e in form.endings] == [e["title"] for e in raw["endings"]]
    assert form.welcome.button_text == raw.get("welcome", {}).get("button_text", "Start")
    for question, source in zip(form.questions, raw["questions"], strict=True):
        assert question.required == (source.get("required", False) and question.type != QuestionType.STATEMENT)
        assert question.logic is None
        validate_properties(question.type, question.properties)
    # The theme was copied from the gallery theme the template names.
    detail = client.get(f"/api/templates/{slug}").json()
    assert body["theme"] == detail["theme"]

    # It is a real form: it appears in the workspace and can be fetched.
    assert client.get(f"/api/forms/{form.id}").json()["title"] == raw["title"]
    assert form.id in {f["id"] for f in client.get("/api/forms").json()}


@pytest.mark.parametrize("slug", SLUGS)
def test_form_from_template_publishes_and_takes_a_response(client, slug):
    form = client.post(f"/api/forms/from-template/{slug}").json()
    assert client.post(f"/api/forms/{form['id']}/responses/test").status_code == 201
    published = client.post(f"/api/forms/{form['id']}/publish")
    assert published.status_code == 200
    public = client.get(f"/api/public/forms/{form['slug']}")
    assert public.status_code == 200
    assert len(public.json()["questions"]) == len(form["questions"])


def test_each_use_makes_an_independent_form(client):
    slug = SLUGS[0]
    a = client.post(f"/api/forms/from-template/{slug}").json()
    b = client.post(f"/api/forms/from-template/{slug}").json()
    assert a["id"] != b["id"] and a["slug"] != b["slug"]
    assert {q["id"] for q in a["questions"]}.isdisjoint({q["id"] for q in b["questions"]})
    client.patch(f"/api/forms/{a['id']}", json={"title": "Changed"})
    assert client.get(f"/api/forms/{b['id']}").json()["title"] == _raw(slug)["title"]


def test_from_template_unknown_slug_is_404_and_creates_nothing(client):
    before = len(client.get("/api/forms").json())
    res = client.post("/api/forms/from-template/no-such-template")
    assert res.status_code == 404
    assert res.json() == {"detail": "Template not found"}
    assert len(client.get("/api/forms").json()) == before


def test_from_template_does_not_shadow_form_routes(client, make_form):
    # "publish"/"duplicate" are real sub-routes of /forms/{id}; a template slug can't collide with them.
    form = make_form()
    assert client.post(f"/api/forms/{form['id']}/duplicate").status_code == 201
    assert client.post("/api/forms/from-template/duplicate").status_code == 404
