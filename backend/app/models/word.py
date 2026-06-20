from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.label import Label


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    language_id: Mapped[int] = mapped_column(
        ForeignKey("languages.id", ondelete="CASCADE"), index=True
    )

    # Tek zorunlu alan term; gerisi opsiyonel (kullaniciyi kisitlamamak icin).
    term: Mapped[str] = mapped_column(String(200), index=True)  # gatto
    phonetic: Mapped[str | None] = mapped_column(String(200), default=None)  # gat·to
    phonetic_tr: Mapped[str | None] = mapped_column(String(200), default=None)  # gatto (TR okunus)
    part_of_speech: Mapped[str | None] = mapped_column(String(50), default=None)  # isim/fiil...

    meaning_native: Mapped[str | None] = mapped_column(Text, default=None)  # kedi
    meaning_english: Mapped[str | None] = mapped_column(Text, default=None)  # cat (kopru dil)
    definition_target: Mapped[str | None] = mapped_column(Text, default=None)  # hedef dilde tanim

    example_sentence: Mapped[str | None] = mapped_column(Text, default=None)
    example_translation: Mapped[str | None] = mapped_column(Text, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Cok-cok: secondary tablo adi string olarak verilir (dongusel import yok).
    # selectin: kelime okununca etiketleri tek ek sorguda yukler.
    labels: Mapped[list["Label"]] = relationship(secondary="word_labels", lazy="selectin")
