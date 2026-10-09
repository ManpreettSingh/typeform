from fastapi import APIRouter
from pydantic import BaseModel

from app.services.media import generate_upload_signature

router = APIRouter(prefix="/media", tags=["media"])

class SignatureResponse(BaseModel):
    upload_url: str
    api_key: str
    timestamp: int
    signature: str
    folder: str

@router.post("/sign", response_model=SignatureResponse)
def sign_upload():
    """Sign a Cloudinary upload request."""
    return generate_upload_signature()
