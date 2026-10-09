from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import UTCDateTime, check_in, utcnow
from app.models.enums import SubscriptionStatus


class Contact(Base):
    """One person in the contact database. Filled from form submissions, CSV imports and manual entry."""

    __tablename__ = "contacts"
    __table_args__ = (CheckConstraint(check_in("subscription_status", SubscriptionStatus), name="ck_contacts_subscription_status"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Lower-cased, so one address is one contact. Unique, but many contacts may have none (SQLite allows several NULLs).
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    name: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(64))
    company: Mapped[str | None] = mapped_column(String(254))
    notes: Mapped[str | None] = mapped_column(Text)
    subscription_status: Mapped[str] = mapped_column(String(16), nullable=False, default=SubscriptionStatus.NEVER_SUBSCRIBED)
    # [{"status", "at"}], oldest first.
    subscription_history: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    # Where the contact came from: {"type": "manual" | "csv_import"} or {"type": "form", "form_id", "form_title"}.
    sources: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    # "sync" (form submissions), "csv_import" or "manual_edit": Typeform's "Last update source" column.
    last_update_source: Mapped[str] = mapped_column(String(16), nullable=False, default="manual_edit")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow)
    # Typeform's "Last change" column.
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow, onupdate=utcnow)


class ContactList(Base):
    """A saved set of filters, shown under "Contact lists" beside the table."""

    __tablename__ = "contact_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    filters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=utcnow)
