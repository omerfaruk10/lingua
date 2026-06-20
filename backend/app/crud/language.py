from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.language import Language
from app.schemas.language import LanguageCreate, LanguageUpdate


def get_languages(db: Session) -> list[Language]:
    return list(db.scalars(select(Language).order_by(Language.id)))


def get_language(db: Session, language_id: int) -> Language | None:
    return db.get(Language, language_id)


def get_language_by_code(db: Session, code: str) -> Language | None:
    return db.scalar(select(Language).where(Language.code == code))


def create_language(db: Session, data: LanguageCreate) -> Language:
    language = Language(**data.model_dump())
    db.add(language)
    db.commit()
    db.refresh(language)
    return language


def update_language(db: Session, language: Language, data: LanguageUpdate) -> Language:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(language, field, value)
    db.commit()
    db.refresh(language)
    return language


def delete_language(db: Session, language: Language) -> None:
    db.delete(language)
    db.commit()
