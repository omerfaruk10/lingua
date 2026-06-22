from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ReviewEvent(Base):
    """Her tekrar islemini loglar; istatistik (gunluk aktivite) bundan beslenir.

    Kelimenin anlik durumu Word uzerinde tutulur; burasi gecmisi tutar ki
    dashboard 'gun basina kac tekrar' gosterebilsin.
    """

    __tablename__ = "review_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"), index=True
    )
    # Per-dil sorgulari kolaylassin diye denormalize edildi.
    language_id: Mapped[int] = mapped_column(
        ForeignKey("languages.id", ondelete="CASCADE"), index=True
    )
    result: Mapped[str] = mapped_column(String(10))  # known | forgot
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )
