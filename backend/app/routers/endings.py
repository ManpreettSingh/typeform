from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.ending import EndingCreate, EndingOut, EndingUpdate
from app.services import endings as ending_service

router = APIRouter(tags=["endings"])

DB = Annotated[Session, Depends(get_db)]

@router.post("/forms/{form_id}/endings", response_model=EndingOut, status_code=status.HTTP_201_CREATED)
def create_ending(form_id: int, data: EndingCreate, db: DB):
    return ending_service.create_ending(db, form_id, data)

@router.get("/forms/{form_id}/endings", response_model=list[EndingOut])
def list_endings(form_id: int, db: DB):
    return ending_service.list_endings(db, form_id)

@router.put("/forms/{form_id}/endings/order", response_model=list[EndingOut])
def reorder_endings(form_id: int, ending_ids: list[int], db: DB):
    return ending_service.reorder_endings(db, form_id, ending_ids)

@router.patch("/endings/{ending_id}", response_model=EndingOut)
def update_ending(ending_id: int, data: EndingUpdate, db: DB):
    return ending_service.update_ending(db, ending_id, data)

@router.delete("/endings/{ending_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ending(ending_id: int, db: DB) -> None:
    ending_service.delete_ending(db, ending_id)
