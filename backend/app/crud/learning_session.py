import json
import random
import re
import unicodedata
import uuid
from datetime import datetime
from difflib import SequenceMatcher

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.learning_event import LearningEvent
from app.models.learning_session import LearningSession
from app.models.learning_session_item import LearningSessionItem
from app.models.word import Word
from app.schemas.learning_session import LearningAnswerRequest

BATCH_SIZE = 5


class LearningSessionError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 409, current=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.current = current


def _json_ids(value: str | None) -> list[int]:
    if not value:
        return []
    try:
        data = json.loads(value)
        return [int(v) for v in data] if isinstance(data, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _active_session(db: Session, course_id: int) -> LearningSession | None:
    return db.scalar(
        select(LearningSession).where(
            LearningSession.course_id == course_id,
            LearningSession.status == "active",
        )
    )


def _session(db: Session, course_id: int, session_id: int) -> LearningSession:
    session = db.get(LearningSession, session_id)
    if session is None or session.course_id != course_id:
        raise LearningSessionError("SESSION_NOT_FOUND", "Learning session not found", 404)
    return session


def _items(db: Session, session_id: int) -> list[LearningSessionItem]:
    return list(
        db.scalars(
            select(LearningSessionItem)
            .where(LearningSessionItem.session_id == session_id)
            .order_by(LearningSessionItem.queue_position, LearningSessionItem.id)
        )
    )


def _current_item(db: Session, session_id: int) -> LearningSessionItem | None:
    return db.scalar(
        select(LearningSessionItem)
        .where(
            LearningSessionItem.session_id == session_id,
            LearningSessionItem.item_status == "pending",
        )
        .order_by(LearningSessionItem.queue_position, LearningSessionItem.id)
        .limit(1)
    )


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip()).casefold()


def _strip_marks(value: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn"
    )


def _course_meaning_order(course: Course) -> list[int]:
    return [course.native_language_id, *[lang.id for lang in course.helper_languages]]


def _prompt_for(word: Word, course: Course) -> str | None:
    values = {meaning.language_id: meaning.value for meaning in word.meanings}
    ordered = [values[lang_id] for lang_id in _course_meaning_order(course) if values.get(lang_id)]
    if ordered:
        return " · ".join(ordered)
    return (word.definition_target or "").strip() or None


def _task_prompt(word: Word, course: Course, step: str) -> str | None:
    if step == "typing" and word.example_sentence:
        # Bosluk yerine Unicode kelime siniri kullan: "art," eslessin ama
        # "started" icindeki "art" yanlislikla gizlenmesin. Cok kelimeli
        # ifadelerde de yalniz ifadenin dis sinirlari denetlenir.
        pattern = re.compile(rf"(?<!\w){re.escape(word.term)}(?!\w)", re.IGNORECASE)
        if pattern.search(word.example_sentence):
            return pattern.sub("___", word.example_sentence, count=1)
    return _prompt_for(word, course)


def _accepted_answers(word: Word) -> list[str]:
    values = [word.term]
    if word.accepted_answers:
        values.extend(part.strip() for part in re.split(r"[,;\n]", word.accepted_answers))
    return [value for value in values if value]


def _distractor_ids(db: Session, word: Word) -> list[int]:
    seen = {_normalize(word.term)}
    candidates: list[tuple[float, int]] = []
    word_label_ids = {label.id for label in word.labels}
    levels = {level: index for index, level in enumerate(["A1", "A2", "B1", "B2", "C1", "C2"])}
    for candidate in db.scalars(
        select(Word).where(
            Word.course_id == word.course_id,
            Word.learning_status.in_(["learning", "learned"]),
        ).order_by(Word.id)
    ):
        key = _normalize(candidate.term)
        if candidate.id == word.id or key in seen:
            continue
        seen.add(key)
        confused = db.scalar(
            select(func.count(LearningEvent.id)).where(
                LearningEvent.word_id == word.id,
                LearningEvent.selected_word_id == candidate.id,
                LearningEvent.question_type == "choice",
                LearningEvent.result == "incorrect",
            )
        ) or 0
        score = min(confused, 3) * 5.0
        if word.part_of_speech and candidate.part_of_speech == word.part_of_speech:
            score += 3.0
        if word.level and candidate.level:
            distance = abs(levels[word.level] - levels[candidate.level])
            score += 2.0 if distance == 0 else (1.0 if distance == 1 else 0.0)
        if word_label_ids.intersection(label.id for label in candidate.labels):
            score += 1.0
        score += SequenceMatcher(None, _normalize(word.term), key).ratio()
        candidates.append((score, candidate.id))
    candidates.sort(key=lambda item: (-item[0], item[1]))
    return [candidate_id for _, candidate_id in candidates[:3]]


def _clear_attempt(item: LearningSessionItem) -> None:
    item.current_attempt_token = None
    item.current_option_word_ids = None


def _options_are_valid(db: Session, item: LearningSessionItem, word: Word) -> bool:
    ids = _json_ids(item.current_option_word_ids)
    if len(ids) < 2 or word.id not in ids or len(ids) != len(set(ids)):
        return False
    found = list(db.scalars(select(Word).where(Word.id.in_(ids), Word.course_id == word.course_id)))
    if len(found) != len(ids):
        return False
    normalized = [_normalize(candidate.term) for candidate in found]
    return len(normalized) == len(set(normalized))


def _prepare_attempt(db: Session, session: LearningSession) -> LearningSessionItem | None:
    item = _current_item(db, session.id)
    if item is None:
        return None
    word = db.get(Word, item.word_id)
    if word is None or word.learning_status != "learning":
        item.item_status = "cancelled"
        _clear_attempt(item)
        db.flush()
        return _prepare_attempt(db, session)

    if item.current_attempt_token:
        if item.current_step != "choice" or _options_are_valid(db, item, word):
            return item
        _clear_attempt(item)
        db.flush()

    option_ids: list[int] | None = None
    if item.current_step == "choice":
        distractors = _distractor_ids(db, word)
        if not distractors:
            item.current_step = "typing"
        else:
            option_ids = [word.id, *distractors]
            random.shuffle(option_ids)

    token = str(uuid.uuid4())
    option_json = json.dumps(option_ids) if option_ids is not None else None
    result = db.execute(
        update(LearningSessionItem)
        .where(
            LearningSessionItem.id == item.id,
            LearningSessionItem.current_attempt_token.is_(None),
        )
        .values(current_attempt_token=token, current_option_word_ids=option_json)
    )
    if result.rowcount == 0:
        db.expire(item)
        db.refresh(item)
        return item
    item.current_attempt_token = token
    item.current_option_word_ids = option_json
    return item


def _reconcile(db: Session, session: LearningSession) -> None:
    for item in _items(db, session.id):
        if item.item_status != "pending":
            continue
        word = db.get(Word, item.word_id)
        if word is None or word.learning_status != "learning":
            item.item_status = "cancelled"
            _clear_attempt(item)
    db.flush()
    _prepare_attempt(db, session)


def _word_dict(word: Word) -> Word:
    return word


def session_snapshot(db: Session, session: LearningSession) -> dict:
    items = _items(db, session.id)
    pending = [item for item in items if item.item_status == "pending"]
    phase = "terminal" if session.status != "active" else ("practice" if pending else "summary")
    current_task = None
    summary_items = []

    if phase == "practice":
        item = pending[0]
        word = db.get(Word, item.word_id)
        if word is not None and item.current_attempt_token:
            course = db.get(Course, session.course_id)
            option_ids = _json_ids(item.current_option_word_ids)
            option_words = {
                option.id: option
                for option in db.scalars(select(Word).where(Word.id.in_(option_ids)))
            } if option_ids else {}
            current_task = {
                "attempt_token": item.current_attempt_token,
                "question_type": item.current_step,
                "word": _word_dict(word),
                "prompt": _task_prompt(word, course, item.current_step) if item.current_step != "intro" else None,
                "options": [
                    {"word_id": option_id, "term": option_words[option_id].term}
                    for option_id in option_ids
                    if option_id in option_words
                ],
            }
    elif phase == "summary":
        for item in items:
            if item.item_status != "completed":
                continue
            word = db.get(Word, item.word_id)
            if word is None or word.learning_status != "learning":
                continue
            mistakes = db.scalar(
                select(func.count(LearningEvent.id)).where(
                    LearningEvent.session_item_id == item.id,
                    LearningEvent.result == "incorrect",
                )
            ) or 0
            summary_items.append({"word": word, "mistake_count": mistakes})

    return {
        "id": session.id,
        "course_id": session.course_id,
        "status": session.status,
        "phase": phase,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "completed_at": session.completed_at,
        "completed_word_ids": (
            _json_ids(session.completed_word_ids) if session.completed_word_ids is not None else None
        ),
        "progress": {
            "completed_count": sum(item.item_status == "completed" for item in items),
            "cancelled_count": sum(item.item_status == "cancelled" for item in items),
            "total_count": len(items),
        },
        "current_task": current_task,
        "summary_items": summary_items,
    }


def ensure_current(db: Session, course_id: int) -> dict | None:
    session = _active_session(db, course_id)
    if session is None:
        mistake_count = (
            select(func.count(LearningEvent.id))
            .where(
                LearningEvent.word_id == Word.id,
                LearningEvent.result == "incorrect",
            )
            .correlate(Word)
            .scalar_subquery()
        )
        words = list(
            db.scalars(
                select(Word)
                .where(Word.course_id == course_id, Word.learning_status == "learning")
                .order_by(mistake_count.desc(), Word.created_at, Word.id)
                .limit(BATCH_SIZE)
            )
        )
        if not words:
            return None
        session = LearningSession(course_id=course_id, status="active")
        db.add(session)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            session = _active_session(db, course_id)
            if session is None:
                raise
        else:
            for position, word in enumerate(words):
                db.add(
                    LearningSessionItem(
                        session_id=session.id,
                        word_id=word.id,
                        current_step="intro",
                        item_status="pending",
                        queue_position=position,
                    )
                )
            db.flush()
    _reconcile(db, session)
    session.updated_at = datetime.now()
    db.commit()
    db.refresh(session)
    return session_snapshot(db, session)


def _move_to_end(db: Session, item: LearningSessionItem) -> None:
    maximum = db.scalar(
        select(func.coalesce(func.max(LearningSessionItem.queue_position), -1)).where(
            LearningSessionItem.session_id == item.session_id
        )
    )
    item.queue_position = int(maximum or 0) + 1


def _same_replay(event: LearningEvent, data: LearningAnswerRequest) -> bool:
    return (
        event.question_type == data.question_type
        and event.selected_word_id == data.selected_word_id
        and event.submitted_answer == data.submitted_answer
    )


def answer(db: Session, course_id: int, session_id: int, data: LearningAnswerRequest) -> dict:
    existing = db.scalar(
        select(LearningEvent).where(LearningEvent.attempt_token == data.attempt_token)
    )
    if existing is not None:
        if existing.course_id != course_id or existing.session_id != session_id or not _same_replay(existing, data):
            raise LearningSessionError("TOKEN_REUSED", "Attempt token was reused with different data")
        session = _session(db, course_id, session_id)
        return {
            "result": existing.result,
            "correct_term": db.get(Word, existing.word_id).term if existing.result != "correct" else None,
            "session": session_snapshot(db, session),
        }

    session = _session(db, course_id, session_id)
    if session.status != "active":
        raise LearningSessionError("SESSION_NOT_ACTIVE", "Learning session is not active")
    _reconcile(db, session)
    item = _current_item(db, session.id)
    if item is None or item.current_attempt_token != data.attempt_token:
        raise LearningSessionError(
            "STALE_ATTEMPT",
            "The learning task is no longer current",
            current=session_snapshot(db, session),
        )
    if item.current_step != data.question_type:
        raise LearningSessionError("STALE_ATTEMPT", "The learning step is no longer current", current=session_snapshot(db, session))

    word = db.get(Word, item.word_id)
    course = db.get(Course, course_id)
    result: str
    direction: str
    if data.question_type == "intro":
        result, direction = "completed", "none"
    elif data.question_type == "choice":
        option_ids = _json_ids(item.current_option_word_ids)
        if data.selected_word_id not in option_ids:
            raise LearningSessionError("INVALID_OPTION", "Selected word is not a current option")
        result = "correct" if data.selected_word_id == word.id else "incorrect"
        direction = "recognition"
    else:
        given = _normalize(data.submitted_answer or "")
        accepted = [_normalize(value) for value in _accepted_answers(word)]
        if given in accepted:
            result = "correct"
        elif given and any(_strip_marks(given) == _strip_marks(value) for value in accepted):
            result = "minor_typo"
        else:
            result = "incorrect"
        direction = "production"

    db.add(
        LearningEvent(
            course_id=course_id,
            session_id=session.id,
            session_item_id=item.id,
            word_id=word.id,
            attempt_token=data.attempt_token,
            question_type=data.question_type,
            direction=direction,
            result=result,
            selected_word_id=data.selected_word_id,
            submitted_answer=data.submitted_answer,
        )
    )
    _clear_attempt(item)

    if data.question_type == "intro":
        if _prompt_for(word, course) is None:
            item.item_status = "completed"
        else:
            item.current_step = "choice" if _distractor_ids(db, word) else "typing"
            _move_to_end(db, item)
    elif data.question_type == "choice":
        if result == "correct":
            item.current_step = "typing"
        _move_to_end(db, item)
    elif result in {"correct", "minor_typo"}:
        item.item_status = "completed"
    else:
        item.current_step = "choice" if _distractor_ids(db, word) else "typing"
        _move_to_end(db, item)

    session.updated_at = datetime.now()
    db.flush()
    _prepare_attempt(db, session)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        replay = db.scalar(
            select(LearningEvent).where(LearningEvent.attempt_token == data.attempt_token)
        )
        if replay is None or not _same_replay(replay, data):
            raise
        session = _session(db, course_id, session_id)
        result = replay.result
    db.refresh(session)
    return {
        "result": result,
        "correct_term": word.term if result in {"incorrect", "minor_typo"} else None,
        "session": session_snapshot(db, session),
    }


def complete(db: Session, course_id: int, session_id: int, word_ids: list[int]) -> dict:
    from app.crud.word import apply_learning_status

    session = _session(db, course_id, session_id)
    canonical = sorted(set(word_ids))
    if session.status == "completed":
        if _json_ids(session.completed_word_ids) == canonical:
            return session_snapshot(db, session)
        raise LearningSessionError("SESSION_ALREADY_COMPLETED", "Session was completed with a different selection")
    if session.status != "active":
        raise LearningSessionError("SESSION_NOT_ACTIVE", "Learning session is not active")
    _reconcile(db, session)
    if _current_item(db, session.id) is not None:
        raise LearningSessionError("SESSION_NOT_READY", "Learning session still has pending items")

    eligible: dict[int, Word] = {}
    for item in _items(db, session.id):
        word = db.get(Word, item.word_id)
        if item.item_status == "completed" and word is not None and word.learning_status == "learning":
            eligible[word.id] = word
    if any(word_id not in eligible for word_id in canonical):
        raise LearningSessionError("WORD_NOT_ELIGIBLE", "A selected word is not eligible for graduation")
    for word_id in canonical:
        apply_learning_status(eligible[word_id], "learned")

    session.status = "completed"
    session.completed_at = datetime.now()
    session.updated_at = session.completed_at
    session.completed_word_ids = json.dumps(canonical)
    db.commit()
    db.refresh(session)
    return session_snapshot(db, session)


def cancel(db: Session, course_id: int, session_id: int) -> dict:
    session = _session(db, course_id, session_id)
    if session.status == "completed":
        raise LearningSessionError("SESSION_ALREADY_COMPLETED", "Completed session cannot be cancelled")
    if session.status == "cancelled":
        return session_snapshot(db, session)
    for item in _items(db, session.id):
        if item.item_status == "pending":
            item.item_status = "cancelled"
        _clear_attempt(item)
    session.status = "cancelled"
    session.updated_at = datetime.now()
    db.commit()
    db.refresh(session)
    return session_snapshot(db, session)


def reconcile_word_leaving_learning(db: Session, word: Word) -> None:
    session = _active_session(db, word.course_id)
    if session is None:
        return
    item = db.scalar(
        select(LearningSessionItem).where(
            LearningSessionItem.session_id == session.id,
            LearningSessionItem.word_id == word.id,
        )
    )
    if item is not None:
        item.item_status = "cancelled"
        _clear_attempt(item)
        db.flush()
        _prepare_attempt(db, session)


def invalidate_word_attempts(db: Session, word: Word) -> None:
    session = _active_session(db, word.course_id)
    if session is None:
        return
    for item in _items(db, session.id):
        if item.item_status != "pending" or not item.current_attempt_token:
            continue
        option_ids = _json_ids(item.current_option_word_ids)
        if item.word_id == word.id or word.id in option_ids:
            _clear_attempt(item)
    db.flush()
    _prepare_attempt(db, session)


def reconcile_after_delete(db: Session, course_id: int) -> None:
    session = _active_session(db, course_id)
    if session is not None:
        db.flush()
        _prepare_attempt(db, session)
