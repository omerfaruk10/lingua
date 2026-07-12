from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LearningSessionItem(Base):
    __tablename__ = "learning_session_items"
    __table_args__ = (
        UniqueConstraint("session_id", "word_id", name="uq_learning_session_item_word"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("learning_sessions.id", ondelete="CASCADE"), index=True
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"), index=True
    )
    current_step: Mapped[str] = mapped_column(String(20), default="intro")
    item_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    queue_position: Mapped[int] = mapped_column(index=True)
    current_attempt_token: Mapped[str | None] = mapped_column(
        String(36), nullable=True, unique=True
    )
    current_option_word_ids: Mapped[str | None] = mapped_column(Text, default=None)
