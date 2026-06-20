from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.label import LabelRead


class WordBase(BaseModel):
    term: str
    phonetic: str | None = None
    phonetic_tr: str | None = None
    part_of_speech: str | None = None
    meaning_native: str | None = None
    meaning_english: str | None = None
    definition_target: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None


class WordCreate(WordBase):
    pass


class WordUpdate(BaseModel):
    # Hepsi opsiyonel; gonderilmeyen alana dokunulmaz, acikca null gelen alan temizlenir.
    term: str | None = None
    phonetic: str | None = None
    phonetic_tr: str | None = None
    part_of_speech: str | None = None
    meaning_native: str | None = None
    meaning_english: str | None = None
    definition_target: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None


class WordRead(WordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    language_id: int
    labels: list[LabelRead] = []
    created_at: datetime
    updated_at: datetime
