from __future__ import annotations

from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AiMemory(Base):
    """What the creator told Typeform AI about themselves (company, tone, audience). One row: this app has no accounts."""

    __tablename__ = "ai_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
