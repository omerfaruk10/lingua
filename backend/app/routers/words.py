from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models.word import Word
from app.schemas.word import (
    LearningStatus,
    WordCreate,
    WordImportRequest,
    WordImportResult,
    WordRead,
    WordReviewRequest,
    WordStatusUpdate,
    WordUpdate,
)

router = APIRouter(prefix="/languages/{course_id}/words", tags=["words"])


def _ensure_course(db: Session, course_id: int) -> None:
    if crud.course.get_course(db, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")


def _get_owned_word(db: Session, course_id: int, word_id: int) -> Word:
    word = crud.word.get_word(db, word_id)
    if word is None or word.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return word


def _get_owned_label(db: Session, course_id: int, label_id: int):
    label = crud.label.get_label(db, label_id)
    if label is None or label.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return label


@router.get("", response_model=list[WordRead])
def list_words(
    course_id: int,
    search: str | None = None,
    label_id: int | None = None,
    status: LearningStatus | None = None,
    db: Session = Depends(get_db),
):
    _ensure_course(db, course_id)
    return crud.word.get_words(
        db, course_id, search=search, label_id=label_id, status=status
    )


@router.post("", response_model=WordRead, status_code=status.HTTP_201_CREATED)
def create_word(course_id: int, data: WordCreate, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.word.create_word(db, course_id, data)


@router.post("/import", response_model=WordImportResult)
def import_words(course_id: int, data: WordImportRequest, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.word.import_words(db, course_id, data)


@router.get("/due", response_model=list[WordRead])
def list_due_words(course_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.word.get_due_words(db, course_id)


@router.get("/{word_id}", response_model=WordRead)
def get_word(course_id: int, word_id: int, db: Session = Depends(get_db)):
    return _get_owned_word(db, course_id, word_id)


@router.patch("/{word_id}", response_model=WordRead)
def update_word(course_id: int, word_id: int, data: WordUpdate, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    return crud.word.update_word(db, word, data)


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word(course_id: int, word_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    crud.word.delete_word(db, word)


@router.patch("/{word_id}/status", response_model=WordRead)
def set_word_status(
    course_id: int, word_id: int, data: WordStatusUpdate, db: Session = Depends(get_db)
):
    word = _get_owned_word(db, course_id, word_id)
    return crud.word.set_learning_status(db, word, data.status)


@router.post("/{word_id}/review", response_model=WordRead)
def review_word(
    course_id: int, word_id: int, data: WordReviewRequest, db: Session = Depends(get_db)
):
    word = _get_owned_word(db, course_id, word_id)
    return crud.word.review_word(db, word, data.result)


@router.post("/{word_id}/labels/{label_id}", response_model=WordRead)
def add_label_to_word(course_id: int, word_id: int, label_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    label = _get_owned_label(db, course_id, label_id)
    return crud.word.add_label(db, word, label)


@router.delete("/{word_id}/labels/{label_id}", response_model=WordRead)
def remove_label_from_word(course_id: int, word_id: int, label_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    label = _get_owned_label(db, course_id, label_id)
    return crud.word.remove_label(db, word, label)
