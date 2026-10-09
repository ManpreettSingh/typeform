from typing import Any, Literal
from pydantic import BaseModel

class MediaAttachment(BaseModel):
    type: Literal["image"] = "image"
    public_id: str
    url: str
    alt: str = ""
    focal_point: dict[str, Any] | None = None
    brightness: int | None = None
    scale: int | None = None

class MediaLayout(BaseModel):
    type: Literal["stack", "split", "float", "wallpaper"] = "stack"
    placement: Literal["left", "right"] | None = None

class MediaPropertiesMixin(BaseModel):
    attachment: MediaAttachment | None = None
    layout: MediaLayout | None = None
    viewport_overrides: dict[str, Any] | None = None
