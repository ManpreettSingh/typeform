from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import NotFoundError
from app.models import QuestionType, Response, ResponseStatus
from app.question_types.files import MAX_FILE_BYTES
from app.schemas.public import (
    PartialStartOut,
    PartialUpdateIn,
    PartialUpdateOut,
    PublicForm,
    SubmissionIn,
    SubmissionOut,
    UploadSignatureOut,
)
from app.services import submissions as submission_service
from app.services.media import generate_upload_signature

router = APIRouter(prefix="/public", tags=["public"])

DB = Annotated[Session, Depends(get_db)]


@router.get("/forms/{slug}", response_model=PublicForm)
def get_public_form(slug: str, db: DB):
    form = submission_service.get_published_form(db, slug)
    count = None
    if form.welcome.get("show_submission_count"):
        count = db.scalar(select(func.count(Response.id)).where(Response.form_id == form.id, Response.status == ResponseStatus.COMPLETED))
    
    # We can inject this into the form object temporarily for Pydantic to read
    form.submission_count = count
    return form


@router.post("/forms/{slug}/views", status_code=status.HTTP_204_NO_CONTENT)
def record_view(slug: str, db: DB) -> None:
    """Called once per visit by the public page; feeds Results → Form performance → Views."""
    submission_service.record_view(db, submission_service.get_published_form(db, slug))


@router.post("/forms/{slug}/uploads", response_model=UploadSignatureOut)
def sign_file_upload(slug: str, db: DB):
    """Signs one respondent upload straight to Cloudinary, into the form's own folder.

    Only for published forms that ask for a file, so the signature can't be used as free storage for anything else.
    The size limit is checked by the respondent's browser and again on the stored answer (question_types/files.py).
    """
    form = submission_service.get_published_form(db, slug)
    if not any(q.type == QuestionType.FILE_UPLOAD for q in form.questions):
        raise NotFoundError("This form doesn't take file uploads")
    return UploadSignatureOut(
        **generate_upload_signature(folder=f"responses/{form.slug}", resource_type="auto"), max_bytes=MAX_FILE_BYTES
    )


@router.post("/forms/{slug}/responses", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def submit_response(slug: str, data: SubmissionIn, db: DB):
    form = submission_service.get_published_form(db, slug)
    return submission_service.create_submission(db, form, data.answers)


@router.post(
    "/forms/{slug}/responses/start", response_model=PartialStartOut, status_code=status.HTTP_201_CREATED
)
def start_response(slug: str, db: DB):
    response = submission_service.start_response(db, submission_service.get_published_form(db, slug))
    return PartialStartOut(response_id=response.id, token=response.meta["token"])


@router.patch("/responses/{response_id}", response_model=PartialUpdateOut)
def save_progress(response_id: int, data: PartialUpdateIn, db: DB):
    response = submission_service.get_open_response(db, response_id, data.token)
    return submission_service.save_progress(db, response, data.answers, data.complete)
