"""Contacts API shapes. Field limits are Typeform's: email and name 254 characters, notes 1,000."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import SubscriptionStatus
from app.question_types.text import EMAIL_RE

EMAIL_MAX = 254
NAME_MAX = 254
PHONE_MAX = 64
COMPANY_MAX = 254
NOTES_MAX = 1000
EMAIL_ERROR = "Hmm... that email doesn't look right"
IMPORT_MAX_ROWS = 5000

# Statuses a person can pick; "suppressed" is set by the system.
SelectableStatus = Literal["subscribed", "unsubscribed", "never_subscribed"]

TEXT_PROPERTIES = ("name", "email", "phone", "company", "notes")
TEXT_OPS = ("contains", "not_contains", "is_empty", "is_not_empty")
SORTS = ("contact", "name", "email", "subscription_status", "last_update_source", "updated_at")


def clean(value: Any) -> str | None:
    """Trimmed text, with blank turned into None (an emptied field is removed)."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def clean_email(value: Any) -> str | None:
    email = clean(value)
    if email is None:
        return None
    if len(email) > EMAIL_MAX or not EMAIL_RE.match(email):
        raise ValueError(EMAIL_ERROR)
    return email.lower()


class _ContactFields(BaseModel):
    email: str | None = None
    name: str | None = Field(default=None, max_length=NAME_MAX)
    phone: str | None = Field(default=None, max_length=PHONE_MAX)
    company: str | None = Field(default=None, max_length=COMPANY_MAX)
    notes: str | None = Field(default=None, max_length=NOTES_MAX)

    @field_validator("email", mode="before")
    @classmethod
    def _email(cls, value: Any) -> str | None:
        return clean_email(value)

    @field_validator("name", "phone", "company", "notes", mode="before")
    @classmethod
    def _text(cls, value: Any) -> str | None:
        return clean(value)


class ContactCreate(_ContactFields):
    subscription_status: SelectableStatus = "never_subscribed"

    @model_validator(mode="after")
    def _needs_email_or_name(self):
        if not self.email and not self.name:
            raise ValueError("Add an email or a name")
        return self


class ContactUpdate(_ContactFields):
    """Only the fields that are sent change; a blank text field clears it."""

    subscription_status: SelectableStatus | None = None


class HistoryEntry(BaseModel):
    status: str
    at: datetime


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str | None
    name: str | None
    phone: str | None
    company: str | None
    notes: str | None
    subscription_status: str
    subscription_history: list[HistoryEntry]
    sources: list[dict[str, Any]]
    last_update_source: str
    created_at: datetime
    updated_at: datetime


class ContactPage(BaseModel):
    items: list[ContactOut]
    total: int


class BulkDeleteIn(BaseModel):
    ids: list[int] = Field(max_length=100_000)


class BulkDeleteOut(BaseModel):
    deleted: int


# ---- filters and lists -----------------------------------------------------------------------------------------------


class ContactFilter(BaseModel):
    """One condition: text properties take contains / not_contains / is_empty / is_not_empty, the subscription status
    takes is / is_not, and "last_change" takes before / after a date."""

    property: Literal["name", "email", "phone", "company", "notes", "subscription_status", "last_change"]
    op: str
    value: Any = None

    @model_validator(mode="after")
    def _check(self):
        if self.property in TEXT_PROPERTIES:
            if self.op not in TEXT_OPS:
                raise ValueError("That condition doesn't suit this property")
            if self.op in ("contains", "not_contains") and not isinstance(self.value, str):
                raise ValueError("Enter a value to compare with")
        elif self.property == "subscription_status":
            if self.op not in ("is", "is_not"):
                raise ValueError("That condition doesn't suit this property")
            if self.value not in {s.value for s in SubscriptionStatus}:
                raise ValueError("Unknown subscription status")
        else:
            if self.op not in ("before", "after"):
                raise ValueError("That condition doesn't suit this property")
            try:
                date.fromisoformat(str(self.value))
            except ValueError as exc:
                raise ValueError("Enter a date as YYYY-MM-DD") from exc
        return self


class ContactFilters(BaseModel):
    # "and": every condition must hold; "or": any one is enough.
    operator: Literal["and", "or"] = "and"
    conditions: list[ContactFilter] = Field(default_factory=list, max_length=20)


class ContactListIn(BaseModel):
    name: str = Field(max_length=100)
    filters: ContactFilters

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Give the list a name")
        return name


class ContactListUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    filters: ContactFilters | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Give the list a name")
        return name


class ContactListOut(BaseModel):
    id: int
    name: str
    filters: ContactFilters
    # Contacts that match the list right now.
    count: int
    created_at: datetime


# ---- import and sync -------------------------------------------------------------------------------------------------


class ImportIn(BaseModel):
    # Rows as mapped in the import dialog: {"email", "name", "phone", "company", "notes", "subscription_status"}.
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=IMPORT_MAX_ROWS)


class ImportRowError(BaseModel):
    # 1-based position in the file, header excluded.
    row: int
    message: str


class ImportOut(BaseModel):
    created: int
    updated: int
    errors: list[ImportRowError]


class SyncOut(BaseModel):
    created: int
    updated: int
