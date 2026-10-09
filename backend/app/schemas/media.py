from typing import Any, Literal

from pydantic import BaseModel, Field

# http(s) only: these URLs end up in <img>/<video> sources.
WebUrl = Field(pattern=r"^https?://", max_length=2000)


class MediaAttachment(BaseModel):
    type: Literal["image", "video"] = "image"
    public_id: str
    url: str = WebUrl
    alt: str = ""
    focal_point: dict[str, Any] | None = None
    brightness: int | None = None
    scale: int | None = None


class MediaLayout(BaseModel):
    type: Literal["stack", "split", "float", "wallpaper"] = "stack"
    placement: Literal["left", "right"] | None = None


class QuestionVideo(BaseModel):
    """The creator's recorded or uploaded video that asks a video question."""

    url: str = WebUrl
    public_id: str


class MediaPropertiesMixin(BaseModel):
    attachment: MediaAttachment | None = None
    layout: MediaLayout | None = None
    viewport_overrides: dict[str, Any] | None = None
    # Question → Video (Typeform's video questions): the video is the question, shown above it; the title is optional.
    # None rather than False so properties only carry it once it's used (they're dumped with exclude_none).
    video_question: bool | None = None
    video: QuestionVideo | None = None
