from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings
from app.core.migrations import apply_migrations

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


def lock_for_write(db: Session) -> None:
    """Takes SQLite's write lock now, before a read-then-write such as picking the next free position.

    pysqlite only opens a transaction at the first INSERT/UPDATE, so two requests could both read the same positions
    and the second write then broke UNIQUE(form_id, position) with a 500. BEGIN IMMEDIATE makes them take turns (the
    other waits on the driver's busy timeout). Plain reads stay lock-free. Callers reload what they read after this.
    """
    connection = db.connection()
    if not connection.connection.dbapi_connection.in_transaction:
        connection.exec_driver_sql("BEGIN IMMEDIATE")


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate() -> None:
    """Upgrades an existing database in place (see app/core/migrations.py)."""
    apply_migrations(engine)
