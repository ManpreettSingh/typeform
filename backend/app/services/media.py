import hashlib
import time
from typing import Any

from app.core.config import get_settings

def generate_upload_signature(folder: str = "typeform") -> dict[str, Any]:
    settings = get_settings()
    
    # In test mode or when Cloudinary is not configured, direct uploads to the fake server.
    if not settings.cloudinary_api_secret:
        return {
            "upload_url": "http://localhost:8101/image/upload",
            "api_key": "fake_key",
            "timestamp": int(time.time()),
            "signature": "fake_signature",
            "folder": folder,
        }

    timestamp = int(time.time())
    # The string to sign must include all parameters except api_key, file, cloud_name, resource_type,
    # and they must be in alphabetical order.
    params_to_sign = f"folder={folder}&timestamp={timestamp}"
    string_to_sign = f"{params_to_sign}{settings.cloudinary_api_secret}"
    signature = hashlib.sha1(string_to_sign.encode("utf-8")).hexdigest()

    return {
        "upload_url": f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}/image/upload",
        "api_key": settings.cloudinary_api_key,
        "timestamp": timestamp,
        "signature": signature,
        "folder": folder,
    }
