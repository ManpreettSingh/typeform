from typing import Annotated

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.form import FormCreate, FormListItem, FormOut, FormUpdate
from app.schemas.question import QuestionCreate, QuestionOrder, QuestionOut
from app.services import forms as form_service
from app.services import questions as question_service

router = APIRouter(prefix="/forms", tags=["forms"])

DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[FormListItem])
def list_forms(db: DB):
    return form_service.list_forms(db)


@router.post("", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def create_form(db: DB, data: Annotated[FormCreate | None, Body()] = None):
    form = form_service.create_form(db, data or FormCreate())
    return form_service.to_form_out(db, form)


@router.get("/{form_id}", response_model=FormOut)
def get_form(form_id: int, db: DB):
    return form_service.to_form_out(db, form_service.get_form(db, form_id))


@router.patch("/{form_id}", response_model=FormOut)
def update_form(form_id: int, data: FormUpdate, db: DB):
    form = form_service.update_form(db, form_service.get_form(db, form_id), data)
    return form_service.to_form_out(db, form)


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form(form_id: int, db: DB) -> None:
    form_service.delete_form(db, form_service.get_form(db, form_id))


@router.post("/{form_id}/duplicate", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def duplicate_form(form_id: int, db: DB):
    clone = form_service.duplicate_form(db, form_service.get_form(db, form_id))
    return form_service.to_form_out(db, clone)


@router.post("/{form_id}/publish", response_model=FormOut)
def publish_form(form_id: int, db: DB):
    form = form_service.publish_form(db, form_service.get_form(db, form_id))
    return form_service.to_form_out(db, form)


@router.post("/{form_id}/unpublish", response_model=FormOut)
def unpublish_form(form_id: int, db: DB):
    form = form_service.unpublish_form(db, form_service.get_form(db, form_id))
    return form_service.to_form_out(db, form)


@router.post("/{form_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(form_id: int, data: QuestionCreate, db: DB):
    return question_service.create_question(db, form_service.get_form(db, form_id), data)


@router.put("/{form_id}/questions/order", response_model=list[QuestionOut])
def reorder_questions(form_id: int, data: QuestionOrder, db: DB):
    form = form_service.get_form(db, form_id)
    return question_service.reorder_questions(db, form, data.ordered_ids)
