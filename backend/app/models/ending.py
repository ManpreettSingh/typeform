from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base

if TYPE_CHECKING:
    from app.models.form import Form


class Ending(Base):
    """One ending (thank-you) screen. A form has at least one; respondents see the first unless logic picks another."""

    __tablename__ = "endings"
    __table_args__ = (UniqueConstraint("form_id", "position", name="uq_endings_form_position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Indexed via the leading column of uq_endings_form_position.
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="Thanks for completing this form")
    message: Mapped[str] = mapped_column(Text, nullable=False, default="Your response has been recorded.")
    button_text: Mapped[str | None] = mapped_column(String(50))
    button_url: Mapped[str | None] = mapped_column(String(2000))

    form: Mapped[Form] = relationship(back_populates="endings")
