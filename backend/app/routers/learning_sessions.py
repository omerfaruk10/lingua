from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas.learning_session import (
    LearningAnswerRequest,
    LearningAnswerResponse,
    LearningCancelResponse,
    LearningCompleteRequest,
    LearningSessionRead,
)

router = APIRouter(
    prefix="/languages/{course_id}/learning-sessions", tags=["learning-sessions"]
)


def _ensure_course(db: Session, course_id: int) -> None:
    if crud.course.get_course(db, course_id) is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "COURSE_NOT_FOUND", "message": "Course not found"},
        )


def _http_error(exc: crud.learning_session.LearningSessionError) -> HTTPException:
    detail = {"code": exc.code, "message": exc.message}
    if exc.current is not None:
        detail["current_session"] = LearningSessionRead.model_validate(exc.current).model_dump(
            mode="json"
        )
    return HTTPException(status_code=exc.status_code, detail=detail)


@router.post("/current", response_model=LearningSessionRead, responses={204: {"description": "No learning words"}})
def current_session(course_id: int, response: Response, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    result = crud.learning_session.ensure_current(db, course_id)
    if result is None:
        response.status_code = 204
        return Response(status_code=204)
    return result


@router.post("/{session_id}/answer", response_model=LearningAnswerResponse)
def answer(
    course_id: int,
    session_id: int,
    data: LearningAnswerRequest,
    db: Session = Depends(get_db),
):
    _ensure_course(db, course_id)
    try:
        return crud.learning_session.answer(db, course_id, session_id, data)
    except crud.learning_session.LearningSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc


@router.post("/{session_id}/complete", response_model=LearningSessionRead)
def complete(
    course_id: int,
    session_id: int,
    data: LearningCompleteRequest,
    db: Session = Depends(get_db),
):
    _ensure_course(db, course_id)
    try:
        return crud.learning_session.complete(db, course_id, session_id, data.learned_word_ids)
    except crud.learning_session.LearningSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc


@router.post("/{session_id}/cancel", response_model=LearningCancelResponse)
def cancel(course_id: int, session_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    try:
        result = crud.learning_session.cancel(db, course_id, session_id)
        return {"session": result}
    except crud.learning_session.LearningSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc
