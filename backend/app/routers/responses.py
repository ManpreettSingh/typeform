import re
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response as HttpResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import ResponseStatus
from app.schemas.response import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    FormSummary,
    ResponseDetail,
    ResponsePage,
)
from app.services import export as export_service
from app.services import forms as form_service
from app.services import responses as response_service
from app.services import stats as stats_service

router = APIRouter(prefix="/forms/{form_id}", tags=["results"])

DB = Annotated[Session, Depends(get_db)]


@router.get("/responses", response_model=ResponsePage)
def list_responses(
    form_id: int,
    db: DB,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    status: ResponseStatus | None = None,
):
    form = form_service.get_form(db, form_id)
    return response_service.list_responses(db, form, page, page_size, status)


# Declared before /responses/{response_id} so "export.csv" isn't parsed as an id.
@router.get("/responses/export.csv", response_class=HttpResponse)
def export_responses(form_id: int, db: DB):
    form = form_service.get_form(db, form_id)
    filename = re.sub(r"[^A-Za-z0-9_-]+", "-", form.title).strip("-")[:60] or "responses"
    return HttpResponse(
        # BOM so Excel opens UTF-8 (accents, emoji) correctly.
        content="﻿" + export_service.responses_csv(db, form),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}-responses.csv"'},
    )


@router.get("/responses/{response_id}", response_model=ResponseDetail)
def get_response(form_id: int, response_id: int, db: DB):
    form = form_service.get_form(db, form_id)
    return response_service.to_detail(form, response_service.get_response(db, form, response_id))


@router.delete("/responses/{response_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_response(form_id: int, response_id: int, db: DB) -> None:
    form = form_service.get_form(db, form_id)
    response_service.delete_response(db, response_service.get_response(db, form, response_id))


@router.get("/summary", response_model=FormSummary)
def get_summary(form_id: int, db: DB):
    return stats_service.summarize_form(db, form_service.get_form(db, form_id))
