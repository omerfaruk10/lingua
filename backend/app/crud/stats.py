from collections import Counter
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.review_event import ReviewEvent
from app.models.word import Word


def _local_day(ts: datetime) -> date:
    """Naive-UTC saklanan zaman damgasini yerel takvim gunune cevirir.

    created_at / reviewed_at SQLite'ta UTC (CURRENT_TIMESTAMP) tutulur; 'o gun'
    dogru ciksin diye sunucunun yerel saatine cevirip tarihe indiriyoruz.
    """
    return ts.replace(tzinfo=timezone.utc).astimezone().date()


def get_daily_stats(db: Session, course_id: int) -> list[dict]:
    """Ilk aktiviteden bugune kadar kesintisiz gunluk seri (eklenen + tekrar).

    Sifir gunler de dahil edilir ki takvim/heatmap bosluksuz olsun.
    """
    created = db.scalars(
        select(Word.created_at).where(Word.course_id == course_id)
    ).all()
    reviewed_ts = db.scalars(
        select(ReviewEvent.reviewed_at).where(ReviewEvent.course_id == course_id)
    ).all()

    added: Counter[date] = Counter(_local_day(ts) for ts in created if ts)
    reviewed: Counter[date] = Counter(_local_day(ts) for ts in reviewed_ts if ts)

    today = datetime.now().date()
    all_days = list(added.keys()) + list(reviewed.keys())
    start = min(all_days) if all_days else today

    result: list[dict] = []
    cur = start
    while cur <= today:
        result.append(
            {"day": cur, "added": added.get(cur, 0), "reviewed": reviewed.get(cur, 0)}
        )
        cur += timedelta(days=1)
    return result


def get_daily_activity(db: Session, course_id: int, day: date) -> dict:
    words = list(db.scalars(select(Word).where(Word.course_id == course_id)))
    learned = [word for word in words if word.learned_at and _local_day(word.learned_at) == day]
    events = list(db.scalars(select(ReviewEvent).where(ReviewEvent.course_id == course_id)))
    reviewed_ids = []
    for event in events:
        if event.reviewed_at and _local_day(event.reviewed_at) == day and event.word_id not in reviewed_ids:
            reviewed_ids.append(event.word_id)
    by_id = {word.id: word for word in words}
    return {"day": day, "learned_words": learned, "reviewed_words": [by_id[word_id] for word_id in reviewed_ids if word_id in by_id]}
