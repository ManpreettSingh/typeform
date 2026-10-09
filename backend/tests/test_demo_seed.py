"""SEED_DEMO_DATA: the hosted demo seeds its demo forms at startup (app/main.py lifespan)."""

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

DEMO_SLUGS = {"demo-feedback", "demo-event", "demo-draft"}


def _slugs(client: TestClient) -> set[str]:
    return {f["slug"] for f in client.get("/api/forms").json()}


def test_startup_seeds_demo_forms_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "seed_demo_data", True)
    with TestClient(app) as client:
        assert DEMO_SLUGS <= _slugs(client)
        assert client.get("/api/public/forms/demo-feedback").status_code == 200
        first = {f["slug"]: f["response_count"] for f in client.get("/api/forms").json()}

    # A restart (every deploy) adds nothing twice.
    with TestClient(app) as client:
        again = {f["slug"]: f["response_count"] for f in client.get("/api/forms").json()}
    assert again == first


def test_startup_leaves_the_database_alone_by_default(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "seed_demo_data", False)
    with TestClient(app) as client:
        assert not DEMO_SLUGS & _slugs(client)
