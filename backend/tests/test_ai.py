import json

import httpx
import pytest

from app.core.config import get_settings
from app.services import ai as ai_service

GENERATED = {
    "title": "Coffee shop feedback",
    "description": "Tell us how your visit went.",
    "questions": [
        {"type": "short_text", "title": "What's your name?", "required": True},
        {"type": "rating", "title": "How was your coffee?", "rating_max": 50, "rating_shape": "star"},
        {"type": "multiple_choice", "title": "What did you order?", "options": ["Latte", " ", "Espresso"], "allow_multiple": True},
        {"type": "dropdown", "title": "Which branch?", "options": []},
        {"type": "email", "title": "Your email?"},
    ],
}


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict | None = None, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text or json.dumps(payload or {})

    def json(self):
        return self._payload


@pytest.fixture
def gemini(monkeypatch):
    """Configures a key and records calls; set `.reply` to change what Gemini answers."""
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key")
    state = {"calls": [], "reply": _FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": json.dumps(GENERATED)}]}}]})}

    def fake_post(url, headers, json, timeout):
        state["calls"].append({"url": url, "headers": headers, "json": json})
        if isinstance(state["reply"], Exception):
            raise state["reply"]
        return state["reply"]

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    return state


def test_generate_appends_questions_and_names_new_form(client, make_form, gemini):
    form = make_form("New form")
    res = client.post(f"/api/ai/forms/{form['id']}/questions", json={"prompt": "  feedback for my cafe  "})
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["title"] == "Coffee shop feedback"
    assert out["description"] == "Tell us how your visit went."
    assert [q["type"] for q in out["questions"]] == ["short_text", "rating", "multiple_choice", "dropdown", "email"]
    rating, choice, dropdown = out["questions"][1], out["questions"][2], out["questions"][3]
    assert rating["properties"] == {"max": 10, "shape": "star"}  # clamped to the allowed range
    assert [o["label"] for o in choice["properties"]["options"]] == ["Latte", "Espresso"]  # blank dropped
    assert choice["properties"]["allow_multiple"] is True
    assert len(dropdown["properties"]["options"]) == 2  # no options → a valid fallback
    assert out["questions"][0]["required"] is True

    call = gemini["calls"][0]
    assert "gemini-3.5-flash-lite:generateContent" in call["url"]
    assert call["headers"] == {"x-goog-api-key": "test-key"}
    assert call["json"]["contents"][0]["parts"][0]["text"] == "feedback for my cafe"


def test_generate_keeps_a_custom_title(client, make_form, add_question, gemini):
    form = make_form("My survey")
    add_question(form["id"], title="Existing")
    out = client.post(f"/api/ai/forms/{form['id']}/questions", json={"prompt": "x"}).json()
    assert out["title"] == "My survey"
    assert out["questions"][0]["title"] == "Existing"
    assert len(out["questions"]) == 6


def test_create_form_with_ai(client, gemini):
    res = client.post("/api/ai/forms", json={"prompt": "cafe feedback"})
    assert res.status_code == 201, res.text
    assert res.json()["title"] == "Coffee shop feedback"
    assert len(client.get("/api/forms").json()) == 1


def test_failed_generation_keeps_no_empty_form(client, gemini):
    gemini["reply"] = _FakeResponse(500, text="boom")
    res = client.post("/api/ai/forms", json={"prompt": "cafe feedback"})
    assert res.status_code == 502
    assert client.get("/api/forms").json() == []


@pytest.mark.parametrize(
    ("reply", "message"),
    [
        (_FakeResponse(400, text='{"error": {"message": "API key not valid", "status": "INVALID_ARGUMENT", "details": [{"reason": "API_KEY_INVALID"}]}}'), "rejected the API key"),
        (_FakeResponse(429, text="quota"), "rate limit"),
        (_FakeResponse(404, text="no model"), "GEMINI_MODEL"),
        (_FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]}), "didn't make sense"),
        (_FakeResponse(200, {"candidates": [{"content": {"parts": [{"text": '{"title": "x", "questions": []}'}]}}]}), "any questions"),
        (httpx.ConnectError("offline"), "Couldn't reach"),
    ],
)
def test_gemini_errors_are_explained(client, make_form, gemini, reply, message):
    gemini["reply"] = reply
    form = make_form()
    res = client.post(f"/api/ai/forms/{form['id']}/questions", json={"prompt": "x"})
    assert res.status_code == 502
    assert message in res.json()["detail"]
    assert client.get(f"/api/forms/{form['id']}").json()["questions"] == []


def test_without_a_key_ai_explains_setup(client, make_form, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    form = make_form()
    res = client.post(f"/api/ai/forms/{form['id']}/questions", json={"prompt": "x"})
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["detail"]


def test_prompt_is_required(client, make_form):
    form = make_form()
    assert client.post(f"/api/ai/forms/{form['id']}/questions", json={"prompt": ""}).status_code == 422
    assert client.post("/api/ai/forms/999/questions", json={"prompt": "x"}).status_code == 404
