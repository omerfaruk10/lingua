from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Table, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.language import Language

# Bir kursun 0-3 yardimci dili olabilir (cok-cok).
course_helpers = Table(
    "course_helpers",
    Base.metadata,
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("language_id", ForeignKey("languages.id", ondelete="CASCADE"), primary_key=True),
    Column("position", Integer, nullable=False, server_default="0"),
)


class Course(Base):
    """Bir ogrenme kurulumu: hedef dil + ana dil + 0-3 yardimci dil.

    Ayni hedef dil icin birden fazla kurs olabilir (orn. Italyancayi bir kere
    Turkce ana dille, bir kere Ingilizce ana dille ogrenmek) -- target/native
    sadece birer FK oldugu icin tekillik kisitlamasi yok. words/topics/labels/
    review_events bu Course.id'ye baglidir (FK alanlarinin adi 'course_id').
    """

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    target_language_id: Mapped[int] = mapped_column(ForeignKey("languages.id"), index=True)
    native_language_id: Mapped[int] = mapped_column(ForeignKey("languages.id"))
    order_index: Mapped[int] = mapped_column(default=0)  # kullanici sirasi (kurslar arasi)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    target_language: Mapped["Language"] = relationship(
        "Language", foreign_keys=[target_language_id], lazy="selectin"
    )
    native_language: Mapped["Language"] = relationship(
        "Language", foreign_keys=[native_language_id], lazy="selectin"
    )
    helper_languages: Mapped[list["Language"]] = relationship(
        "Language",
        secondary=course_helpers,
        order_by=course_helpers.c.position,
        lazy="selectin",
    )

    # Goruntuleme kolayligi icin hedef dilin bilgilerini disa yansitir
    # (LanguageBrief sekillerini olusturmasi kolay olsun diye).
    @property
    def code(self) -> str:
        return self.target_language.code

    @property
    def name(self) -> str:
        return self.target_language.name

    @property
    def native_name(self) -> str:
        return self.target_language.native_name
