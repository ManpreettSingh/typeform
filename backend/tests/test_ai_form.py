"""The AI chat's conversion layer: saved form <-> proposal <-> what Gemini sees, and the diff shown for review."""

import pytest

from app.models.enums import QuestionType
from app.schemas.properties import default_properties
from app.services import ai_form
from app.services.ai_schemas import Proposal, ProposalEnding, ProposalQuestion, ProposalWelcome


def pq(qid, qtype, title="", **kw):
    props = kw.pop("properties", None)
    return ProposalQuestion(id=qid, type=qtype, title=title, properties=props if props is not None else default_properties(QuestionType(qtype)), **kw)


def options(*pairs):
    return [{"id": i, "label": label} for i, label in pairs]


def proposal(questions, endings=None, title="My form"):
    return Proposal(
        welcome=ProposalWelcome(title=title),
        questions=questions,
        endings=endings or [ProposalEnding(id=100, title="Thanks", message="Bye")],
    )


def ai(questions, **extra):
    return {"title": "My form", "description": None, "questions": questions, "endings": [{"id": 100, "title": "Thanks", "message": "Bye"}], **extra}


# ---- saved form -> proposal -> model view --------------------------------------------------------------------------


def test_form_to_proposal_reads_the_saved_form(client, db, make_form, add_question):
    from app.models import Form

    form = make_form("Cafe survey")
    q = add_question(form["id"], "rating", title="How was it?", required=True, properties={"max": 7, "shape": "heart"})
    saved = db.get(Form, form["id"])
    p = ai_form.form_to_proposal(saved)

    assert p.welcome.title == "Cafe survey"
    assert [(x.id, x.type, x.title, x.required) for x in p.questions] == [(q["id"], "rating", "How was it?", True)]
    assert p.questions[0].properties == {"max": 7, "shape": "heart"}
    assert len(p.endings) == 1 and p.endings[0].id == saved.endings[0].id


def test_model_view_flattens_choice_options_and_hides_property_noise():
    p = proposal([
        pq(1, "multiple_choice", "Colour?", properties={"options": options(("a", "Red"), ("b", "Blue")), "allow_multiple": True, "allow_other": True}),
        pq(2, "rating", "Score?", properties={"max": 7, "shape": "heart"}),
        pq(3, "short_text", "Name?"),
    ])
    view = ai_form.proposal_to_ai(p)

    q1, q2, q3 = view["questions"]
    assert q1 == {"id": 1, "type": "multiple_choice", "title": "Colour?", "description": None, "required": False, "options": ["Red", "Blue"], "allow_multiple": True}
    assert q2["rating_max"] == 7 and q2["rating_shape"] == "heart" and "options" not in q2
    assert set(q3) == {"id", "type", "title", "description", "required"}
    assert view["endings"] == [{"id": 100, "title": "Thanks", "message": "Bye"}]


# ---- model output -> proposal --------------------------------------------------------------------------------------


def test_an_unchanged_question_keeps_every_stored_property():
    base = proposal([pq(1, "multiple_choice", "Colour?", properties={
        "options": options(("a", "Red"), ("b", "Blue")), "allow_multiple": False, "allow_other": True, "randomize": True,
    })])
    out, notes = ai_form.ai_to_proposal(ai([{"id": 1, "type": "multiple_choice", "title": "Colour?", "options": ["Red", "Blue"], "allow_multiple": False}]), base)

    assert out.questions[0].id == 1
    assert out.questions[0].properties == base.questions[0].properties
    assert notes == []


def test_edited_options_keep_the_ids_of_surviving_labels():
    base = proposal([pq(1, "multiple_choice", "Colour?", properties={"options": options(("r", "Red"), ("b", "Blue")), "allow_other": True})])
    out, _ = ai_form.ai_to_proposal(ai([{"id": 1, "type": "multiple_choice", "title": "Colour?", "options": ["Red", "Green"]}]), base)

    opts = out.questions[0].properties["options"]
    assert [o["label"] for o in opts] == ["Red", "Green"]
    assert opts[0]["id"] == "r"                      # kept: its answers and rules still point at it
    assert opts[1]["id"] not in {"r", "b"} and opts[1]["id"]  # new
    assert out.questions[0].properties["allow_other"] is True


def test_a_new_question_gets_valid_defaults():
    out, _ = ai_form.ai_to_proposal(ai([
        {"type": "rating", "title": "Rate us", "rating_max": 50, "rating_shape": "heart"},
        {"type": "dropdown", "title": "Branch?", "options": ["North", " ", "South"]},
        {"type": "email", "title": "Email?", "required": True},
    ]), proposal([]))

    rating, dropdown, email = out.questions
    assert rating.id is None and rating.properties == {"max": 10, "shape": "heart"}
    assert [o["label"] for o in dropdown.properties["options"]] == ["North", "South"]
    assert all(o["id"] for o in dropdown.properties["options"])
    assert email.required is True and email.properties == default_properties(QuestionType.EMAIL)


def test_a_new_choice_question_without_options_gets_a_valid_fallback():
    out, _ = ai_form.ai_to_proposal(ai([{"type": "multiple_choice", "title": "Pick one"}]), proposal([]))
    assert len(out.questions[0].properties["options"]) >= 2


def test_changing_the_type_replaces_the_question():
    base = proposal([pq(1, "short_text", "Contact?")])
    out, _ = ai_form.ai_to_proposal(ai([{"id": 1, "type": "email", "title": "Contact?"}]), base)
    assert out.questions[0].id is None and out.questions[0].type == QuestionType.EMAIL
    d = ai_form.diff(base, out)
    assert [r.id for r in d.to_remove] == [1] and [c.change for c in d.to_set] == ["new"]


def test_an_unknown_id_is_treated_as_new():
    out, _ = ai_form.ai_to_proposal(ai([{"id": 999, "type": "short_text", "title": "Name?"}]), proposal([]))
    assert out.questions[0].id is None


def test_invalid_or_unsupported_new_questions_are_dropped_with_a_note():
    out, notes = ai_form.ai_to_proposal(ai([
        {"type": "nonsense", "title": "?"},
        {"type": "group", "title": "Section"},
        {"type": "picture_choice", "title": "Pick a picture"},
        {"type": "short_text", "title": "Name?"},
    ]), proposal([]))
    assert [q.title for q in out.questions] == ["Name?"]
    assert len(notes) == 3


def test_questions_are_capped():
    items = [{"type": "short_text", "title": f"Q{i}"} for i in range(80)]
    out, notes = ai_form.ai_to_proposal(ai(items), proposal([]))
    assert len(out.questions) == ai_form.MAX_QUESTIONS and notes


def test_a_group_the_model_forgot_is_put_back_before_its_first_child():
    group = pq(10, "group", "About you")
    child = pq(11, "short_text", "Name?", group_id=10)
    base = proposal([pq(1, "email", "Email?"), group, child])
    out, _ = ai_form.ai_to_proposal(ai([{"id": 1, "type": "email", "title": "Email?"}, {"id": 11, "type": "short_text", "title": "Name?"}]), base)

    assert [q.id for q in out.questions] == [1, 10, 11]
    assert out.questions[2].group_id == 10


def test_a_new_question_between_a_groups_children_joins_the_group():
    group = pq(10, "group", "About you")
    a, b = pq(11, "short_text", "Name?", group_id=10), pq(12, "short_text", "City?", group_id=10)
    base = proposal([group, a, b])
    out, _ = ai_form.ai_to_proposal(ai([
        {"id": 10, "type": "group", "title": "About you"}, {"id": 11, "type": "short_text", "title": "Name?"},
        {"type": "number", "title": "Age?"}, {"id": 12, "type": "short_text", "title": "City?"},
    ]), base)
    assert out.questions[2].id is None and out.questions[2].group_id == 10


def test_welcome_and_endings_follow_the_model_and_keep_at_least_one_ending():
    base = proposal([pq(1, "short_text", "Name?")], title="Old")
    out, _ = ai_form.ai_to_proposal({"title": "Fresh title", "description": "Hello!", "questions": [{"id": 1, "type": "short_text", "title": "Name?"}],
                                     "endings": [{"id": 100, "title": "Done", "message": "See you"}, {"title": "Extra", "message": "More"}]}, base)
    assert out.welcome.title == "Fresh title" and out.welcome.description == "Hello!"
    assert [(e.id, e.title) for e in out.endings] == [(100, "Done"), (None, "Extra")]

    none, _ = ai_form.ai_to_proposal({"title": "T", "questions": [], "endings": []}, base)
    assert [e.id for e in none.endings] == [100]


# ---- diff ----------------------------------------------------------------------------------------------------------


def test_diff_lists_removed_new_changed_and_moved():
    saved = proposal([pq(1, "short_text", "A"), pq(2, "short_text", "B"), pq(3, "short_text", "C"), pq(4, "short_text", "D")])
    new = proposal([pq(4, "short_text", "D"), pq(1, "short_text", "A!"), pq(None, "email", "Mail?"), pq(3, "short_text", "C")], title="Renamed")
    d = ai_form.diff(saved, new)

    assert [(r.id, r.title, r.position) for r in d.to_remove] == [(2, "B", 1)]
    by_title = {c.title: c for c in d.to_set}
    assert by_title["A!"].change == "changed" and by_title["A!"].fields == ["title"]
    assert by_title["Mail?"].change == "new"
    assert by_title["D"].change == "moved"          # jumped from last to first
    assert "C" not in by_title                      # untouched
    assert d.welcome == ["title"]
    assert not d.is_empty


def test_diff_of_identical_forms_is_empty():
    p = proposal([pq(1, "short_text", "A")])
    assert ai_form.diff(p, p).is_empty


def test_diff_covers_endings_and_property_changes():
    saved = proposal([pq(1, "multiple_choice", "Pick", properties={"options": options(("a", "X"), ("b", "Y"))})])
    new = Proposal(
        welcome=saved.welcome,
        questions=[pq(1, "multiple_choice", "Pick", properties={"options": options(("a", "X"), ("c", "Z"))})],
        endings=[ProposalEnding(id=None, title="New end", message="m")],
    )
    d = ai_form.diff(saved, new)
    assert d.to_set[0].change == "changed" and d.to_set[0].fields == ["options"]
    assert [e.id for e in d.endings.to_remove] == [100]
    assert [(e.title, e.change) for e in d.endings.to_set] == [("New end", "new")]


@pytest.mark.parametrize("bad", [None, "x", [], 5])
def test_ai_to_proposal_rejects_a_non_object(bad):
    with pytest.raises(ValueError):
        ai_form.ai_to_proposal(bad, proposal([]))
