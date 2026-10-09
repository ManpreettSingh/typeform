"""Ordered migrations upgrade an existing database in place (app/core/migrations.py).

The "old" database is created from tests/fixtures/schema_v1.sql (the previous release's schema) and filled with rows,
then upgraded exactly the way the app does it at startup: `create_all` for missing tables, then `apply_migrations`.
"""

import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app import models  # noqa: F401  (registers every table on Base.metadata)
from app.core.db import Base
from app.core.migrations import apply_migrations

FIXTURE = Path(__file__).parent / "fixtures" / "schema_v1.sql"
VIEWS_LINE = "\tviews INTEGER DEFAULT '0' NOT NULL, \n"

OLD_ROWS = [
    """INSERT INTO forms (id, slug, title, description, status, theme, thank_you, created_at, updated_at, views) VALUES
       (1, 'abc12345', 'Feedback', 'Welcome!', 'published', '{}',
        '{"title": "Thanks!", "message": "All done", "button_text": "Visit", "button_url": "https://example.com"}',
        '2026-10-01 10:00:00', '2026-10-01 10:00:00', 3),
       (2, 'def67890', 'Empty', NULL, 'draft', '{}', '{}', '2026-10-02 10:00:00', '2026-10-02 10:00:00', 0)""",
    """INSERT INTO questions (id, form_id, type, title, description, required, position, properties, logic) VALUES
       (1, 1, 'short_text', 'Name?', NULL, 1, 0, '{}', NULL),
       (2, 1, 'multiple_choice', 'Pick', NULL, 0, 1,
        '{"options": [{"id": "a", "label": "A"}], "allow_multiple": false, "allow_other": false}',
        '{"rules": [{"op": "is", "value": "a", "to": "end"}]}'),
       (3, 1, 'rating', 'Rate', NULL, 0, 2, '{"max": 5, "shape": "star"}', NULL)""",
    """INSERT INTO responses (id, form_id, status, started_at, submitted_at, meta) VALUES
       (1, 1, 'completed', '2026-10-03 09:00:00', '2026-10-03 09:01:00', NULL),
       (2, 1, 'partial', '2026-10-04 09:00:00', NULL, '{"token": "t"}')""",
    """INSERT INTO answers (id, response_id, question_id, value) VALUES
       (1, 1, 1, '"Ann"'), (2, 1, 3, '4'), (3, 2, 1, '"Bob"')""",
]


def _engine(path: Path) -> Engine:
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    @event.listens_for(engine, "connect")
    def _foreign_keys(dbapi_connection, _record) -> None:  # same pragma as app.core.db
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def _old_database(path: Path, *, with_views: bool = True) -> Engine:
    sql = FIXTURE.read_text(encoding="utf-8")
    if not with_views:
        assert VIEWS_LINE in sql
        sql = sql.replace(VIEWS_LINE, "")
    engine = _engine(path)
    raw = engine.raw_connection()
    try:
        raw.driver_connection.executescript(sql)
    finally:
        raw.close()
    with engine.begin() as conn:
        for statement in OLD_ROWS if with_views else [OLD_ROWS[0].replace(", views)", ")").replace(", 3),", "),").replace(", 0)", ")"), *OLD_ROWS[1:]]:
            conn.exec_driver_sql(statement)
    # The app calls create_all (missing tables only) and then migrates.
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def old_db(tmp_path: Path) -> Engine:
    return _old_database(tmp_path / "old.db")


def _dump(engine: Engine) -> dict:
    with engine.connect() as conn:
        schema = [r[0] for r in conn.exec_driver_sql("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name")]
        data = {
            table: [tuple(row) for row in conn.exec_driver_sql(f"SELECT * FROM {table} ORDER BY 1")]
            for table in ("forms", "questions", "responses", "answers", "endings")
        }
    return {"schema": schema, "data": data}


def _json(value):
    """JSON columns come back from raw SQL as stored: text for strings and objects, a number for numbers."""
    return json.loads(value) if isinstance(value, str) else value


def _columns(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}


def test_old_database_keeps_all_rows(old_db: Engine) -> None:
    apply_migrations(old_db)
    with old_db.connect() as conn:
        counts = {t: conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar() for t in ("forms", "questions", "responses", "answers")}
        values = [_json(r[0]) for r in conn.execute(text("SELECT value FROM answers ORDER BY id"))]
        logic = json.loads(conn.execute(text("SELECT logic FROM questions WHERE id = 2")).scalar())
        violations = conn.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
    assert counts == {"forms": 2, "questions": 3, "responses": 2, "answers": 3}
    assert values == ["Ann", 4, "Bob"]
    assert logic["rules"][0]["to"] == "end"
    assert violations == []


def test_new_types_are_insertable_after_migrate(old_db: Engine) -> None:
    apply_migrations(old_db)
    with old_db.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO questions (form_id, type, title, required, position, properties) "
                "VALUES (1, 'phone_number', 'Phone?', 0, 3, '{}')"
            )
        )


def test_question_position_stays_unique_after_rebuild(old_db: Engine) -> None:
    apply_migrations(old_db)
    with pytest.raises(IntegrityError), old_db.begin() as conn:
        conn.execute(
            text("INSERT INTO questions (form_id, type, title, required, position, properties) VALUES (1, 'short_text', 'Dup', 0, 0, '{}')")
        )


def test_cascade_delete_still_reaches_answers_after_rebuild(old_db: Engine) -> None:
    apply_migrations(old_db)
    with old_db.begin() as conn:
        conn.execute(text("DELETE FROM forms WHERE id = 1"))
    with old_db.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM questions")).scalar() == 0
        assert conn.execute(text("SELECT COUNT(*) FROM answers")).scalar() == 0


def test_structure_columns_are_added(old_db: Engine) -> None:
    apply_migrations(old_db)
    assert "group_id" in _columns(old_db, "questions")
    assert "welcome" in _columns(old_db, "forms")
    with old_db.connect() as conn:
        assert conn.execute(text("SELECT welcome FROM forms WHERE id = 1")).scalar() == "{}"
        assert conn.execute(text("SELECT group_id FROM questions WHERE id = 1")).scalar() is None


def test_thank_you_becomes_first_ending(old_db: Engine) -> None:
    apply_migrations(old_db)
    with old_db.connect() as conn:
        rows = conn.execute(
            text("SELECT form_id, position, title, message, button_text, button_url FROM endings ORDER BY form_id")
        ).fetchall()
    assert rows[0] == (1, 0, "Thanks!", "All done", "Visit", "https://example.com")
    # A form whose thank_you was empty gets the defaults the old API showed.
    assert rows[1] == (2, 0, "Thanks for completing this form", "Your response has been recorded.", None, None)


def test_migrate_twice_is_a_noop(old_db: Engine) -> None:
    apply_migrations(old_db)
    first = _dump(old_db)
    apply_migrations(old_db)
    assert _dump(old_db) == first


def test_database_without_views_column_is_upgraded(tmp_path: Path) -> None:
    engine = _old_database(tmp_path / "older.db", with_views=False)
    assert "views" not in _columns(engine, "forms")
    apply_migrations(engine)
    assert "views" in _columns(engine, "forms")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT views FROM forms WHERE id = 1")).scalar() == 0


def test_fresh_database_needs_no_changes(tmp_path: Path) -> None:
    engine = _engine(tmp_path / "fresh.db")
    Base.metadata.create_all(engine)
    before = _dump(engine)
    apply_migrations(engine)
    assert _dump(engine) == before


def test_fresh_models_expose_the_structure_columns(db) -> None:
    from app.models import Ending, Form, Question

    form = Form(slug="slug0001", title="T")
    form.endings = [Ending(position=1, title="Second", message="m"), Ending(position=0, title="First", message="m")]
    form.questions = [Question(type="statement", title="Header", position=0)]
    db.add(form)
    db.commit()
    db.refresh(form)
    assert form.welcome == {}
    assert [e.title for e in form.endings] == ["First", "Second"]
    assert form.questions[0].group_id is None
