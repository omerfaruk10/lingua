from datetime import date, datetime
from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class ReviewSessionItem(Base):
    __tablename__ = "review_session_items"
    __table_args__ = (UniqueConstraint("session_id", "word_id", name="uq_review_session_item_word"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("review_sessions.id", ondelete="CASCADE"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    scheduled_date: Mapped[date] = mapped_column(Date)
    stage_at_start: Mapped[int] = mapped_column()
    item_status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    current_step: Mapped[str] = mapped_column(String(32), default="meaning")
    meaning_result: Mapped[str] = mapped_column(String(24), default="pending")
    context_result: Mapped[str] = mapped_column(String(24), default="pending")
    failure_action: Mapped[str | None] = mapped_column(String(24), default=None)
    queue_position: Mapped[int] = mapped_column(index=True)
    current_attempt_token: Mapped[str | None] = mapped_column(String(36), unique=True, nullable=True)
    current_option_word_ids: Mapped[str | None] = mapped_column(Text, default=None)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
