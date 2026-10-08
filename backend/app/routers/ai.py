from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.common import StrictModel
from app.schemas.form import FormOut
from app.services import ai as ai_service
from app.services import forms as form_service

router = APIRouter(prefix="/ai", tags=["ai"])

DB = Annotated[Session, Depends(get_db)]


class GenerateIn(StrictModel):
    prompt: str = Field(min_length=1, max_length=4000)


@router.post("/forms", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def create_form_with_ai(data: GenerateIn, db: DB):
    """A new form drafted from the prompt (workspace "Ask Typeform AI")."""
    return form_service.to_form_out(db, ai_service.create_form_with_ai(db, data.prompt.strip()))


@router.post("/forms/{form_id}/questions", response_model=FormOut)
def generate_questions(form_id: int, data: GenerateIn, db: DB):
    """Adds AI-drafted questions to an existing form ("Create with AI", "Chat to create")."""
    form = form_service.get_form(db, form_id)
    return form_service.to_form_out(db, ai_service.generate_into(db, form, data.prompt.strip()))
