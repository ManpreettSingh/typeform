from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.theme import ThemeGallery

router = APIRouter(prefix="/api/themes", tags=["themes"])

@router.get("")
def list_themes(db: Session = Depends(get_db)):
    """Returns the gallery of themes."""
    themes = db.scalars(select(ThemeGallery).order_by(ThemeGallery.id)).all()
    return [{"id": t.id, "name": t.name, "theme": t.theme} for t in themes]
