import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import FieldValidationError, errors_from_pydantic
from app.schemas.contact import (
    SORTS,
    BulkDeleteIn,
    BulkDeleteOut,
    ContactCreate,
    ContactFilters,
    ContactListIn,
    ContactListOut,
    ContactListUpdate,
    ContactOut,
    ContactPage,
    ContactUpdate,
    ImportIn,
    ImportOut,
    SyncOut,
)
from app.services import contacts as contact_service

router = APIRouter(prefix="/contacts", tags=["contacts"])

DB = Annotated[Session, Depends(get_db)]


def _parse_filters(raw: str | None) -> ContactFilters | None:
    if raw is None:
        return None
    try:
        return ContactFilters.model_validate(json.loads(raw))
    except json.JSONDecodeError as exc:
        raise FieldValidationError({"filters": "The filters aren't valid JSON"}) from exc
    except ValidationError as exc:
        raise FieldValidationError(errors_from_pydantic(exc, "filters")) from exc


def _check_sort(sort: str, order: str) -> None:
    if sort not in SORTS:
        raise FieldValidationError({"sort": f"Sort by one of: {', '.join(SORTS)}"})
    if order not in ("asc", "desc"):
        raise FieldValidationError({"order": "Order is asc or desc"})


def _search(
    db: Session, query: str | None, filters: str | None, list_id: int | None, sort: str, order: str
) -> list:
    """Contacts matching the search box, the open filters and, when a saved list is open, that list's filters too."""
    _check_sort(sort, order)
    conditions = _parse_filters(filters)
    contacts = contact_service.find_contacts(db, query=query, filters=conditions, sort=sort, order=order)
    if list_id is not None:
        saved = contact_service.list_filters(contact_service.get_list(db, list_id))
        contacts = [c for c in contacts if contact_service.matches(c, saved)]
    return contacts


# Fixed paths come before "/{contact_id}" so "lists" and "import" are never read as ids.


@router.get("", response_model=ContactPage)
def list_contacts(
    db: DB,
    query: Annotated[str | None, Query()] = None,
    filters: Annotated[str | None, Query()] = None,
    list_id: Annotated[int | None, Query()] = None,
    sort: Annotated[str, Query()] = "updated_at",
    order: Annotated[str, Query()] = "desc",
):
    contacts = _search(db, query, filters, list_id, sort, order)
    return ContactPage(items=contact_service.serialize(db, contacts), total=len(contacts))


@router.get("/export.csv")
def export_contacts(
    db: DB,
    query: Annotated[str | None, Query()] = None,
    filters: Annotated[str | None, Query()] = None,
    list_id: Annotated[int | None, Query()] = None,
    sort: Annotated[str, Query()] = "updated_at",
    order: Annotated[str, Query()] = "desc",
):
    """The contacts the table is showing, as a spreadsheet."""
    contacts = _search(db, query, filters, list_id, sort, order)
    return Response(
        # The BOM makes Excel read the UTF-8.
        content="﻿" + contact_service.contacts_csv(db, contacts),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="contacts.csv"'},
    )


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(data: ContactCreate, db: DB):
    return contact_service.serialize(db, [contact_service.create_contact(db, data)])[0]


@router.post("/bulk-delete", response_model=BulkDeleteOut)
def bulk_delete(data: BulkDeleteIn, db: DB):
    return contact_service.bulk_delete(db, data.ids)


@router.post("/import", response_model=ImportOut)
def import_contacts(data: ImportIn, db: DB):
    """Adds or updates contacts from CSV rows the browser has already mapped to properties."""
    return contact_service.import_rows(db, data.rows)


@router.post("/sync", response_model=SyncOut)
def auto_add_from_forms(db: DB):
    """"Auto-add from forms": contacts from every past response that has an email."""
    return contact_service.sync_from_responses(db)


@router.get("/lists", response_model=list[ContactListOut])
def list_saved_lists(db: DB):
    return contact_service.all_lists(db)


@router.post("/lists", response_model=ContactListOut, status_code=status.HTTP_201_CREATED)
def create_saved_list(data: ContactListIn, db: DB):
    return contact_service.create_list(db, data)


@router.patch("/lists/{list_id}", response_model=ContactListOut)
def update_saved_list(list_id: int, data: ContactListUpdate, db: DB):
    return contact_service.update_list(db, contact_service.get_list(db, list_id), data)


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_list(list_id: int, db: DB) -> None:
    contact_service.delete_list(db, contact_service.get_list(db, list_id))


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: int, db: DB):
    return contact_service.serialize(db, [contact_service.get_contact(db, contact_id)])[0]


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: int, data: ContactUpdate, db: DB):
    contact = contact_service.update_contact(db, contact_service.get_contact(db, contact_id), data)
    return contact_service.serialize(db, [contact])[0]


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, db: DB) -> None:
    contact_service.delete_contact(db, contact_service.get_contact(db, contact_id))
