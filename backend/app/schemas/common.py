from typing import Annotated, ClassVar

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PatchModel(StrictModel):
    """PATCH body: omitted fields are left untouched; fields in NON_NULLABLE may not be sent as null."""

    NON_NULLABLE: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="after")
    def _reject_nulls(self):
        for name in self.NON_NULLABLE:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self
