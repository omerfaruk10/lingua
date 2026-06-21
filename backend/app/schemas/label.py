from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LabelBase(BaseModel):
    name: str
    color: str | None = None


class LabelCreate(LabelBase):
    pass


class LabelUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    order_index: int | None = None


class LabelRead(LabelBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    language_id: int
    order_index: int
    created_at: datetime
