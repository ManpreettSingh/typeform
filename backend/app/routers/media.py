from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.media import generate_upload_signature

router = APIRouter(prefix="/media", tags=["media"])


class SignatureRequest(BaseModel):
    # What the builder uploads: images (default) or videos (video questions, video media).
    resource_type: Literal["image", "video"] = "image"


class SignatureResponse(BaseModel):
    upload_url: str
    api_key: str
    timestamp: int
    signature: str
    folder: str


@router.post("/sign", response_model=SignatureResponse)
def sign_upload(data: SignatureRequest | None = None):
    """Sign a Cloudinary upload request."""
    return generate_upload_signature(resource_type=(data or SignatureRequest()).resource_type)
