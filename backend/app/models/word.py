from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.label import Label
    from app.models.word_meaning import WordMeaning


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )

    # Tek zorunlu alan term; gerisi opsiyonel (kullaniciyi kisitlamamak icin).
    term: Mapped[str] = mapped_column(String(200), index=True)  # gatto
    phonetic: Mapped[str | None] = mapped_column(String(200), default=None)  # gat·to (IPA)
    # Ana dilde yaklasik okunus (eski adi phonetic_tr; artik ana dile gore).
    phonetic_native: Mapped[str | None] = mapped_column(String(200), default=None)
    part_of_speech: Mapped[str | None] = mapped_column(String(50), default=None)  # isim/fiil...

    # Anlamlar (ana dil + yardimci diller) artik word_meanings tablosunda tutulur.
    definition_target: Mapped[str | None] = mapped_column(Text, default=None)  # hedef dilde tanim

    example_sentence: Mapped[str | None] = mapped_column(Text, default=None)
    example_translation: Mapped[str | None] = mapped_column(Text, default=None)

    # Ogrenme / aralikli tekrar (SRS) durumu.
    # new = baslanmadi, learning = tekrar dongusunde, learned = mezun.
    learning_status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    review_stage: Mapped[int] = mapped_column(default=0)  # INTERVALS icindeki konum
    next_review_date: Mapped[date | None] = mapped_column(Date, default=None, index=True)
    learned_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Cok-cok: secondary tablo adi string olarak verilir (dongusel import yok).
    # selectin: kelime okununca etiketleri tek ek sorguda yukler.
    labels: Mapped[list["Label"]] = relationship(secondary="word_labels", lazy="selectin")

    # Anlamlar: kelimeyle birlikte yuklenir, kelime silinince/temizlenince silinir.
    meanings: Mapped[list["WordMeaning"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
