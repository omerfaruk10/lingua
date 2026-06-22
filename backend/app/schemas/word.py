from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.label import LabelRead

LearningStatus = Literal["new", "learning", "learned"]


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
    learning_status: LearningStatus
    review_stage: int
    next_review_date: date | None
    learned_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WordStatusUpdate(BaseModel):
    status: LearningStatus


class WordReviewRequest(BaseModel):
    result: Literal["known", "forgot"]
