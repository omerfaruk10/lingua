from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WordMeaning(Base):
    """Bir kelimenin belirli bir dildeki anlami.

    Ana dil anlami + her yardimci dil anlami burada ayri satir olarak durur;
    boylece kurs kac dil tanimlarsa tanimlasin model esnek kalir. language_id
    anlamin yazildigi dili (katalog satiri) gosterir.
    """

    __tablename__ = "word_meanings"
    __table_args__ = (UniqueConstraint("word_id", "language_id", name="uq_word_language"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"), index=True
    )
    language_id: Mapped[int] = mapped_column(
        ForeignKey("languages.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[str] = mapped_column(Text)
