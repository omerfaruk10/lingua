from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.schemas.review_session import (
    ReviewAnswerRequest,
    ReviewAnswerResponse,
    ReviewDecisionRequest,
    ReviewOverviewRead,
    ReviewSessionRead,
)

router = APIRouter(
    prefix="/languages/{course_id}/review-sessions", tags=["review-sessions"]
)


def _ensure_course(db: Session, course_id: int) -> None:
    if crud.course.get_course(db, course_id) is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "COURSE_NOT_FOUND", "message": "Course not found"},
        )


def _http_error(exc: crud.review_session.ReviewSessionError) -> HTTPException:
    detail = {"code": exc.code, "message": exc.message}
    if exc.current is not None:
        detail["current_session"] = ReviewSessionRead.model_validate(exc.current).model_dump(
            mode="json"
        )
    return HTTPException(status_code=exc.status, detail=detail)


@router.get("/overview", response_model=ReviewOverviewRead)
def overview(course_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.review_session.overview(db, course_id)


@router.post(
    "/current",
    response_model=ReviewSessionRead,
    responses={204: {"description": "No due review words"}},
)
def current(course_id: int, response: Response, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    result = crud.review_session.ensure_current(db, course_id)
    if result is None:
        response.status_code = 204
        return Response(status_code=204)
    return result


@router.post("/{session_id}/answer", response_model=ReviewAnswerResponse)
def answer(
    course_id: int,
    session_id: int,
    data: ReviewAnswerRequest,
    db: Session = Depends(get_db),
):
    _ensure_course(db, course_id)
    try:
        return crud.review_session.answer(db, course_id, session_id, data)
    except crud.review_session.ReviewSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc


@router.post("/{session_id}/items/{item_id}/open-remediation", response_model=ReviewSessionRead)
def open_remediation(
    course_id: int, session_id: int, item_id: int, db: Session = Depends(get_db)
):
    _ensure_course(db, course_id)
    try:
        return crud.review_session.open_remediation(db, course_id, session_id, item_id)
    except crud.review_session.ReviewSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc


@router.post("/{session_id}/items/{item_id}/decision", response_model=ReviewSessionRead)
def decision(
    course_id: int,
    session_id: int,
    item_id: int,
    data: ReviewDecisionRequest,
    db: Session = Depends(get_db),
):
    _ensure_course(db, course_id)
    try:
        return crud.review_session.decide(db, course_id, session_id, item_id, data.action)
    except crud.review_session.ReviewSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc


@router.post("/{session_id}/cancel", response_model=ReviewSessionRead)
def cancel(course_id: int, session_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    try:
        return crud.review_session.cancel(db, course_id, session_id)
    except crud.review_session.ReviewSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc


@router.post("/{session_id}/complete", response_model=ReviewSessionRead)
def complete(course_id: int, session_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    try:
        return crud.review_session.complete(db, course_id, session_id)
    except crud.review_session.ReviewSessionError as exc:
        db.rollback()
        raise _http_error(exc) from exc
