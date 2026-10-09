"""Video: video questions (Question → Video, the video *is* the question) and videos as a question's media."""

VIDEO = {"url": "https://res.cloudinary.com/demo/video/upload/v1/q.mp4", "public_id": "q"}


def test_a_question_can_switch_to_video_and_hold_its_video(client, make_form, add_question) -> None:
    form = make_form()
    q = add_question(form["id"], "multiple_choice")
    props = {**q["properties"], "video_question": True}
    res = client.patch(f"/api/questions/{q['id']}", json={"properties": props})
    assert res.status_code == 200, res.text
    assert res.json()["properties"]["video_question"] is True

    props["video"] = VIDEO
    saved = client.patch(f"/api/questions/{q['id']}", json={"properties": props}).json()["properties"]
    assert saved["video"] == VIDEO

    # The public form carries it, so respondents see the video.
    client.post(f"/api/forms/{form['id']}/publish")
    public = client.get(f"/api/public/forms/{form['slug']}").json()["questions"][0]["properties"]
    assert public["video_question"] is True and public["video"]["url"] == VIDEO["url"]


def test_a_question_video_must_be_a_web_address(client, make_form, add_question) -> None:
    form = make_form()
    q = add_question(form["id"], "short_text")
    bad = {**q["properties"], "video": {"url": "javascript:alert(1)", "public_id": "x"}}
    assert client.patch(f"/api/questions/{q['id']}", json={"properties": bad}).status_code == 422


def test_video_can_be_a_questions_media_attachment(client, make_form, add_question) -> None:
    form = make_form()
    q = add_question(form["id"], "short_text")
    props = {**q["properties"], "attachment": {"type": "video", "public_id": "bg", "url": VIDEO["url"], "alt": "Waves"}}
    saved = client.patch(f"/api/questions/{q['id']}", json={"properties": props}).json()["properties"]
    assert saved["attachment"]["type"] == "video"


def test_media_signature_for_video_uploads(client, monkeypatch) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "cloudinary_cloud_name", "testcloud")
    monkeypatch.setattr(settings, "cloudinary_api_key", "testkey")
    monkeypatch.setattr(settings, "cloudinary_api_secret", "testsecret")
    res = client.post("/api/media/sign", json={"resource_type": "video"})
    assert res.json()["upload_url"] == "https://api.cloudinary.com/v1_1/testcloud/video/upload"
    # Images stay the default (and the body is optional, as before).
    assert client.post("/api/media/sign").json()["upload_url"].endswith("/image/upload")
