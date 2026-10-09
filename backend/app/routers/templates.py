from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.form import FormOut
from app.schemas.template import TemplateDetail, TemplateSummary
from app.services import forms as form_service
from app.services import templates as template_service

router = APIRouter(tags=["templates"])

DB = Annotated[Session, Depends(get_db)]


@router.get("/templates", response_model=list[TemplateSummary])
def list_templates(
    db: DB,
    role: Annotated[list[str] | None, Query(description="Role slug(s): sales, product, marketing, hr, customer-success")] = None,
    goal: Annotated[list[str] | None, Query(description="Goal slug(s): get-feedback, make-sales, ...")] = None,
    form_type: Annotated[list[str] | None, Query(alias="type", description="forms, surveys, quizzes or polls")] = None,
    q: Annotated[str | None, Query(max_length=200, description="Search title, description and question titles")] = None,
):
    return template_service.list_templates(db, role=role, goal=goal, form_type=form_type, q=q)


@router.get("/templates/{slug}", response_model=TemplateDetail)
def get_template(slug: str, db: DB):
    return template_service.template_detail(db, slug)


from pydantic import BaseModel

class CreateFromTemplateRequest(BaseModel):
    workspace_id: int | None = None

@router.post("/forms/from-template/{slug}", response_model=FormOut, status_code=status.HTTP_201_CREATED)
def create_form_from_template(slug: str, db: DB, req: CreateFromTemplateRequest | None = None):
    workspace_id = req.workspace_id if req else None
    form = template_service.create_form_from_template(db, slug, workspace_id)
    return form_service.to_form_out(db, form)
