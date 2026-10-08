from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(
    get_settings().database_url,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _record) -> None:
    # SQLite ships with FK enforcement off; cascades depend on it.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added after the first release. `create_all` never alters existing tables, so an older app.db
# gets them here instead of having to be deleted and re-seeded.
_ADDED_COLUMNS = {"forms": {"views": "INTEGER NOT NULL DEFAULT 0"}}


def migrate() -> None:
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            for name, ddl in columns.items():
                if existing and name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
