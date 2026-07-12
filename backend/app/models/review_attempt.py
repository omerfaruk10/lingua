from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class ReviewAttempt(Base):
    __tablename__ = "review_attempts"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("review_sessions.id", ondelete="CASCADE"), index=True)
    session_item_id: Mapped[int] = mapped_column(ForeignKey("review_session_items.id", ondelete="CASCADE"), index=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), index=True)
    attempt_token: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    question_type: Mapped[str] = mapped_column(String(32))
    result: Mapped[str] = mapped_column(String(24))
    selected_word_id: Mapped[int | None] = mapped_column(ForeignKey("words.id", ondelete="SET NULL"), nullable=True)
    submitted_answer: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
