from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LanguageBase(BaseModel):
    code: str
    name: str
    native_name: str


class LanguageCreate(LanguageBase):
    pass


class LanguageUpdate(BaseModel):
    # PATCH: gonderilen alanlar guncellenir, gerisi dokunulmaz.
    code: str | None = None
    name: str | None = None
    native_name: str | None = None
    order_index: int | None = None


class LanguageRead(LanguageBase):
    model_config = ConfigDict(from_attributes=True)  # ORM nesnesinden okuyabilsin

    id: int
    order_index: int
    created_at: datetime
