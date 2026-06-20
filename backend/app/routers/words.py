from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models.word import Word
from app.schemas.word import WordCreate, WordRead, WordUpdate

router = APIRouter(prefix="/languages/{language_id}/words", tags=["words"])


def _ensure_language(db: Session, language_id: int) -> None:
    if crud.language.get_language(db, language_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")


def _get_owned_word(db: Session, language_id: int, word_id: int) -> Word:
    word = crud.word.get_word(db, word_id)
    if word is None or word.language_id != language_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return word


def _get_owned_label(db: Session, language_id: int, label_id: int):
    label = crud.label.get_label(db, label_id)
    if label is None or label.language_id != language_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return label


@router.get("", response_model=list[WordRead])
def list_words(
    language_id: int,
    search: str | None = None,
    label_id: int | None = None,
    db: Session = Depends(get_db),
):
    _ensure_language(db, language_id)
    return crud.word.get_words(db, language_id, search=search, label_id=label_id)


@router.post("", response_model=WordRead, status_code=status.HTTP_201_CREATED)
def create_word(language_id: int, data: WordCreate, db: Session = Depends(get_db)):
    _ensure_language(db, language_id)
    return crud.word.create_word(db, language_id, data)


@router.get("/{word_id}", response_model=WordRead)
def get_word(language_id: int, word_id: int, db: Session = Depends(get_db)):
    return _get_owned_word(db, language_id, word_id)


@router.patch("/{word_id}", response_model=WordRead)
def update_word(language_id: int, word_id: int, data: WordUpdate, db: Session = Depends(get_db)):
    word = _get_owned_word(db, language_id, word_id)
    return crud.word.update_word(db, word, data)


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word(language_id: int, word_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, language_id, word_id)
    crud.word.delete_word(db, word)


@router.post("/{word_id}/labels/{label_id}", response_model=WordRead)
def add_label_to_word(language_id: int, word_id: int, label_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, language_id, word_id)
    label = _get_owned_label(db, language_id, label_id)
    return crud.word.add_label(db, word, label)


@router.delete("/{word_id}/labels/{label_id}", response_model=WordRead)
def remove_label_from_word(language_id: int, word_id: int, label_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, language_id, word_id)
    label = _get_owned_label(db, language_id, label_id)
    return crud.word.remove_label(db, word, label)
