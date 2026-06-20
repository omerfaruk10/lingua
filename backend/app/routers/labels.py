from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models.label import Label
from app.schemas.label import LabelCreate, LabelRead, LabelUpdate

router = APIRouter(prefix="/languages/{language_id}/labels", tags=["labels"])


def _ensure_language(db: Session, language_id: int) -> None:
    if crud.language.get_language(db, language_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")


def _get_owned_label(db: Session, language_id: int, label_id: int) -> Label:
    label = crud.label.get_label(db, label_id)
    if label is None or label.language_id != language_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return label


@router.get("", response_model=list[LabelRead])
def list_labels(language_id: int, db: Session = Depends(get_db)):
    _ensure_language(db, language_id)
    return crud.label.get_labels(db, language_id)


@router.post("", response_model=LabelRead, status_code=status.HTTP_201_CREATED)
def create_label(language_id: int, data: LabelCreate, db: Session = Depends(get_db)):
    _ensure_language(db, language_id)
    return crud.label.create_label(db, language_id, data)


@router.patch("/{label_id}", response_model=LabelRead)
def update_label(language_id: int, label_id: int, data: LabelUpdate, db: Session = Depends(get_db)):
    label = _get_owned_label(db, language_id, label_id)
    return crud.label.update_label(db, label, data)


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_label(language_id: int, label_id: int, db: Session = Depends(get_db)):
    label = _get_owned_label(db, language_id, label_id)
    crud.label.delete_label(db, label)
