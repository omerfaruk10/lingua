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


def get_daily_stats(db: Session, language_id: int) -> list[dict]:
    """Ilk aktiviteden bugune kadar kesintisiz gunluk seri (eklenen + tekrar).

    Sifir gunler de dahil edilir ki takvim/heatmap bosluksuz olsun.
    """
    created = db.scalars(
        select(Word.created_at).where(Word.language_id == language_id)
    ).all()
    reviewed_ts = db.scalars(
        select(ReviewEvent.reviewed_at).where(ReviewEvent.language_id == language_id)
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
