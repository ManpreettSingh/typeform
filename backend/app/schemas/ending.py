from pydantic import ConfigDict, Field

from app.schemas.common import PatchModel, StrictModel


class EndingCreate(StrictModel):
    title: str = Field(default="Thanks for completing this form", max_length=200)
    message: str = Field(default="Your response has been recorded.", max_length=1000)
    button_text: str | None = Field(default=None, max_length=50)
    button_url: str | None = Field(default=None, max_length=2000, pattern=r"^https?://")


class EndingUpdate(PatchModel):
    NON_NULLABLE = ("title", "message")

    title: str | None = Field(default=None, max_length=200)
    message: str | None = Field(default=None, max_length=1000)
    button_text: str | None = Field(default=None, max_length=50)
    button_url: str | None = Field(default=None, max_length=2000, pattern=r"^https?://")


class EndingOut(EndingCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    position: int
