from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app

client = TestClient(app)


def test_health_ok():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_cors_allows_frontend_origin():
    res = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_sqlite_foreign_keys_enabled():
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
