from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
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
    # Per-kurs sorgulari kolaylassin diye denormalize edildi.
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    result: Mapped[str] = mapped_column(String(24))  # legacy known/forgot + V3 final outcomes
    session_id: Mapped[int | None] = mapped_column(ForeignKey("review_sessions.id", ondelete="CASCADE"), nullable=True, index=True)
    session_item_id: Mapped[int | None] = mapped_column(ForeignKey("review_session_items.id", ondelete="CASCADE"), nullable=True, index=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resulting_review_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    meaning_result: Mapped[str | None] = mapped_column(String(24), nullable=True)
    context_result: Mapped[str | None] = mapped_column(String(24), nullable=True)
    failure_action: Mapped[str | None] = mapped_column(String(24), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )
