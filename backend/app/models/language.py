from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Language(Base):
    __tablename__ = "languages"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)  # it, es, de
    name: Mapped[str] = mapped_column(String(100))  # Italian
    native_name: Mapped[str] = mapped_column(String(100))  # Italiano
    order_index: Mapped[int] = mapped_column(default=0)  # kullanici sirasi
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
