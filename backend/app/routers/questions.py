from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.question import QuestionOut, QuestionUpdate
from app.services import questions as question_service

router = APIRouter(prefix="/questions", tags=["questions"])

DB = Annotated[Session, Depends(get_db)]


@router.patch("/{question_id}", response_model=QuestionOut)
def update_question(question_id: int, data: QuestionUpdate, db: DB):
    return question_service.update_question(db, question_service.get_question(db, question_id), data)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: DB) -> None:
    question_service.delete_question(db, question_service.get_question(db, question_id))
