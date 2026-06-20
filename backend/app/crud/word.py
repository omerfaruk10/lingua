from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.label import Label
from app.models.word import Word
from app.schemas.word import WordCreate, WordUpdate


def get_words(
    db: Session,
    language_id: int,
    search: str | None = None,
    label_id: int | None = None,
) -> list[Word]:
    stmt = select(Word).where(Word.language_id == language_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Word.term.ilike(pattern),
                Word.meaning_native.ilike(pattern),
                Word.meaning_english.ilike(pattern),
            )
        )
    if label_id is not None:
        stmt = stmt.where(Word.labels.any(Label.id == label_id))
    stmt = stmt.order_by(Word.created_at.desc(), Word.id.desc())  # en yeni ustte
    return list(db.scalars(stmt))


def add_label(db: Session, word: Word, label: Label) -> Word:
    if label not in word.labels:
        word.labels.append(label)
        db.commit()
        db.refresh(word)
    return word


def remove_label(db: Session, word: Word, label: Label) -> Word:
    if label in word.labels:
        word.labels.remove(label)
        db.commit()
        db.refresh(word)
    return word


def get_word(db: Session, word_id: int) -> Word | None:
    return db.get(Word, word_id)


def create_word(db: Session, language_id: int, data: WordCreate) -> Word:
    word = Word(language_id=language_id, **data.model_dump())
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def update_word(db: Session, word: Word, data: WordUpdate) -> Word:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(word, field, value)
    db.commit()
    db.refresh(word)
    return word


def delete_word(db: Session, word: Word) -> None:
    db.delete(word)
    db.commit()
