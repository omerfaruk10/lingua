import json
import random
import re
import uuid
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.learning_session import (
    _accepted_answers,
    _distractor_ids,
    _normalize,
    _prompt_for,
    _strip_marks,
)
from app.models.course import Course
from app.models.review_attempt import ReviewAttempt
from app.models.review_event import ReviewEvent
from app.models.review_session import ReviewSession
from app.models.review_session_item import ReviewSessionItem
from app.models.word import Word
from app.schemas.review_session import ReviewAnswerRequest

INTERVALS = [1, 3, 7, 14, 30]
PASSING_RESULTS = {"correct", "minor_typo", "skipped_missing_data"}


class ReviewSessionError(Exception):
    def __init__(self, code: str, message: str, status: int = 409, current=None):
        self.code = code
        self.message = message
        self.status = status
        self.current = current


def _active(db: Session, course_id: int) -> ReviewSession | None:
    return db.scalar(
        select(ReviewSession).where(
            ReviewSession.course_id == course_id,
            ReviewSession.status == "active",
        )
    )


def _session(db: Session, course_id: int, session_id: int) -> ReviewSession:
    session = db.get(ReviewSession, session_id)
    if session is None or session.course_id != course_id:
        raise ReviewSessionError("SESSION_NOT_FOUND", "Review session not found", 404)
    if session.status != "active":
        raise ReviewSessionError("SESSION_NOT_ACTIVE", "Review session is not active")
    return session


def _items(db: Session, session_id: int) -> list[ReviewSessionItem]:
    return list(
        db.scalars(
            select(ReviewSessionItem)
            .where(ReviewSessionItem.session_id == session_id)
            .order_by(ReviewSessionItem.queue_position, ReviewSessionItem.id)
        )
    )


def _pending_initial(db: Session, session_id: int) -> ReviewSessionItem | None:
    return db.scalar(
        select(ReviewSessionItem)
        .where(
            ReviewSessionItem.session_id == session_id,
            ReviewSessionItem.item_status == "pending",
        )
        .order_by(ReviewSessionItem.queue_position, ReviewSessionItem.id)
        .limit(1)
    )


def _token_item(db: Session, session_id: int) -> ReviewSessionItem | None:
    return db.scalar(
        select(ReviewSessionItem).where(
            ReviewSessionItem.session_id == session_id,
            ReviewSessionItem.current_attempt_token.is_not(None),
        )
    )


def _json_ids(value: str | None) -> list[int]:
    try:
        return [int(item) for item in json.loads(value or "[]")]
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _clear_attempt(item: ReviewSessionItem) -> None:
    item.current_attempt_token = None
    item.current_option_word_ids = None


def _context_prompt(word: Word) -> str | None:
    if not word.example_sentence:
        return None
    pattern = re.compile(rf"(?<!\w){re.escape(word.term)}(?!\w)", re.IGNORECASE)
    if not pattern.search(word.example_sentence):
        return None
    return pattern.sub("___", word.example_sentence, count=1)


def _add_missing_data_attempt(
    db: Session,
    session: ReviewSession,
    item: ReviewSessionItem,
    word: Word,
    question_type: str,
) -> None:
    db.add(
        ReviewAttempt(
            course_id=session.course_id,
            session_id=session.id,
            session_item_id=item.id,
            word_id=word.id,
            attempt_token=str(uuid.uuid4()),
            question_type=question_type,
            result="skipped_missing_data",
        )
    )
    setattr(item, f"{question_type}_result", "skipped_missing_data")


def _issue_attempt(db: Session, item: ReviewSessionItem, word: Word) -> None:
    if item.current_attempt_token:
        return
    option_ids: list[int] | None = None
    if item.current_step == "remediation_choice":
        distractors = _distractor_ids(db, word)
        if distractors:
            option_ids = [word.id, *distractors]
            random.shuffle(option_ids)
        else:
            item.current_step = "remediation_typing"
    item.current_attempt_token = str(uuid.uuid4())
    item.current_option_word_ids = json.dumps(option_ids) if option_ids else None
    db.flush()


def _next_success_schedule(word: Word, today: date) -> tuple[int, date | None]:
    next_stage = word.review_stage + 1
    if next_stage >= len(INTERVALS):
        return next_stage, None
    if word.review_retry_anchor_date is not None:
        anchored = word.review_retry_anchor_date + timedelta(days=INTERVALS[next_stage])
        return next_stage, max(anchored, today + timedelta(days=1))
    return next_stage, today + timedelta(days=INTERVALS[next_stage])


def _add_final_event(
    db: Session,
    session: ReviewSession,
    item: ReviewSessionItem,
    word: Word,
    result: str,
    action: str | None = None,
) -> None:
    db.add(
        ReviewEvent(
            word_id=word.id,
            course_id=session.course_id,
            result=result,
            session_id=session.id,
            session_item_id=item.id,
            scheduled_date=item.scheduled_date,
            completed_stage=item.stage_at_start,
            next_stage=word.review_stage,
            resulting_review_date=word.next_review_date,
            meaning_result=item.meaning_result,
            context_result=item.context_result,
            failure_action=action,
        )
    )


def _finish_initial(
    db: Session, session: ReviewSession, item: ReviewSessionItem, word: Word
) -> None:
    if not {item.meaning_result, item.context_result}.issubset(PASSING_RESULTS):
        item.item_status = "initial_failed"
        _clear_attempt(item)
        db.flush()
        return
    next_stage, next_date = _next_success_schedule(word, date.today())
    word.review_stage = next_stage
    word.next_review_date = next_date
    word.review_retry_anchor_date = None
    item.item_status = "completed"
    item.finalized_at = datetime.now()
    _clear_attempt(item)
    _add_final_event(db, session, item, word, "success")
    db.flush()


def _prepare_initial(db: Session, session: ReviewSession) -> None:
    while True:
        item = _pending_initial(db, session.id)
        if item is None:
            return
        word = db.get(Word, item.word_id)
        course = db.get(Course, session.course_id)
        if word is None or word.learning_status != "learned":
            item.item_status = "cancelled"
            _clear_attempt(item)
            db.flush()
            continue
        if item.current_attempt_token:
            return
        if item.current_step == "meaning" and _prompt_for(word, course) is None:
            _add_missing_data_attempt(db, session, item, word, "meaning")
            item.current_step = "context"
            db.flush()
            continue
        if item.current_step == "context" and _context_prompt(word) is None:
            _add_missing_data_attempt(db, session, item, word, "context")
            item.current_step = "done"
            _finish_initial(db, session, item, word)
            continue
        _issue_attempt(db, item, word)
        return


def _phase(items: list[ReviewSessionItem], session: ReviewSession) -> str:
    if session.status != "active":
        return "terminal"
    if any(item.item_status == "pending" for item in items):
        return "testing"
    if any(
        item.item_status in {"initial_failed", "remediation", "awaiting_decision"}
        for item in items
    ):
        return "results_remediation"
    return "terminal_ready"


def snapshot(db: Session, session: ReviewSession) -> dict:
    items = _items(db, session.id)
    current = _token_item(db, session.id)
    task = None
    if current is not None:
        word = db.get(Word, current.word_id)
        course = db.get(Course, session.course_id)
        option_ids = _json_ids(current.current_option_word_ids)
        option_words = {
            candidate.id: candidate
            for candidate in db.scalars(select(Word).where(Word.id.in_(option_ids)))
        } if option_ids else {}
        prompt = None
        if current.current_step == "meaning":
            prompt = _prompt_for(word, course)
        elif current.current_step == "context":
            prompt = _context_prompt(word)
        task = {
            "attempt_token": current.current_attempt_token,
            "question_type": current.current_step,
            "word": word,
            "prompt": prompt,
            "options": [
                {"word_id": word_id, "term": option_words[word_id].term}
                for word_id in option_ids
                if word_id in option_words
            ],
        }
    return {
        "id": session.id,
        "course_id": session.course_id,
        "status": session.status,
        "phase": _phase(items, session),
        "current_task": task,
        "items": [
            {
                "id": item.id,
                "word": word,
                "item_status": item.item_status,
                "current_step": item.current_step,
                "meaning_result": item.meaning_result,
                "context_result": item.context_result,
                "failure_action": item.failure_action,
                "scheduled_date": str(item.scheduled_date),
                "stage_at_start": item.stage_at_start,
                "finalized_at": item.finalized_at.isoformat() if item.finalized_at else None,
            }
            for item in items
            if (word := db.get(Word, item.word_id)) is not None
        ],
    }


def ensure_current(db: Session, course_id: int) -> dict | None:
    session = _active(db, course_id)
    if session is None:
        words = list(
            db.scalars(
                select(Word)
                .where(
                    Word.course_id == course_id,
                    Word.learning_status == "learned",
                    Word.next_review_date.is_not(None),
                    Word.next_review_date <= date.today(),
                )
                .order_by(Word.next_review_date, Word.review_stage, Word.id)
                .limit(5)
            )
        )
        if not words:
            return None
        session = ReviewSession(course_id=course_id)
        db.add(session)
        db.flush()
        for position, word in enumerate(words):
            db.add(
                ReviewSessionItem(
                    session_id=session.id,
                    word_id=word.id,
                    scheduled_date=word.next_review_date,
                    stage_at_start=word.review_stage,
                    queue_position=position,
                )
            )
        db.flush()
    _prepare_initial(db, session)
    db.commit()
    return snapshot(db, session)


def _same_request(attempt: ReviewAttempt, data: ReviewAnswerRequest) -> bool:
    return (
        attempt.question_type == data.question_type
        and attempt.selected_word_id == data.selected_word_id
        and (attempt.submitted_answer or None) == (data.submitted_answer or None)
        and (attempt.result == "skipped_by_user") == data.skip
    )


def answer(
    db: Session, course_id: int, session_id: int, data: ReviewAnswerRequest
) -> dict:
    session = _session(db, course_id, session_id)
    previous = db.scalar(
        select(ReviewAttempt).where(ReviewAttempt.attempt_token == data.attempt_token)
    )
    if previous is not None:
        if previous.session_id != session.id or not _same_request(previous, data):
            raise ReviewSessionError(
                "IDEMPOTENCY_CONFLICT", "Attempt token was already used with another payload"
            )
        word = db.get(Word, previous.word_id)
        return {
            "result": previous.result,
            "correct_term": word.term if previous.result not in {"correct"} else None,
            "session": snapshot(db, session),
        }

    item = _token_item(db, session.id)
    if item is None or item.current_attempt_token != data.attempt_token:
        raise ReviewSessionError(
            "STALE_ATTEMPT", "Task is stale", current=snapshot(db, session)
        )
    if item.current_step != data.question_type:
        raise ReviewSessionError(
            "STALE_ATTEMPT", "Question type does not match the current task",
            current=snapshot(db, session),
        )
    word = db.get(Word, item.word_id)
    question_type = item.current_step
    if question_type == "remediation_choice":
        if data.selected_word_id not in _json_ids(item.current_option_word_ids):
            raise ReviewSessionError("INVALID_OPTION", "Invalid option", 422)
        result = "correct" if data.selected_word_id == word.id else "incorrect"
    elif data.skip:
        result = "skipped_by_user"
    else:
        submitted = _normalize(data.submitted_answer or "")
        accepted = [_normalize(value) for value in _accepted_answers(word)]
        if submitted in accepted:
            result = "correct"
        elif submitted and any(_strip_marks(submitted) == _strip_marks(value) for value in accepted):
            result = "minor_typo"
        else:
            result = "incorrect"
    db.add(
        ReviewAttempt(
            course_id=course_id,
            session_id=session.id,
            session_item_id=item.id,
            word_id=word.id,
            attempt_token=data.attempt_token,
            question_type=question_type,
            result=result,
            selected_word_id=data.selected_word_id,
            submitted_answer=data.submitted_answer,
        )
    )
    _clear_attempt(item)
    if question_type in {"meaning", "context"}:
        setattr(item, f"{question_type}_result", result)
        item.current_step = "context" if question_type == "meaning" else "done"
        if item.current_step == "done":
            _finish_initial(db, session, item, word)
        _prepare_initial(db, session)
    elif question_type == "remediation_choice":
        item.current_step = "remediation_typing"
        _issue_attempt(db, item, word)
    elif result in {"correct", "minor_typo", "skipped_by_user"}:
        item.item_status = "awaiting_decision"
    else:
        item.current_step = "remediation_typing"
        _issue_attempt(db, item, word)
    db.commit()
    return {
        "result": result,
        "correct_term": word.term if result != "correct" else None,
        "session": snapshot(db, session),
    }


def open_remediation(db: Session, course_id: int, session_id: int, item_id: int) -> dict:
    session = _session(db, course_id, session_id)
    item = db.get(ReviewSessionItem, item_id)
    if item is None or item.session_id != session.id or item.item_status != "initial_failed":
        raise ReviewSessionError("ITEM_NOT_REMEDIABLE", "Item is not ready for remediation")
    if _token_item(db, session.id) is not None:
        raise ReviewSessionError("ANOTHER_TASK_ACTIVE", "Complete the current task first")
    item.item_status = "remediation"
    item.current_step = "remediation_choice"
    _issue_attempt(db, item, db.get(Word, item.word_id))
    db.commit()
    return snapshot(db, session)


def decide(
    db: Session, course_id: int, session_id: int, item_id: int, action: str
) -> dict:
    session = _session(db, course_id, session_id)
    item = db.get(ReviewSessionItem, item_id)
    if item is None or item.session_id != session.id or item.item_status != "awaiting_decision":
        raise ReviewSessionError("ITEM_NOT_AWAITING_DECISION", "Decision is not allowed")
    word = db.get(Word, item.word_id)
    today = date.today()
    if action == "retry_tomorrow":
        word.review_retry_anchor_date = word.review_retry_anchor_date or item.scheduled_date
        word.next_review_date = today + timedelta(days=1)
        result = "failed_retry"
    elif action == "restart":
        word.review_stage = 0
        word.review_retry_anchor_date = None
        word.next_review_date = today + timedelta(days=1)
        result = "failed_restart"
    else:
        raise ReviewSessionError("INVALID_DECISION", "Unknown failure decision", 422)
    item.failure_action = action
    item.item_status = "completed"
    item.finalized_at = datetime.now()
    _add_final_event(db, session, item, word, result, action)
    db.commit()
    return snapshot(db, session)


def cancel(db: Session, course_id: int, session_id: int) -> dict:
    session = _session(db, course_id, session_id)
    for item in _items(db, session.id):
        if item.item_status != "completed":
            item.item_status = "cancelled"
            _clear_attempt(item)
    session.status = "cancelled"
    db.commit()
    return snapshot(db, session)


def complete(db: Session, course_id: int, session_id: int) -> dict:
    session = _session(db, course_id, session_id)
    if any(item.item_status not in {"completed", "cancelled"} for item in _items(db, session.id)):
        raise ReviewSessionError("SESSION_NOT_READY", "Session is not ready to complete")
    session.status = "completed"
    session.completed_at = datetime.now()
    db.commit()
    return snapshot(db, session)


def overview(db: Session, course_id: int) -> dict:
    session = _active(db, course_id)
    active = snapshot(db, session) if session else None
    used_ids = {item.word_id for item in _items(db, session.id)} if session else set()
    query = (
        select(Word)
        .where(
            Word.course_id == course_id,
            Word.learning_status == "learned",
            Word.next_review_date.is_not(None),
            Word.next_review_date <= date.today(),
        )
        .order_by(Word.next_review_date, Word.review_stage, Word.id)
    )
    if used_ids:
        query = query.where(Word.id.not_in(used_ids))
    waiting = list(db.scalars(query))
    day_start = datetime.combine(date.today(), time.min)
    day_end = day_start + timedelta(days=1)
    events = list(
        db.scalars(
            select(ReviewEvent)
            .where(
                ReviewEvent.course_id == course_id,
                ReviewEvent.reviewed_at >= day_start,
                ReviewEvent.reviewed_at < day_end,
            )
            .order_by(ReviewEvent.reviewed_at, ReviewEvent.id)
        )
    )
    return {
        "active_session": active,
        "waiting_due_words": waiting,
        "reviewed_today": [
            {
                "word": word,
                "result": event.result,
                "reviewed_at": event.reviewed_at.isoformat(),
                "next_review_date": (
                    str(event.resulting_review_date) if event.resulting_review_date else None
                ),
            }
            for event in events
            if (word := db.get(Word, event.word_id)) is not None
        ],
    }


def reconcile_word_leaving_review(db: Session, word: Word) -> None:
    """Kelime silinirken veya learned durumundan çıkarken aktif oturumu uzlaştırır."""
    item = db.scalar(
        select(ReviewSessionItem)
        .join(ReviewSession, ReviewSession.id == ReviewSessionItem.session_id)
        .where(
            ReviewSession.course_id == word.course_id,
            ReviewSession.status == "active",
            ReviewSessionItem.word_id == word.id,
            ReviewSessionItem.item_status != "completed",
        )
    )
    if item is not None:
        item.item_status = "cancelled"
        _clear_attempt(item)
        db.flush()
