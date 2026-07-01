from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas.stats import DailyStat

router = APIRouter(prefix="/languages/{course_id}/stats", tags=["stats"])


@router.get("/daily", response_model=list[DailyStat])
def daily_stats(course_id: int, db: Session = Depends(get_db)):
    if crud.course.get_course(db, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return crud.stats.get_daily_stats(db, course_id)
