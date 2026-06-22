from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas.stats import DailyStat

router = APIRouter(prefix="/languages/{language_id}/stats", tags=["stats"])


@router.get("/daily", response_model=list[DailyStat])
def daily_stats(language_id: int, db: Session = Depends(get_db)):
    if crud.language.get_language(db, language_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
    return crud.stats.get_daily_stats(db, language_id)
