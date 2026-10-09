"""POST /api/ai/apply: saves a reviewed proposal in one transaction."""

import pytest
from sqlalchemy import select

from app.models import Answer, Form, Question, Response
from app.services import ai_form
from app.services.ai_schemas import ProposalEnding, ProposalQuestion


def current(db, form_id):
    db.expire_all()
    return ai_form.form_to_proposal(db.get(Form, form_id))


def apply(client, form_id, proposal):
    return client.post("/api/ai/apply", json={"form_id": form_id, "proposal": proposal.model_dump(mode="json")})


def new_q(qtype, title, **props):
    from app.models.enums import QuestionType
    from app.schemas.properties import default_properties

    return ProposalQuestion(id=None, type=qtype, title=title, properties={**default_properties(QuestionType(qtype)), **props})


@pytest.fixture
def form3(client, make_form, add_question):
    form = make_form("Survey")
    qs = [add_question(form["id"], "short_text", title=t) for t in ("A", "B", "C")]
    return form, qs


def titles(client, form_id):
    return [q["title"] for q in client.get(f"/api/forms/{form_id}").json()["questions"]]


def test_apply_edits_adds_deletes_and_reorders_in_one_go(client, db, form3):
    form, (a, b, c) = form3
    p = current(db, form["id"])
    by_id = {q.id: q for q in p.questions}
    by_id[a["id"]].title = "A renamed"
    by_id[a["id"]].required = True
    p.questions = [by_id[c["id"]], by_id[a["id"]], new_q("email", "Email?")]  # B removed, C first, one new

    res = apply(client, form["id"], p)

    assert res.status_code == 200, res.text
    out = res.json()
    assert [q["title"] for q in out["questions"]] == ["C", "A renamed", "Email?"]
    assert [q["position"] for q in out["questions"]] == [0, 1, 2]
    assert out["questions"][1]["required"] is True and out["questions"][1]["id"] == a["id"]   # edited in place, same row
    assert out["questions"][2]["type"] == "email"
    assert b["id"] not in {q["id"] for q in out["questions"]}


def test_apply_updates_the_welcome_and_endings(client, db, form3):
    form, _ = form3
    p = current(db, form["id"])
    p.welcome.title = "Renamed survey"
    p.welcome.description = "Thanks for helping."
    p.welcome.button_text = "Let's go"
    first = p.endings[0]
    first.title, first.message = "All done", "See you soon"
    p.endings = [first, ProposalEnding(id=None, title="Second", message="Another")]

    out = apply(client, form["id"], p).json()

    assert (out["title"], out["description"]) == ("Renamed survey", "Thanks for helping.")
    assert out["welcome"]["button_text"] == "Let's go"
    assert [(e["title"], e["position"]) for e in out["endings"]] == [("All done", 0), ("Second", 1)]
    assert out["endings"][0]["id"] == first.id


def test_apply_can_replace_and_remove_endings(client, db, form3):
    form, _ = form3
    p = current(db, form["id"])
    p.endings = [ProposalEnding(id=None, title="Only one", message="m")]
    out = apply(client, form["id"], p).json()
    assert [e["title"] for e in out["endings"]] == ["Only one"]


def test_apply_without_a_form_creates_a_draft(client):
    from app.services.ai_chat import empty_proposal

    p = empty_proposal()
    p.welcome.title = "AI form"
    p.questions = [new_q("short_text", "Name?"), new_q("rating", "Rate us", max=7, shape="heart")]
    res = client.post("/api/ai/apply", json={"form_id": None, "proposal": p.model_dump(mode="json")})

    assert res.status_code == 200, res.text
    out = res.json()
    assert out["title"] == "AI form" and out["status"] == "draft" and out["slug"]
    assert [q["title"] for q in out["questions"]] == ["Name?", "Rate us"]
    assert out["questions"][1]["properties"] == {"max": 7, "shape": "heart"}
    assert len(out["endings"]) == 1
    assert len(client.get("/api/forms").json()) == 1


def test_an_invalid_proposal_changes_nothing(client, db, form3):
    form, (a, _b, _c) = form3
    p = current(db, form["id"])
    p.questions[0].title = "Should not be saved"
    p.questions.append(new_q("rating", "Bad rating", max=99))   # fails validation after the first edit would have applied

    res = apply(client, form["id"], p)

    assert res.status_code == 422
    assert titles(client, form["id"]) == ["A", "B", "C"]


def test_a_failed_new_form_leaves_no_form_behind(client):
    from app.services.ai_chat import empty_proposal

    p = empty_proposal()
    p.questions = [new_q("rating", "Bad", max=99)]
    assert client.post("/api/ai/apply", json={"form_id": None, "proposal": p.model_dump(mode="json")}).status_code == 422
    assert client.get("/api/forms").json() == []


def test_ids_from_another_form_are_rejected(client, db, form3, make_form, add_question):
    form, _ = form3
    other = make_form("Other")
    foreign = add_question(other["id"], "short_text", title="Foreign")
    p = current(db, form["id"])
    p.questions.append(ProposalQuestion(id=foreign["id"], type="short_text", title="Foreign", properties={}))

    assert apply(client, form["id"], p).status_code == 422
    assert titles(client, form["id"]) == ["A", "B", "C"]
    assert titles(client, other["id"]) == ["Foreign"]


def test_an_ending_id_from_another_form_is_rejected(client, db, form3, make_form):
    form, _ = form3
    other = make_form("Other")
    p = current(db, form["id"])
    p.endings.append(ProposalEnding(id=other["endings"][0]["id"], title="x", message="y"))
    assert apply(client, form["id"], p).status_code == 422


def test_an_unknown_form_is_404(client):
    from app.services.ai_chat import empty_proposal

    res = client.post("/api/ai/apply", json={"form_id": 9999, "proposal": empty_proposal().model_dump(mode="json")})
    assert res.status_code == 404 and res.json()["detail"] == "Form not found"


def test_deleting_a_question_removes_its_answers_and_jumps_to_it(client, db, form3):
    form, (a, b, c) = form3
    assert client.patch(f"/api/questions/{a['id']}", json={"logic": {"rules": [{"op": "contains", "value": "x", "to": b["id"]}]}}).status_code == 200
    client.post(f"/api/forms/{form['id']}/publish")
    slug = client.get(f"/api/forms/{form['id']}").json()["slug"]
    assert client.post(f"/api/public/forms/{slug}/responses", json={"answers": {str(b["id"]): "hello"}}).status_code == 201

    p = current(db, form["id"])
    p.questions = [q for q in p.questions if q.id != b["id"]]
    assert apply(client, form["id"], p).status_code == 200

    db.expire_all()
    assert db.scalar(select(Answer).where(Answer.question_id == b["id"])) is None
    assert db.scalar(select(Response)) is not None                                  # the response itself stays
    assert db.get(Question, a["id"]).logic is None                                   # the jump to B is gone


def test_a_type_change_replaces_the_question(client, db, form3):
    form, (a, _b, _c) = form3
    p = current(db, form["id"])
    p.questions[0] = new_q("email", "A as email")
    out = apply(client, form["id"], p).json()
    assert [q["type"] for q in out["questions"]] == ["email", "short_text", "short_text"]
    assert a["id"] not in {q["id"] for q in out["questions"]}


def test_groups_survive_and_a_new_question_can_join_one(client, db, make_form, add_question):
    form = make_form("Grouped")
    add_question(form["id"], "short_text", title="Before")
    group = add_question(form["id"], "group", title="About you")
    inside = add_question(form["id"], "short_text", title="Name?")
    assert client.patch(f"/api/questions/{inside['id']}", json={"group_id": group["id"]}).status_code == 200

    p = current(db, form["id"])
    extra = new_q("number", "Age?")
    extra.group_id = group["id"]
    p.questions.append(extra)
    out = apply(client, form["id"], p).json()

    assert [(q["type"], q["title"], q["group_id"]) for q in out["questions"]] == [
        ("short_text", "Before", None), ("group", "About you", None), ("short_text", "Name?", group["id"]), ("number", "Age?", group["id"]),
    ]


def test_a_group_cannot_be_dropped_while_its_children_stay(client, db, make_form, add_question):
    form = make_form("Grouped")
    group = add_question(form["id"], "group", title="About you")
    inside = add_question(form["id"], "short_text", title="Name?")
    client.patch(f"/api/questions/{inside['id']}", json={"group_id": group["id"]})

    p = current(db, form["id"])
    p.questions = [q for q in p.questions if q.type != "group"]
    assert apply(client, form["id"], p).status_code == 422
    assert titles(client, form["id"]) == ["About you", "Name?"]


def test_applying_the_current_form_changes_nothing(client, db, form3):
    form, _ = form3
    before = client.get(f"/api/forms/{form['id']}").json()
    assert apply(client, form["id"], current(db, form["id"])).status_code == 200
    after = client.get(f"/api/forms/{form['id']}").json()
    assert [q["id"] for q in after["questions"]] == [q["id"] for q in before["questions"]]
    assert [q["properties"] for q in after["questions"]] == [q["properties"] for q in before["questions"]]
