from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas.language import LanguageCreate, LanguageRead, LanguageUpdate

router = APIRouter(prefix="/languages", tags=["languages"])


@router.get("", response_model=list[LanguageRead])
def list_languages(db: Session = Depends(get_db)):
    return crud.language.get_languages(db)


@router.post("", response_model=LanguageRead, status_code=status.HTTP_201_CREATED)
def create_language(data: LanguageCreate, db: Session = Depends(get_db)):
    if crud.language.get_language_by_code(db, data.code):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Language code '{data.code}' already exists",
        )
    return crud.language.create_language(db, data)


@router.get("/{language_id}", response_model=LanguageRead)
def get_language(language_id: int, db: Session = Depends(get_db)):
    language = crud.language.get_language(db, language_id)
    if language is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
    return language


@router.patch("/{language_id}", response_model=LanguageRead)
def update_language(language_id: int, data: LanguageUpdate, db: Session = Depends(get_db)):
    language = crud.language.get_language(db, language_id)
    if language is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
    return crud.language.update_language(db, language, data)


@router.delete("/{language_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_language(language_id: int, db: Session = Depends(get_db)):
    language = crud.language.get_language(db, language_id)
    if language is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
    crud.language.delete_language(db, language)
