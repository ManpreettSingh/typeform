from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.public import PublicForm, SubmissionIn, SubmissionOut
from app.services import submissions as submission_service

router = APIRouter(prefix="/public", tags=["public"])

DB = Annotated[Session, Depends(get_db)]


@router.get("/forms/{slug}", response_model=PublicForm)
def get_public_form(slug: str, db: DB):
    return submission_service.get_published_form(db, slug)


@router.post("/forms/{slug}/responses", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_response(slug: str, data: SubmissionIn, db: DB):
    form = submission_service.get_published_form(db, slug)
    return submission_service.create_submission(db, form, data.answers)
