from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models.label import Label
from app.schemas.label import LabelCreate, LabelRead, LabelUpdate

router = APIRouter(prefix="/languages/{course_id}/labels", tags=["labels"])


def _ensure_course(db: Session, course_id: int) -> None:
    if crud.course.get_course(db, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")


def _get_owned_label(db: Session, course_id: int, label_id: int) -> Label:
    label = crud.label.get_label(db, label_id)
    if label is None or label.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return label


@router.get("", response_model=list[LabelRead])
def list_labels(course_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.label.get_labels(db, course_id)


@router.post("", response_model=LabelRead, status_code=status.HTTP_201_CREATED)
def create_label(course_id: int, data: LabelCreate, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.label.create_label(db, course_id, data)


@router.patch("/{label_id}", response_model=LabelRead)
def update_label(course_id: int, label_id: int, data: LabelUpdate, db: Session = Depends(get_db)):
    label = _get_owned_label(db, course_id, label_id)
    return crud.label.update_label(db, label, data)


@router.delete("/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_label(course_id: int, label_id: int, db: Session = Depends(get_db)):
    label = _get_owned_label(db, course_id, label_id)
    crud.label.delete_label(db, label)
