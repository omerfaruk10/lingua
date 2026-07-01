from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.crud.language import CourseError
from app.database import get_db
from app.schemas.language import (
    CourseCreate,
    CourseRead,
    CourseUpdate,
    LanguageBrief,
)

router = APIRouter(prefix="/languages", tags=["languages"])


def _raise_course_error(exc: CourseError) -> None:
    # "Zaten var" -> 409 Conflict; diger is kurali ihlalleri -> 400 Bad Request.
    code = status.HTTP_409_CONFLICT if "already exists" in str(exc) else status.HTTP_400_BAD_REQUEST
    raise HTTPException(status_code=code, detail=str(exc)) from exc


@router.get("", response_model=list[CourseRead])
def list_courses(db: Session = Depends(get_db)):
    """Aktif kurslar (LanguagesPage)."""
    return crud.course.get_courses(db)


@router.get("/catalog", response_model=list[LanguageBrief])
def list_catalog(db: Session = Depends(get_db)):
    """Hedef/ana/yardimci dil secimleri icin secilebilir diller."""
    return crud.language.get_catalog(db)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(data: CourseCreate, db: Session = Depends(get_db)):
    try:
        return crud.course.create_course(db, data)
    except CourseError as exc:
        _raise_course_error(exc)


@router.get("/{course_id}", response_model=CourseRead)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.patch("/{course_id}", response_model=CourseRead)
def update_course(course_id: int, data: CourseUpdate, db: Session = Depends(get_db)):
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    try:
        return crud.course.update_course(db, course, data)
    except CourseError as exc:
        _raise_course_error(exc)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    crud.course.delete_course(db, course)
