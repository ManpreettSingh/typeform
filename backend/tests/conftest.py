import os
import tempfile
from pathlib import Path

# Must run before any `app` import: the engine is built from settings at import time.
_TEST_DB = Path(tempfile.mkdtemp(prefix="typeform-tests-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"

from collections.abc import Iterator  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db() -> Iterator[None]:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


@pytest.fixture
def make_form(client: TestClient):
    def _make(title: str = "Test form") -> dict[str, Any]:
        res = client.post("/api/forms", json={"title": title})
        assert res.status_code == 201, res.text
        return res.json()

    return _make


@pytest.fixture
def add_question(client: TestClient):
    def _add(form_id: int, type: str = "short_text", **fields: Any) -> dict[str, Any]:
        res = client.post(f"/api/forms/{form_id}/questions", json={"type": type, **fields})
        assert res.status_code == 201, res.text
        return res.json()

    return _add
