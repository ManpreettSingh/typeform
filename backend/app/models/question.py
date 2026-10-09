from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.form import Form


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        # No CHECK on `type`: the QuestionType enum validates it, so a new type needs no table rebuild.
        CheckConstraint("position >= 0", name="ck_questions_position"),
        # Also serves as the questions(form_id, position) index.
        UniqueConstraint("form_id", "position", name="uq_questions_form_position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Indexed via the leading column of uq_questions_form_position.
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str | None] = mapped_column(Text)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    properties: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    logic: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    # Set on the questions inside a group; points at the group's header row (type "group").
    group_id: Mapped[int | None] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))

    form: Mapped[Form] = relationship(back_populates="questions")
