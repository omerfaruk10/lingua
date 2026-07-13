from datetime import date, datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.crud.label import create_label, get_labels
from app.models.label import Label
from app.models.review_event import ReviewEvent
from app.models.word import Word
from app.models.word_meaning import WordMeaning
from app.schemas.label import LabelCreate, LabelRead
from app.schemas.word import (
    LearningStatus,
    WordCreate,
    WordImportRequest,
    WordImportResult,
    WordImportRowError,
    WordUpdate,
)

# Aralikli tekrar merdiveni (gun). Bir kelime baslatildiginda 1 gun sonra,
# sonra 3, 7, 14, 30 gun aralarla tekrar edilir; sonuncuyu gecince "ogrenildi".
INTERVALS = [1, 3, 7, 14, 30]


def _utc_now_naive() -> datetime:
    """SQLite DateTime alanlari icin UTC, timezone bilgisiz zaman damgasi."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_words(
    db: Session,
    course_id: int,
    search: str | None = None,
    label_id: int | None = None,
    status: LearningStatus | None = None,
    level: str | None = None,
    part_of_speech: str | None = None,
) -> list[Word]:
    stmt = select(Word).where(Word.course_id == course_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Word.term.ilike(pattern),
                Word.meanings.any(WordMeaning.value.ilike(pattern)),
            )
        )
    if label_id is not None:
        stmt = stmt.where(Word.labels.any(Label.id == label_id))
    if status is not None:
        stmt = stmt.where(Word.learning_status == status)
    if level is not None:
        stmt = stmt.where(Word.level == level)
    if part_of_speech is not None:
        stmt = stmt.where(Word.part_of_speech == part_of_speech)
    stmt = stmt.order_by(Word.created_at.asc(), Word.id.asc())  # en eski altta, yeni en alta eklenir
    return list(db.scalars(stmt))


def get_due_words(db: Session, course_id: int) -> list[Word]:
    """Bugun (ve gecmiste) tekrar vakti gelmis, ogrenilmis kelimeler.

    Tekrar programini 'learned' durumu tetikler: kelime ogrenildi isaretlenince
    1/3/7/14/30 gun aralarla burada cikar; merdiven bitince (next_review_date
    None) artik cikmaz ama 'learned' kalir.
    """
    stmt = (
        select(Word)
        .where(
            Word.course_id == course_id,
            Word.learning_status == "learned",
            Word.next_review_date.is_not(None),
            Word.next_review_date <= date.today(),
        )
        .order_by(Word.next_review_date.asc(), Word.id.asc())
    )
    return list(db.scalars(stmt))


def apply_learning_status(word: Word, status: LearningStatus) -> None:
    """Commit etmeden durum/SRS alanlarini birlikte degistirir."""
    word.learning_status = status
    if status == "learned":
        # Ogrenildi -> tekrar programini baslat (zaten programdaysa dokunma).
        if word.next_review_date is None and word.review_stage == 0:
            word.next_review_date = date.today() + timedelta(days=INTERVALS[0])
        if word.learned_at is None:
            word.learned_at = _utc_now_naive()
    else:  # new / learning: programda degil
        word.review_stage = 0
        word.next_review_date = None
        word.review_retry_anchor_date = None
        word.learned_at = None


def set_learning_status(db: Session, word: Word, status: LearningStatus) -> Word:
    """Durum dropdown'i: durumu degistirir ve aktif ogrenme oturumunu uzlastirir."""
    if word.learning_status == "learning" and status != "learning":
        from app.crud.learning_session import reconcile_word_leaving_learning

        reconcile_word_leaving_learning(db, word)
    if word.learning_status == "learned" and status != "learned":
        from app.crud.review_session import reconcile_word_leaving_review

        reconcile_word_leaving_review(db, word)
    apply_learning_status(word, status)
    db.commit()
    db.refresh(word)
    return word


def review_word(db: Session, word: Word, result: str) -> Word:
    """'Bugun Tekrar': biliyordum -> bir basamak ilerle; unutmusum -> basa don.

    Kelime 'learned' kalir (tekrar edilen kelime ogrenilmis olandir). Merdiven
    sonuna gelince next_review_date None olur (pekisti, artik due degil).
    Her cagrida bir ReviewEvent loglanir (istatistik gecmisi).
    """
    today = date.today()
    if result == "known":
        new_stage = word.review_stage + 1
        if new_stage >= len(INTERVALS):
            word.review_stage = len(INTERVALS)
            word.next_review_date = None
        else:
            word.review_stage = new_stage
            word.next_review_date = today + timedelta(days=INTERVALS[new_stage])
    else:  # forgot -> merdiveni basa al, yine programda kal
        word.review_stage = 0
        word.next_review_date = today + timedelta(days=INTERVALS[0])

    word.learning_status = "learned"
    if word.learned_at is None:
        word.learned_at = _utc_now_naive()

    db.add(
        ReviewEvent(word_id=word.id, course_id=word.course_id, result=result)
    )
    db.commit()
    db.refresh(word)
    return word


def add_label(db: Session, word: Word, label: Label) -> Word:
    if label not in word.labels:
        word.labels.append(label)
        db.commit()
        db.refresh(word)
    return word


def remove_label(db: Session, word: Word, label: Label) -> Word:
    if label in word.labels:
        word.labels.remove(label)
        db.commit()
        db.refresh(word)
    return word


def get_word(db: Session, word_id: int) -> Word | None:
    return db.get(Word, word_id)


def _meaning_rows(meanings: list[dict]) -> list[WordMeaning]:
    """Bos value'lari atlayarak WordMeaning satirlari uretir; ayni dil bir kez."""
    rows: list[WordMeaning] = []
    seen: set[int] = set()
    for m in meanings:
        value = (m.get("value") or "").strip()
        lang_id = m.get("language_id")
        if not value or lang_id is None or lang_id in seen:
            continue
        seen.add(lang_id)
        rows.append(WordMeaning(language_id=lang_id, value=value))
    return rows


def create_word(db: Session, course_id: int, data: WordCreate) -> Word:
    payload = data.model_dump()
    meanings = payload.pop("meanings", [])
    word = Word(course_id=course_id, **payload)
    word.meanings = _meaning_rows(meanings)
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def update_word(db: Session, word: Word, data: WordUpdate) -> Word:
    payload = data.model_dump(exclude_unset=True)
    meanings = payload.pop("meanings", None)
    for field, value in payload.items():
        setattr(word, field, value)
    if meanings is not None:
        # Gonderilen anlamlar mevcutlarin tamamiyla yerini alir. Once eskileri silip
        # flush ediyoruz; aksi halde ayni (word, language) icin INSERT eskisinin DELETE'i
        # oncesine dusup UNIQUE kisitini ihlal edebilir.
        word.meanings = []
        db.flush()
        word.meanings = _meaning_rows(meanings)
    if any(key in payload for key in {"term", "definition_target"}) or meanings is not None:
        from app.crud.learning_session import invalidate_word_attempts

        invalidate_word_attempts(db, word)
    db.commit()
    db.refresh(word)
    return word


def delete_word(db: Session, word: Word) -> None:
    from app.crud.learning_session import invalidate_word_attempts, reconcile_after_delete

    course_id = word.course_id
    invalidate_word_attempts(db, word)
    from app.crud.review_session import reconcile_word_leaving_review

    reconcile_word_leaving_review(db, word)
    db.delete(word)
    db.flush()
    reconcile_after_delete(db, course_id)
    db.commit()


def _resolve_batch_label(
    db: Session, course_id: int, name: str | None, color: str | None
) -> Label | None:
    """Partinin etiketini bulur (case-insensitive isim) ya da yoksa olusturur."""
    name = (name or "").strip()
    if not name:
        return None
    existing = next(
        (l for l in get_labels(db, course_id) if l.name.strip().lower() == name.lower()),
        None,
    )
    if existing is not None:
        return existing
    return create_label(db, course_id, LabelCreate(name=name, color=color))


def import_words(db: Session, course_id: int, data: WordImportRequest) -> WordImportResult:
    """CSV'den toplu kelime ekler/gunceller. Satir hatalari diger satirlari durdurmaz
    (best-effort): gecerli satirlar islenir, hatali olanlar raporlanir."""
    label = _resolve_batch_label(db, course_id, data.label_name, data.label_color)

    created = 0
    replaced = 0
    errors: list[WordImportRowError] = []

    for idx, row in enumerate(data.rows, start=1):
        if not row.term.strip():
            errors.append(WordImportRowError(row=idx, message="Term is empty"))
            continue

        payload = row.model_dump(exclude={"action", "replace_word_id"})
        meanings = payload.pop("meanings", [])

        if row.action == "replace":
            if row.replace_word_id is None:
                errors.append(
                    WordImportRowError(row=idx, message="replace_word_id is required for replace")
                )
                continue
            word = get_word(db, row.replace_word_id)
            if word is None or word.course_id != course_id:
                errors.append(WordImportRowError(row=idx, message="Word to replace not found"))
                continue
            for field, value in payload.items():
                setattr(word, field, value)
            word.meanings = []
            db.flush()
            word.meanings = _meaning_rows(meanings)
            replaced += 1
        else:
            word = Word(course_id=course_id, **payload)
            word.meanings = _meaning_rows(meanings)
            db.add(word)
            created += 1

        if label is not None and label not in word.labels:
            word.labels.append(label)

    db.commit()
    if label is not None:
        db.refresh(label)
    label_read = LabelRead.model_validate(label) if label is not None else None
    return WordImportResult(created=created, replaced=replaced, errors=errors, label=label_read)
