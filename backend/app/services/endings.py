from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models.ending import Ending
from app.models.form import Form
from app.schemas.ending import EndingCreate, EndingUpdate


def create_ending(db: Session, form_id: int, data: EndingCreate) -> Ending:
    form = db.get(Form, form_id)
    if not form:
        raise NotFoundError("Form not found")
        
    position = len(form.endings)
    ending = Ending(
        form_id=form_id,
        position=position,
        title=data.title,
        message=data.message,
        button_text=data.button_text,
        button_url=data.button_url,
        **data.model_dump(include={"attachment", "layout", "viewport_overrides"}),
    )
    db.add(ending)
    db.commit()
    db.refresh(ending)
    return ending


def list_endings(db: Session, form_id: int) -> list[Ending]:
    form = db.get(Form, form_id)
    if not form:
        raise NotFoundError("Form not found")
    return form.endings


def update_ending(db: Session, ending_id: int, data: EndingUpdate) -> Ending:
    ending = db.get(Ending, ending_id)
    if not ending:
        raise NotFoundError("Ending not found")
        
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ending, key, value)
        
    db.commit()
    db.refresh(ending)
    return ending


def delete_ending(db: Session, ending_id: int) -> None:
    ending = db.get(Ending, ending_id)
    if not ending:
        raise NotFoundError("Ending not found")
        
    form = ending.form
    if len(form.endings) <= 1:
        raise ConflictError("A form must have at least one ending")
        
    db.delete(ending)
    
    # Re-sequence remaining endings
    remaining = [e for e in form.endings if e.id != ending_id]
    remaining.sort(key=lambda e: e.position)
    
    for i, e in enumerate(remaining):
        e.position = i
        
    db.commit()


def reorder_endings(db: Session, form_id: int, ending_ids: list[int]) -> list[Ending]:
    form = db.get(Form, form_id)
    if not form:
        raise NotFoundError("Form not found")
        
    existing_ids = {e.id for e in form.endings}
    if set(ending_ids) != existing_ids:
        raise ConflictError("Must provide exactly the current ending IDs")
        
    # Temporary negative positions to avoid unique constraint violations
    for e in form.endings:
        e.position = -e.id - 1
    db.flush()
    
    ending_map = {e.id: e for e in form.endings}
    for i, e_id in enumerate(ending_ids):
        ending_map[e_id].position = i
        
    db.commit()
    return form.endings
