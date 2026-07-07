from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.label import LabelRead

LearningStatus = Literal["new", "learning", "learned"]


class WordMeaningIn(BaseModel):
    language_id: int
    value: str | None = None


class WordMeaningRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    language_id: int
    value: str


class WordBase(BaseModel):
    term: str
    phonetic: str | None = None
    phonetic_native: str | None = None
    part_of_speech: str | None = None
    definition_target: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    synonyms: str | None = None
    antonyms: str | None = None
    word_family: str | None = None


class WordCreate(WordBase):
    # Anlamlar: ana dil + yardimci diller (language_id'ye gore). Bos value'lar atlanir.
    meanings: list[WordMeaningIn] = []


class WordUpdate(BaseModel):
    # Hepsi opsiyonel; gonderilmeyen alana dokunulmaz, acikca null gelen alan temizlenir.
    term: str | None = None
    phonetic: str | None = None
    phonetic_native: str | None = None
    part_of_speech: str | None = None
    definition_target: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    synonyms: str | None = None
    antonyms: str | None = None
    word_family: str | None = None
    # meanings gonderilirse mevcut anlamlar tamamen bununla degistirilir.
    meanings: list[WordMeaningIn] | None = None


class WordRead(WordBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    meanings: list[WordMeaningRead] = []
    labels: list[LabelRead] = []
    learning_status: LearningStatus
    review_stage: int
    next_review_date: date | None
    learned_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WordSuggestRequest(BaseModel):
    term: str


class WordSense(BaseModel):
    part_of_speech: str | None = None
    # language_id -> anlam metni (frontend dogru anlam kutusuna yazsin diye).
    meanings: dict[int, str] = {}


class WordSuggestResponse(BaseModel):
    # Kelimenin en yaygin anlamlari (en fazla 5); kullanici hangisini istedigini secer.
    senses: list[WordSense] = []


class WordSuggestDetailsRequest(BaseModel):
    term: str
    part_of_speech: str | None = None
    meaning: str


class WordSuggestDetailsResponse(BaseModel):
    phonetic: str | None = None
    phonetic_native: str | None = None
    definition_target: str | None = None
    example_sentence: str | None = None
    example_translation: str | None = None
    synonyms: str | None = None
    antonyms: str | None = None
    word_family: str | None = None


class WordStatusUpdate(BaseModel):
    status: LearningStatus


class WordReviewRequest(BaseModel):
    result: Literal["known", "forgot"]


class WordImportRow(WordCreate):
    # 'create' -> yeni kelime; 'replace' -> replace_word_id'deki kelimenin uzerine yaz.
    action: Literal["create", "replace"] = "create"
    replace_word_id: int | None = None


class WordImportRequest(BaseModel):
    rows: list[WordImportRow]
    # Tum partiye uygulanacak tek etiket (dosya adindan turetilir). Yoksa etiket atanmaz.
    label_name: str | None = None
    # Sadece etiket YENI olusturulursa kullanilir (frontend kendi paletinden gonderir).
    label_color: str | None = None


class WordImportRowError(BaseModel):
    row: int
    message: str


class WordImportResult(BaseModel):
    created: int
    replaced: int
    errors: list[WordImportRowError]
    label: LabelRead | None = None
