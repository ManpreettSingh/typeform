from typing import Annotated

from fastapi import APIRouter, Depends, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.common import StrictModel
from app.schemas.form import FormOut
from app.services import ai as ai_service
from app.services import ai_apply, ai_chat
from app.services import forms as form_service
from app.services.ai_schemas import MEMORY_MAX, ApplyIn, ChatIn, ChatOut, MemoryIn, MemoryOut

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


@router.post("/chat", response_model=ChatOut)
def chat(data: ChatIn, db: DB):
    """One turn of the Typeform AI conversation: a reply and, when something should change, a proposal plus its diff.
    Nothing is saved until /ai/apply."""
    return ai_chat.chat(db, data)


@router.post("/apply", response_model=FormOut)
def apply(data: ApplyIn, db: DB):
    """Saves a reviewed proposal (creating the form when `form_id` is null) in one transaction."""
    return form_service.to_form_out(db, ai_apply.apply_proposal(db, data))


@router.get("/memory", response_model=MemoryOut)
def get_memory(db: DB):
    return MemoryOut(content=ai_chat.get_memory(db), max_length=MEMORY_MAX)


@router.put("/memory", response_model=MemoryOut)
def put_memory(data: MemoryIn, db: DB):
    return MemoryOut(content=ai_chat.set_memory(db, data.content), max_length=MEMORY_MAX)
