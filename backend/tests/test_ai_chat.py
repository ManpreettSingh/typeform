"""POST /api/ai/chat and /api/ai/memory: Gemini is always faked; the real key is never used in tests."""

import json

import pytest

from app.core.config import get_settings
from app.services import ai_client


class _Resp:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text or json.dumps(payload or {})

    def json(self):
        return self._payload


def gemini_body(answer: dict) -> _Resp:
    return _Resp(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(answer)}]}}]})


@pytest.fixture
def gemini(monkeypatch):
    """A configured key, recorded calls, and `.answer` = the JSON the fake model returns (or an Exception / _Resp)."""
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")
    state = {"calls": [], "answer": {"reply": "Done.", "form": None}}

    def fake_post(url, headers, json, timeout):
        state["calls"].append({"url": url, "headers": headers, "json": json})
        answer = state["answer"]
        if isinstance(answer, Exception):
            raise answer
        return answer if isinstance(answer, _Resp) else gemini_body(answer)

    monkeypatch.setattr(ai_client.httpx, "post", fake_post)
    return state


def user(text):
    return {"role": "user", "content": text}


def model_form(questions, title="New form", endings=None):
    return {
        "title": title,
        "description": None,
        "questions": questions,
        "endings": endings if endings is not None else [],
    }


def chat(client, **body):
    return client.post("/api/ai/chat", json=body)


def saved_form(client, make_form, add_question):
    form = make_form("Cafe")
    q = add_question(form["id"], "short_text", title="Name?")
    return form, q


def sent_system_text(gemini):
    return gemini["calls"][-1]["json"]["systemInstruction"]["parts"][0]["text"]


# ---- the happy path ------------------------------------------------------------------------------------------------


def test_chat_returns_reply_proposal_and_diff_and_leaves_the_form_alone(client, make_form, add_question, gemini):
    form, q = saved_form(client, make_form, add_question)
    gemini["answer"] = {
        "reply": "I added an email question.",
        "form": model_form(
            [{"id": q["id"], "type": "short_text", "title": "Name?"}, {"type": "email", "title": "Email?", "required": True}],
            title="Cafe",
        ),
    }
    res = chat(client, form_id=form["id"], messages=[user("add an email question")])

    assert res.status_code == 200, res.text
    out = res.json()
    assert out["reply"] == "I added an email question."
    assert [(x["id"], x["type"]) for x in out["proposal"]["questions"]] == [(q["id"], "short_text"), (None, "email")]
    assert [(c["title"], c["change"]) for c in out["diff"]["to_set"]] == [("Email?", "new")]
    assert out["diff"]["to_remove"] == []
    assert len(client.get(f"/api/forms/{form['id']}").json()["questions"]) == 1  # nothing saved


def test_chat_can_draft_a_brand_new_form(client, gemini):
    gemini["answer"] = {
        "reply": "Here is a draft.",
        "form": model_form([{"type": "short_text", "title": "Your name?"}, {"type": "rating", "title": "Rate us"}], title="Feedback"),
    }
    out = chat(client, messages=[user("feedback form for my cafe")]).json()

    assert out["proposal"]["welcome"]["title"] == "Feedback"
    assert [q["type"] for q in out["proposal"]["questions"]] == ["short_text", "rating"]
    assert len(out["proposal"]["endings"]) == 1       # a form always has an ending
    assert len(out["diff"]["to_set"]) == 2 and all(c["change"] == "new" for c in out["diff"]["to_set"])
    assert client.get("/api/forms").json() == []        # nothing was created


def test_a_question_or_refusal_gives_a_reply_and_no_proposal(client, make_form, add_question, gemini):
    form, _ = saved_form(client, make_form, add_question)
    gemini["answer"] = {"reply": "Changing the theme isn't supported yet.", "form": None}
    out = chat(client, form_id=form["id"], messages=[user("make it purple")]).json()
    assert out == {"reply": "Changing the theme isn't supported yet.", "proposal": None, "diff": None}


def test_a_turn_that_changes_nothing_gives_no_proposal(client, make_form, add_question, gemini):
    form, q = saved_form(client, make_form, add_question)
    gemini["answer"] = {"reply": "It already looks good.", "form": model_form([{"id": q["id"], "type": "short_text", "title": "Name?"}], title="Cafe")}
    gemini["answer"]["form"]["endings"] = [{"id": form["endings"][0]["id"], "title": form["endings"][0]["title"], "message": form["endings"][0]["message"]}]
    out = chat(client, form_id=form["id"], messages=[user("looks fine?")]).json()
    assert out["proposal"] is None and out["diff"] is None


def test_notes_about_skipped_items_are_added_to_the_reply(client, gemini):
    gemini["answer"] = {"reply": "Drafted.", "form": model_form([{"type": "nonsense", "title": "?"}, {"type": "short_text", "title": "Name?"}])}
    out = chat(client, messages=[user("x")]).json()
    assert out["reply"].startswith("Drafted.") and "skipped" in out["reply"]
    assert [q["title"] for q in out["proposal"]["questions"]] == ["Name?"]


# ---- what Gemini is sent -------------------------------------------------------------------------------------------


def test_gemini_gets_the_form_the_memory_and_the_conversation(client, make_form, add_question, gemini):
    form, _ = saved_form(client, make_form, add_question)
    assert client.put("/api/ai/memory", json={"content": "We run a bakery in Lisbon."}).status_code == 200
    chat(client, form_id=form["id"], messages=[user("hi"), {"role": "assistant", "content": "Hello!"}, user("add a phone question")])

    call = gemini["calls"][0]
    assert "gemini-3.5-flash-lite:generateContent" in call["url"] and call["headers"] == {"x-goog-api-key": "test-key"}
    system = sent_system_text(gemini)
    assert "Name?" in system and "We run a bakery in Lisbon." in system
    assert [c["role"] for c in call["json"]["contents"]] == ["user", "model", "user"]
    assert call["json"]["contents"][2]["parts"][0]["text"] == "add a phone question"
    assert call["json"]["generationConfig"]["responseSchema"]["properties"]["form"]


def test_the_draft_under_review_is_what_the_next_turn_builds_on(client, make_form, add_question, gemini):
    form, q = saved_form(client, make_form, add_question)
    gemini["answer"] = {"reply": "ok", "form": model_form([{"id": q["id"], "type": "short_text", "title": "Name?"}, {"type": "email", "title": "Email?"}], title="Cafe")}
    first = chat(client, form_id=form["id"], messages=[user("add email")]).json()

    gemini["answer"] = {"reply": "ok", "form": model_form([{"id": q["id"], "type": "short_text", "title": "Name?"}, {"type": "email", "title": "Email?"}, {"type": "number", "title": "Age?"}], title="Cafe")}
    second = chat(client, form_id=form["id"], messages=[user("add email"), {"role": "assistant", "content": "ok"}, user("and age")], draft=first["proposal"]).json()

    assert "Email?" in sent_system_text(gemini)                       # the draft, not just the saved form
    assert [d["title"] for d in second["diff"]["to_set"]] == ["Email?", "Age?"]  # diff is still against the saved form


def test_an_unsaved_memory_overrides_the_stored_one(client, gemini):
    client.put("/api/ai/memory", json={"content": "stored note"})
    chat(client, messages=[user("hi")], memory="typed but not saved")
    assert "typed but not saved" in sent_system_text(gemini) and "stored note" not in sent_system_text(gemini)


# ---- errors --------------------------------------------------------------------------------------------------------


def test_chat_validates_the_request(client, gemini):
    assert chat(client, messages=[]).status_code == 422
    assert chat(client, messages=[user("hi"), {"role": "assistant", "content": "yo"}]).status_code == 422
    assert chat(client, form_id=9999, messages=[user("hi")]).status_code == 404
    assert gemini["calls"] == []


def test_gemini_failures_are_friendly(client, gemini):
    gemini["answer"] = _Resp(500, text="boom")
    res = chat(client, messages=[user("hi")])
    assert res.status_code == 502 and "couldn't answer" in res.json()["detail"]


def test_a_missing_key_says_how_to_fix_it(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    res = chat(client, messages=[user("hi")])
    assert res.status_code == 503 and "GEMINI_API_KEY" in res.json()["detail"]


def test_an_unusable_answer_is_reported_not_crashed(client, gemini):
    gemini["answer"] = {"reply": "x", "form": {"title": "T", "questions": "not a list", "endings": "nope"}}
    out = chat(client, messages=[user("hi")]).json()
    assert out["reply"].startswith("x")


# ---- memory --------------------------------------------------------------------------------------------------------


def test_memory_defaults_to_empty_and_round_trips(client):
    assert client.get("/api/ai/memory").json() == {"content": "", "max_length": 2000}
    assert client.put("/api/ai/memory", json={"content": "Tone: friendly"}).json()["content"] == "Tone: friendly"
    assert client.get("/api/ai/memory").json()["content"] == "Tone: friendly"
    assert client.put("/api/ai/memory", json={"content": ""}).json()["content"] == ""


def test_memory_is_limited_to_2000_characters(client):
    assert client.put("/api/ai/memory", json={"content": "x" * 2001}).status_code == 422
    assert client.put("/api/ai/memory", json={"content": "x" * 2000}).status_code == 200


# ---- what the model is asked to return ------------------------------------------------------------------------------


def test_the_model_must_state_every_field_of_every_item():
    """A key the model may leave out is a change it can silently drop (real Gemini omitted ids and rating settings)."""
    from app.services.ai_chat import RESPONSE_SCHEMA

    form = RESPONSE_SCHEMA["properties"]["form"]
    question = form["properties"]["questions"]["items"]
    ending = form["properties"]["endings"]["items"]
    assert set(question["required"]) == set(question["properties"])
    assert set(ending["required"]) == set(ending["properties"])
    assert {"title", "description", "questions", "endings"} <= set(form["required"])
    # optional-by-meaning fields are nullable instead of omittable
    for key in ("id", "description", "options", "allow_multiple", "rating_max", "rating_shape"):
        assert question["properties"][key].get("nullable") is True, key
