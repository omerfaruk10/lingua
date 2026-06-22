from datetime import date

from pydantic import BaseModel


class DailyStat(BaseModel):
    day: date
    added: int  # o gun eklenen kelime sayisi
    reviewed: int  # o gun yapilan tekrar sayisi
