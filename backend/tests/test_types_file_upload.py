"""File upload question type: the stored answer, validation, results, CSV, and the public upload signature."""

import pytest

from app.question_types import AnswerError, get_spec

URL = "https://res.cloudinary.com/demo/raw/upload/v1/responses/abc/cv.pdf"
FILE = {"url": URL, "name": "cv.pdf", "size": 120_000, "type": "application/pdf"}
MB = 1024 * 1024


def validate(value):
    spec = get_spec("file_upload")
    return spec.validate(value, spec.defaults())


def test_accepts_an_uploaded_file_and_keeps_only_known_fields() -> None:
    assert validate({**FILE, "extra": "dropped"}) == FILE


def test_type_is_optional() -> None:
    assert validate({k: v for k, v in FILE.items() if k != "type"}) == {"url": URL, "name": "cv.pdf", "size": 120_000}


@pytest.mark.parametrize(
    "value",
    [
        "cv.pdf",
        {"name": "cv.pdf", "size": 1},
        {**FILE, "url": "javascript:alert(1)"},
        {**FILE, "url": "ftp://example.com/cv.pdf"},
        {**FILE, "name": ""},
        {**FILE, "name": "x" * 256},
        {**FILE, "size": -1},
        {**FILE, "size": "big"},
        {**FILE, "size": True},
    ],
)
def test_rejects_anything_that_is_not_an_uploaded_file(value) -> None:
    with pytest.raises(AnswerError):
        validate(value)


def test_rejects_files_over_10_mb_like_typeform() -> None:
    assert validate({**FILE, "size": 10 * MB})["size"] == 10 * MB
    with pytest.raises(AnswerError, match="10MB"):
        validate({**FILE, "size": 10 * MB + 1})


def test_format_is_the_file_name_and_link() -> None:
    spec = get_spec("file_upload")
    assert spec.format(FILE, {}) == f"cv.pdf ({URL})"


def test_no_branching_on_files() -> None:
    assert get_spec("file_upload").logic_ops == frozenset()


# ---- through the API -------------------------------------------------------------------------------------------


def _published_form_with_file(client, make_form, add_question, required=True):
    form = make_form()
    q = add_question(form["id"], "file_upload", title="Upload your CV", required=required)
    client.post(f"/api/forms/{form['id']}/publish")
    return form, q


def test_required_file_question_rejects_a_missing_file(client, make_form, add_question) -> None:
    form, q = _published_form_with_file(client, make_form, add_question)
    res = client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {}})
    assert res.status_code == 422
    assert str(q["id"]) in res.json()["detail"]["errors"]


def test_a_submitted_file_shows_in_results_summary_and_csv(client, make_form, add_question) -> None:
    form, q = _published_form_with_file(client, make_form, add_question)
    res = client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {str(q["id"]): FILE}})
    assert res.status_code == 201, res.text

    summary = client.get(f"/api/forms/{form['id']}/summary").json()["questions"][0]
    assert summary["type"] == "file_upload"
    assert summary["answered"] == 1
    assert summary["files"][0]["name"] == "cv.pdf" and summary["files"][0]["url"] == URL

    csv = client.get(f"/api/forms/{form['id']}/responses/export.csv").text
    assert f"cv.pdf ({URL})" in csv


def test_upload_signature_for_a_published_form_with_a_file_question(client, make_form, add_question, monkeypatch) -> None:
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "cloudinary_cloud_name", "testcloud")
    monkeypatch.setattr(settings, "cloudinary_api_key", "testkey")
    monkeypatch.setattr(settings, "cloudinary_api_secret", "testsecret")
    form, _ = _published_form_with_file(client, make_form, add_question)

    res = client.post(f"/api/public/forms/{form['slug']}/uploads")
    assert res.status_code == 200
    data = res.json()
    # "auto" lets Cloudinary take any file (PDFs, documents…), not just images.
    assert data["upload_url"] == "https://api.cloudinary.com/v1_1/testcloud/auto/upload"
    assert data["folder"] == f"responses/{form['slug']}"
    assert data["max_bytes"] == 10 * 1024 * 1024


def test_upload_signature_without_keys_points_at_the_fake_server(client, make_form, add_question, monkeypatch) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "cloudinary_api_secret", "")
    form, _ = _published_form_with_file(client, make_form, add_question)
    assert client.post(f"/api/public/forms/{form['slug']}/uploads").json()["upload_url"] == "http://localhost:8101/auto/upload"


def test_no_upload_signature_for_drafts_or_forms_without_a_file_question(client, make_form, add_question) -> None:
    draft = make_form()
    add_question(draft["id"], "file_upload", title="CV")
    assert client.post(f"/api/public/forms/{draft['slug']}/uploads").status_code == 404

    plain = make_form()
    add_question(plain["id"], "short_text", title="Name")
    client.post(f"/api/forms/{plain['id']}/publish")
    assert client.post(f"/api/public/forms/{plain['slug']}/uploads").status_code == 404
