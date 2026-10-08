from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.base import UTCDateTime, check_in, utcnow
from app.models.enums import ResponseStatus

if TYPE_CHECKING:
    from app.models.answer import Answer
    from app.models.form import Form


class Response(Base):
    __tablename__ = "responses"
    __table_args__ = (
        CheckConstraint(check_in("status", ResponseStatus), name="ck_responses_status"),
        Index("ix_responses_form_status", "form_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ResponseStatus.PARTIAL)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    form: Mapped[Form] = relationship(back_populates="responses")
    answers: Mapped[list[Answer]] = relationship(
        back_populates="response",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
