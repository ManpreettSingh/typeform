"""Contacts: Typeform's contact database. People arrive from form submissions ("sync"), CSV imports and manual entry,
and are found with search, filters and saved lists.

The table is small by design (a form builder's audience), so search, filters and sorting run in Python over the loaded
rows instead of in SQL: simpler to get right, and no LIKE escaping to worry about.
"""

import csv
import io
import logging
from collections.abc import Iterable
from datetime import date
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.db import SessionLocal
from app.core.errors import FieldValidationError, NotFoundError
from app.models import Contact, ContactList, Form, QuestionType, Response, ResponseStatus, SubscriptionStatus
from app.models.base import utcnow
from app.schemas.contact import (
    COMPANY_MAX,
    EMAIL_ERROR,
    NAME_MAX,
    NOTES_MAX,
    PHONE_MAX,
    BulkDeleteOut,
    ContactCreate,
    ContactFilter,
    ContactFilters,
    ContactListIn,
    ContactListOut,
    ContactListUpdate,
    ContactOut,
    ContactPage,
    ContactUpdate,
    ImportOut,
    ImportRowError,
    SyncOut,
    clean,
    clean_email,
)
from app.services.export import safe_cell

logger = logging.getLogger(__name__)

_FIELD_LIMITS = {"name": NAME_MAX, "phone": PHONE_MAX, "company": COMPANY_MAX, "notes": NOTES_MAX}
_LABELS = {
    SubscriptionStatus.SUBSCRIBED: "Subscribed",
    SubscriptionStatus.UNSUBSCRIBED: "Unsubscribed",
    SubscriptionStatus.NEVER_SUBSCRIBED: "Never subscribed",
    SubscriptionStatus.SUPPRESSED: "Suppressed",
}
_IMPORTABLE_STATUSES = {"subscribed", "unsubscribed", "never_subscribed"}
_SOURCE_LABELS = {"manual": "Manual edit", "csv_import": "CSV import"}
_SORT_KEYS = {
    "contact": lambda c: (c.name or c.email or "").lower(),
    "name": lambda c: (c.name or "").lower(),
    "email": lambda c: (c.email or "").lower(),
    "subscription_status": lambda c: c.subscription_status,
    "last_update_source": lambda c: c.last_update_source,
    "updated_at": lambda c: c.updated_at,
}


def _entry(status: str) -> dict[str, str]:
    return {"status": status, "at": utcnow().isoformat()}


def _form_source(form: Form) -> dict[str, Any]:
    return {"type": "form", "form_id": form.id, "form_title": form.title}


def _has_source(contact: Contact, source: dict[str, Any]) -> bool:
    if source["type"] != "form":
        return any(s.get("type") == source["type"] for s in contact.sources)
    return any(s.get("type") == "form" and s.get("form_id") == source["form_id"] for s in contact.sources)


def _add_source(contact: Contact, source: dict[str, Any]) -> bool:
    if _has_source(contact, source):
        return False
    contact.sources = [*contact.sources, source]  # a new list, so the change is saved
    return True


def _set_status(contact: Contact, status: str) -> bool:
    if contact.subscription_status == status:
        return False
    contact.subscription_status = status
    contact.subscription_history = [*contact.subscription_history, _entry(status)]
    return True


# ---- reading ---------------------------------------------------------------------------------------------------------


def get_contact(db: Session, contact_id: int) -> Contact:
    contact = db.get(Contact, contact_id)
    if contact is None:
        raise NotFoundError("Contact not found")
    return contact


def serialize(db: Session, contacts: Iterable[Contact]) -> list[ContactOut]:
    """Contacts as the API returns them. A form source shows the form's current title, or the one it had when deleted."""
    titles = dict(db.execute(select(Form.id, Form.title)).all())
    out = []
    for contact in contacts:
        sources = [
            {**s, "form_title": titles.get(s.get("form_id"), s.get("form_title"))} if s.get("type") == "form" else s
            for s in contact.sources
        ]
        out.append(ContactOut.model_validate({**ContactOut.model_validate(contact).model_dump(), "sources": sources}))
    return out


def _passes(contact: Contact, condition: ContactFilter) -> bool:
    if condition.property == "subscription_status":
        return (contact.subscription_status == condition.value) == (condition.op == "is")
    if condition.property == "last_change":
        changed, limit = contact.updated_at.date(), date.fromisoformat(str(condition.value))
        return changed < limit if condition.op == "before" else changed > limit
    text = (getattr(contact, condition.property) or "").strip()
    needle = str(condition.value or "").strip().lower()
    return {
        "contains": needle in text.lower(),
        "not_contains": needle not in text.lower(),
        "is_empty": not text,
        "is_not_empty": bool(text),
    }[condition.op]


def matches(contact: Contact, filters: ContactFilters | None) -> bool:
    if filters is None or not filters.conditions:
        return True
    results = (_passes(contact, c) for c in filters.conditions)
    return all(results) if filters.operator == "and" else any(results)


def find_contacts(
    db: Session, *, query: str | None = None, filters: ContactFilters | None = None, sort: str = "updated_at", order: str = "desc"
) -> list[Contact]:
    contacts = [c for c in db.scalars(select(Contact)).all() if matches(c, filters)]
    needle = (query or "").strip().lower()
    if needle:
        contacts = [c for c in contacts if any(needle in (getattr(c, f) or "").lower() for f in ("name", "email", "phone", "company", "notes"))]
    # Ties fall back to the id, so equal values keep a stable order (newest first when descending).
    return sorted(contacts, key=lambda c: (_SORT_KEYS[sort](c), c.id), reverse=order == "desc")


def list_contacts(db: Session, **kwargs: Any) -> ContactPage:
    contacts = find_contacts(db, **kwargs)
    return ContactPage(items=serialize(db, contacts), total=len(contacts))


# ---- creating, editing, deleting --------------------------------------------------------------------------------------


def _ensure_email_free(db: Session, email: str | None, own_id: int | None = None) -> None:
    if email is None:
        return
    taken = db.scalar(select(Contact.id).where(Contact.email == email))
    if taken is not None and taken != own_id:
        raise FieldValidationError({"email": "A contact with this email already exists"})


def _commit(db: Session) -> None:
    """Commits, turning a lost race on the unique email into the same message as the up-front check."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise FieldValidationError({"email": "A contact with this email already exists"}) from exc


def create_contact(db: Session, data: ContactCreate) -> Contact:
    _ensure_email_free(db, data.email)
    contact = Contact(
        email=data.email,
        name=data.name,
        phone=data.phone,
        company=data.company,
        notes=data.notes,
        subscription_status=data.subscription_status,
        subscription_history=[_entry(data.subscription_status)],
        sources=[{"type": "manual"}],
        last_update_source="manual_edit",
    )
    db.add(contact)
    _commit(db)
    return contact


def update_contact(db: Session, contact: Contact, data: ContactUpdate) -> Contact:
    changes = data.model_dump(exclude_unset=True)
    status = changes.pop("subscription_status", None)
    if "email" in changes:
        _ensure_email_free(db, changes["email"], contact.id)
    for field, value in changes.items():
        setattr(contact, field, value)
    if status:
        _set_status(contact, status)
    if not contact.email and not contact.name:
        db.rollback()
        raise FieldValidationError({"name": "Add an email or a name"})
    contact.last_update_source = "manual_edit"
    _commit(db)
    return contact


def delete_contact(db: Session, contact: Contact) -> None:
    db.delete(contact)
    db.commit()


def bulk_delete(db: Session, ids: list[int]) -> BulkDeleteOut:
    result = db.execute(delete(Contact).where(Contact.id.in_(ids)))
    db.commit()
    return BulkDeleteOut(deleted=result.rowcount)


# ---- saved lists -----------------------------------------------------------------------------------------------------


def _list_out(lst: ContactList, contacts: list[Contact]) -> ContactListOut:
    filters = ContactFilters.model_validate(lst.filters)
    return ContactListOut(
        id=lst.id, name=lst.name, filters=filters, count=sum(1 for c in contacts if matches(c, filters)), created_at=lst.created_at
    )


def all_lists(db: Session) -> list[ContactListOut]:
    contacts = list(db.scalars(select(Contact)).all())
    return [_list_out(lst, contacts) for lst in db.scalars(select(ContactList).order_by(ContactList.id)).all()]


def get_list(db: Session, list_id: int) -> ContactList:
    lst = db.get(ContactList, list_id)
    if lst is None:
        raise NotFoundError("Contact list not found")
    return lst


def list_filters(lst: ContactList) -> ContactFilters:
    return ContactFilters.model_validate(lst.filters)


def _ensure_list_name_free(db: Session, name: str, own_id: int | None = None) -> None:
    for other in db.scalars(select(ContactList)).all():
        if other.id != own_id and other.name.lower() == name.lower():
            raise FieldValidationError({"name": "A list with this name already exists"})


def create_list(db: Session, data: ContactListIn) -> ContactListOut:
    _ensure_list_name_free(db, data.name)
    lst = ContactList(name=data.name, filters=data.filters.model_dump())
    db.add(lst)
    db.commit()
    return _list_out(lst, list(db.scalars(select(Contact)).all()))


def update_list(db: Session, lst: ContactList, data: ContactListUpdate) -> ContactListOut:
    if data.name is not None:
        _ensure_list_name_free(db, data.name, lst.id)
        lst.name = data.name
    if data.filters is not None:
        lst.filters = data.filters.model_dump()
    db.commit()
    return _list_out(lst, list(db.scalars(select(Contact)).all()))


def delete_list(db: Session, lst: ContactList) -> None:
    db.delete(lst)
    db.commit()


# ---- CSV import -----------------------------------------------------------------------------------------------------


def _status_from_label(raw: str) -> str | None:
    """"Never subscribed", "never-subscribed" and "never_subscribed" are all the same status."""
    key = raw.strip().lower().replace(" ", "_").replace("-", "_")
    return key if key in _IMPORTABLE_STATUSES else None


def _read_row(row: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    """The cleaned fields of one import row, or what is wrong with it."""
    fields: dict[str, Any] = {}
    try:
        fields["email"] = clean_email(row.get("email"))
    except ValueError:
        return {}, EMAIL_ERROR
    for field, limit in _FIELD_LIMITS.items():
        value = clean(row.get(field))
        if value is not None and len(value) > limit:
            return {}, f"The {field} is longer than {limit} characters"
        fields[field] = value
    if not fields["email"] and not fields["name"]:
        return {}, "Needs an email or a name"
    raw_status = clean(row.get("subscription_status"))
    if raw_status is not None:
        status = _status_from_label(raw_status)
        if status is None:
            return {}, f"Unknown subscription status \"{raw_status}\""
        fields["subscription_status"] = status
    return fields, None


def import_rows(db: Session, rows: list[dict[str, Any]]) -> ImportOut:
    by_email = {c.email: c for c in db.scalars(select(Contact).where(Contact.email.is_not(None))).all()}
    created = updated = 0
    errors: list[ImportRowError] = []
    source = {"type": "csv_import"}

    for number, row in enumerate(rows, start=1):
        fields, problem = _read_row(row)
        if problem:
            errors.append(ImportRowError(row=number, message=problem))
            continue
        contact = by_email.get(fields["email"]) if fields["email"] else None
        status = fields.pop("subscription_status", None)
        if contact is None:
            contact = Contact(
                subscription_status=status or "never_subscribed",
                subscription_history=[_entry(status or "never_subscribed")],
                sources=[source],
                last_update_source="csv_import",
                **fields,
            )
            db.add(contact)
            if contact.email:
                by_email[contact.email] = contact
            created += 1
            continue
        for field, value in fields.items():
            if value is not None and field != "email":
                setattr(contact, field, value)
        if status:
            _set_status(contact, status)
        _add_source(contact, source)
        contact.last_update_source = "csv_import"
        updated += 1

    _commit(db)
    return ImportOut(created=created, updated=updated, errors=errors)


# ---- contacts from form submissions ----------------------------------------------------------------------------------


def extract_contact(questions: Iterable[Any], answers: dict[int, Any]) -> dict[str, str | None] | None:
    """The person behind a submission: an email (required), plus name, phone and company when the form asks for them.

    Understands email questions, contact-info questions, phone questions, and a short-text question titled "…name…".
    """
    email = phone = company = info_name = text_name = None
    for question in questions:
        value = answers.get(question.id)
        if value is None:
            continue
        if question.type == QuestionType.EMAIL and isinstance(value, str):
            email = email or value
        elif question.type == QuestionType.CONTACT_INFO and isinstance(value, dict):
            email = email or value.get("email")
            phone = phone or value.get("phone_number")
            company = company or value.get("company")
            info_name = info_name or clean(f"{value.get('first_name') or ''} {value.get('last_name') or ''}")
        elif question.type == QuestionType.PHONE_NUMBER and isinstance(value, str):
            phone = phone or value
        elif question.type == QuestionType.SHORT_TEXT and isinstance(value, str):
            title = (question.title or "").lower()
            if "name" in title and "company" not in title and "business" not in title:
                text_name = text_name or value
    try:
        email = clean_email(email)
    except ValueError:
        return None
    if email is None:
        return None
    return {"email": email, "name": clean(info_name or text_name), "phone": clean(phone), "company": clean(company)}


def _upsert_from_form(
    by_email: dict[str, Contact], db: Session, form: Form, person: dict[str, str | None]
) -> tuple[Contact, bool, bool]:
    """Adds or tops up the contact for one submission. Returns (contact, created, changed).

    Existing values are never overwritten, so a name you typed by hand survives a later submission; gaps are filled.
    """
    source = _form_source(form)
    contact = by_email.get(person["email"])
    if contact is None:
        contact = Contact(
            subscription_history=[_entry("never_subscribed")], sources=[source], last_update_source="sync", **person
        )
        db.add(contact)
        by_email[person["email"]] = contact
        return contact, True, True

    changed = _add_source(contact, source)
    for field in ("name", "phone", "company"):
        if person[field] and not getattr(contact, field):
            setattr(contact, field, person[field])
            changed = True
    if changed:
        contact.last_update_source = "sync"
    return contact, False, changed


def _completed_responses(db: Session, response_id: int | None = None) -> list[Response]:
    stmt = (
        select(Response)
        .where(Response.status == ResponseStatus.COMPLETED)
        .options(selectinload(Response.answers), selectinload(Response.form).selectinload(Form.questions))
        .order_by(Response.submitted_at, Response.id)
    )
    if response_id is not None:
        stmt = stmt.where(Response.id == response_id)
    return list(db.scalars(stmt).all())


def sync_from_responses(db: Session) -> SyncOut:
    """"Auto-add from forms": adds every past completed response that has an email as a contact."""
    by_email = {c.email: c for c in db.scalars(select(Contact).where(Contact.email.is_not(None))).all()}
    created = updated = 0
    for response in _completed_responses(db):
        person = extract_contact(response.form.questions, {a.question_id: a.value for a in response.answers})
        if person is None:
            continue
        _, was_created, changed = _upsert_from_form(by_email, db, response.form, person)
        created += was_created
        updated += changed and not was_created
    _commit(db)
    return SyncOut(created=created, updated=updated)


def record_submission(response_id: int) -> None:
    """After a response is completed: adds or updates its contact. Runs in the background with its own session, and
    never raises, so a problem with contacts can't touch the respondent's submission."""
    try:
        with SessionLocal() as db:
            by_email = {}
            for response in _completed_responses(db, response_id):
                person = extract_contact(response.form.questions, {a.question_id: a.value for a in response.answers})
                if person is None:
                    continue
                existing = db.scalar(select(Contact).where(Contact.email == person["email"]))
                if existing is not None:
                    by_email[person["email"]] = existing
                _upsert_from_form(by_email, db, response.form, person)
            db.commit()
    except Exception:
        logger.exception("Could not record a contact for response %s", response_id)


# ---- export -----------------------------------------------------------------------------------------------------------


def _source_label(source: dict[str, Any]) -> str:
    return source.get("form_title") or "A deleted form" if source.get("type") == "form" else _SOURCE_LABELS.get(source.get("type"), "")


def contacts_csv(db: Session, contacts: list[Contact]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Name", "Email", "Phone", "Company", "Notes", "Subscription status", "Sources", "Last update source", "Last change", "Created"]
    )
    for contact, out in zip(contacts, serialize(db, contacts), strict=True):
        source = {"sync": "Sync", "csv_import": "CSV import", "manual_edit": "Manual edit"}.get(contact.last_update_source, "")
        writer.writerow(
            [
                *(safe_cell(getattr(contact, f) or "") for f in ("name", "email", "phone", "company", "notes")),
                _LABELS[SubscriptionStatus(contact.subscription_status)],
                safe_cell("; ".join(_source_label(s) for s in out.sources)),
                source,
                contact.updated_at.isoformat().replace("+00:00", "Z"),
                contact.created_at.isoformat().replace("+00:00", "Z"),
            ]
        )
    return buffer.getvalue()
