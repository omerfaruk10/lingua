from datetime import date

from pydantic import BaseModel
from app.schemas.word import WordRead


class DailyStat(BaseModel):
    day: date
    added: int  # o gun eklenen kelime sayisi
    reviewed: int  # o gun yapilan tekrar sayisi


class DailyActivity(BaseModel):
    day: date
    learned_words: list[WordRead]
    reviewed_words: list[WordRead]
