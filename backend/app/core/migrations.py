"""Ordered, idempotent schema migrations for databases created by an older release.

`Base.metadata.create_all` builds tables that are missing (so a fresh database gets the newest shape straight away) but
never alters one that exists. Every change to an existing table therefore lives here, as a small step that first checks
whether it still has work to do; running the whole chain twice changes nothing. Steps carry their own SQL and never read
the current models, so an old step keeps producing the shape it was written for. Append new steps to the END of MIGRATIONS.
"""

import json
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

Step = Callable[[Engine], None]

DEFAULT_ENDING_TITLE = "Thanks for completing this form"
DEFAULT_ENDING_MESSAGE = "Your response has been recorded."


def _table_sql(conn: Connection, table: str) -> str | None:
    return conn.execute(text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :t"), {"t": table}).scalar()


def _columns(conn: Connection, table: str) -> set[str]:
    return {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}


def _add_column(engine: Engine, table: str, name: str, ddl: str) -> None:
    with engine.begin() as conn:
        existing = _columns(conn, table)
        # No columns means the table doesn't exist yet: create_all builds it with this column already in place.
        if existing and name not in existing:
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def add_forms_views(engine: Engine) -> None:
    _add_column(engine, "forms", "views", "INTEGER NOT NULL DEFAULT 0")


# The questions table of the previous release without its CHECK on `type` (new types are added without a migration).
_QUESTIONS_WITHOUT_TYPE_CHECK = """
CREATE TABLE questions_rebuilt (
    id INTEGER NOT NULL,
    form_id INTEGER NOT NULL,
    type VARCHAR(32) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    required BOOLEAN NOT NULL,
    position INTEGER NOT NULL,
    properties JSON NOT NULL,
    logic JSON,
    PRIMARY KEY (id),
    CONSTRAINT ck_questions_position CHECK (position >= 0),
    CONSTRAINT uq_questions_form_position UNIQUE (form_id, position),
    FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE
)"""

_QUESTION_COLUMNS = "id, form_id, type, title, description, required, position, properties, logic"


def drop_question_type_check(engine: Engine) -> None:
    """SQLite can't drop a CHECK, so the table is rebuilt (https://sqlite.org/lang_altertable.html, section 7)."""
    with engine.connect() as conn:
        sql = _table_sql(conn, "questions")
    if not sql or "ck_questions_type" not in sql:
        return

    raw = engine.raw_connection()
    db = raw.driver_connection
    try:
        db.execute("PRAGMA foreign_keys=OFF")  # only takes effect outside a transaction
        db.execute("BEGIN IMMEDIATE")
        try:
            db.execute(_QUESTIONS_WITHOUT_TYPE_CHECK)
            db.execute(f"INSERT INTO questions_rebuilt ({_QUESTION_COLUMNS}) SELECT {_QUESTION_COLUMNS} FROM questions")
            db.execute("DROP TABLE questions")
            db.execute("ALTER TABLE questions_rebuilt RENAME TO questions")
            problems = db.execute("PRAGMA foreign_key_check").fetchall()
            if problems:
                raise RuntimeError(f"Rebuilding questions broke foreign keys: {problems[:3]}")
            db.execute("COMMIT")
        except BaseException:
            db.execute("ROLLBACK")
            raise
    finally:
        db.execute("PRAGMA foreign_keys=ON")
        raw.close()


def add_questions_group_id(engine: Engine) -> None:
    _add_column(engine, "questions", "group_id", "INTEGER REFERENCES questions (id) ON DELETE CASCADE")


def add_forms_welcome(engine: Engine) -> None:
    _add_column(engine, "forms", "welcome", "JSON NOT NULL DEFAULT '{}'")


_ENDINGS_TABLE = """
CREATE TABLE IF NOT EXISTS endings (
    id INTEGER NOT NULL,
    form_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    button_text VARCHAR(50),
    button_url VARCHAR(2000),
    PRIMARY KEY (id),
    CONSTRAINT uq_endings_form_position UNIQUE (form_id, position),
    FOREIGN KEY(form_id) REFERENCES forms (id) ON DELETE CASCADE
)"""


def create_endings_from_thank_you(engine: Engine) -> None:
    """Every form gets a first ending built from its old `thank_you` JSON (forms that already have endings are left alone)."""
    with engine.begin() as conn:
        conn.exec_driver_sql(_ENDINGS_TABLE)
        pending = conn.exec_driver_sql(
            "SELECT id, thank_you FROM forms WHERE id NOT IN (SELECT form_id FROM endings)"
        ).fetchall()
        for form_id, raw in pending:
            data = json.loads(raw) if isinstance(raw, str) and raw else {}
            conn.execute(
                text(
                    "INSERT INTO endings (form_id, position, title, message, button_text, button_url) "
                    "VALUES (:form_id, 0, :title, :message, :button_text, :button_url)"
                ),
                {
                    "form_id": form_id,
                    "title": data.get("title") or DEFAULT_ENDING_TITLE,
                    "message": data.get("message") or DEFAULT_ENDING_MESSAGE,
                    "button_text": data.get("button_text"),
                    "button_url": data.get("button_url"),
                },
            )


_THEMES_TABLE = """
CREATE TABLE IF NOT EXISTS themes (
    id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    theme JSON NOT NULL,
    PRIMARY KEY (id)
)"""

def create_themes_table(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.exec_driver_sql(_THEMES_TABLE)

MIGRATIONS: list[tuple[str, Step]] = [
    ("add_forms_views", add_forms_views),
    ("drop_question_type_check", drop_question_type_check),
    ("add_questions_group_id", add_questions_group_id),
    ("add_forms_welcome", add_forms_welcome),
    ("create_endings_from_thank_you", create_endings_from_thank_you),
    ("create_themes_table", create_themes_table),
]


def apply_migrations(engine: Engine) -> None:
    for _name, step in MIGRATIONS:
        step(engine)
