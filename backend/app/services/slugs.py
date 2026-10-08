import secrets
import string

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import Form

SLUG_ALPHABET = string.ascii_letters + string.digits
SLUG_LENGTH = 8  # 62^8 ≈ 2e14 — collisions are practically impossible, but still checked.
MAX_ATTEMPTS = 10


def generate_unique_slug(db: Session) -> str:
    for _ in range(MAX_ATTEMPTS):
        slug = "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))
        if not db.scalar(select(exists().where(Form.slug == slug))):
            return slug
    raise RuntimeError("Could not generate a unique slug")
