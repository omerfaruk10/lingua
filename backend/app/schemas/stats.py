from datetime import date

from pydantic import BaseModel
from app.schemas.word import WordRead


class DailyStat(BaseModel):
    day: date
    learned: int  # o gun ogrenilen kelime sayisi
    reviewed: int  # o gun tekrar edilen benzersiz kelime sayisi


class DailyActivity(BaseModel):
    day: date
    learned_words: list[WordRead]
    reviewed_words: list[WordRead]
