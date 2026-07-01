from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.language import Language
from app.schemas.language import LangRef

# Sistemi tohumladigimiz ~6 dil (ogrenme amacli). Hem hedef hem ana/yardimci dil
# secimlerinde bu katalog kullanilir. database.ensure_schema da bunu seed eder.
CATALOG_SEED: list[tuple[str, str, str]] = [
    ("tr", "Turkish", "Türkçe"),
    ("en", "English", "English"),
    ("it", "Italian", "Italiano"),
    ("es", "Spanish", "Español"),
    ("de", "German", "Deutsch"),
    ("fr", "French", "Français"),
]


class CourseError(ValueError):
    """Kurs olusturma/guncelleme is kurali hatasi (router 4xx'e cevirir)."""


def get_catalog(db: Session) -> list[Language]:
    """Dropdown'lar icin secilebilir diller (ad-hoc/gizli olanlar haric)."""
    return list(
        db.scalars(
            select(Language).where(Language.is_catalog.is_(True)).order_by(Language.name)
        )
    )


def get_language(db: Session, language_id: int) -> Language | None:
    return db.get(Language, language_id)


def get_language_by_code(db: Session, code: str) -> Language | None:
    return db.scalar(select(Language).where(Language.code == code))


def resolve_ref(db: Session, ref: LangRef) -> Language:
    """Bir LangRef'i gercek Language satirina cevirir.

    id -> mevcut dil; yoksa code ile eslesen varsa o; hic yoksa ad-hoc (gizli) olustur.
    """
    if ref.id is not None:
        lang = db.get(Language, ref.id)
        if lang is None:
            raise CourseError(f"Language id {ref.id} not found")
        return lang

    code = (ref.code or "").strip()
    if not code:
        raise CourseError("Language code is required for a new language")
    existing = get_language_by_code(db, code)
    if existing is not None:
        return existing

    name = (ref.name or code).strip()
    lang = Language(
        code=code,
        name=name,
        native_name=(ref.native_name or name).strip(),
        is_catalog=False,  # 'o anlik' eklenen dil: katalogda gorunmez
        order_index=0,
    )
    db.add(lang)
    db.flush()  # id lazim
    return lang
