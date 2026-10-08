from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import UTCDateTime, check_in, utcnow
from app.models.enums import FormStatus

if TYPE_CHECKING:
    from app.models.question import Question
    from app.models.response import Response


class Form(Base):
    __tablename__ = "forms"
    __table_args__ = (CheckConstraint(check_in("status", FormStatus), name="ck_forms_status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # unique=True creates the forms(slug) index.
    slug: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="Untitled form")
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=FormStatus.DRAFT)
    theme: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    thank_you: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    # passive_deletes: let SQLite's ON DELETE CASCADE do the work instead of loading children.
    questions: Mapped[list[Question]] = relationship(
        back_populates="form",
        order_by="Question.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    responses: Mapped[list[Response]] = relationship(
        back_populates="form",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
