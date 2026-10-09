from fastapi.testclient import TestClient

def test_sign_upload_without_keys_returns_fake_server(client: TestClient, monkeypatch) -> None:
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "cloudinary_api_secret", "")

    res = client.post("/api/media/sign")
    assert res.status_code == 200
    data = res.json()
    assert data["upload_url"] == "http://localhost:8101/image/upload"
    assert data["api_key"] == "fake_key"
    assert data["signature"] == "fake_signature"

def test_sign_upload_with_keys_returns_cloudinary_url(client: TestClient, monkeypatch) -> None:
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "cloudinary_cloud_name", "testcloud")
    monkeypatch.setattr(settings, "cloudinary_api_key", "testkey")
    monkeypatch.setattr(settings, "cloudinary_api_secret", "testsecret")

    res = client.post("/api/media/sign")
    assert res.status_code == 200
    data = res.json()
    assert data["upload_url"] == "https://api.cloudinary.com/v1_1/testcloud/image/upload"
    assert data["api_key"] == "testkey"
    assert "signature" in data
    assert "timestamp" in data
