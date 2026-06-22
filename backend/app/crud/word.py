from datetime import date, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.label import Label
from app.models.review_event import ReviewEvent
from app.models.word import Word
from app.schemas.word import LearningStatus, WordCreate, WordUpdate

# Aralikli tekrar merdiveni (gun). Bir kelime baslatildiginda 1 gun sonra,
# sonra 3, 7, 14, 30 gun aralarla tekrar edilir; sonuncuyu gecince "ogrenildi".
INTERVALS = [1, 3, 7, 14, 30]


def get_words(
    db: Session,
    language_id: int,
    search: str | None = None,
    label_id: int | None = None,
    status: LearningStatus | None = None,
) -> list[Word]:
    stmt = select(Word).where(Word.language_id == language_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Word.term.ilike(pattern),
                Word.meaning_native.ilike(pattern),
                Word.meaning_english.ilike(pattern),
            )
        )
    if label_id is not None:
        stmt = stmt.where(Word.labels.any(Label.id == label_id))
    if status is not None:
        stmt = stmt.where(Word.learning_status == status)
    stmt = stmt.order_by(Word.created_at.asc(), Word.id.asc())  # en eski altta, yeni en alta eklenir
    return list(db.scalars(stmt))


def get_due_words(db: Session, language_id: int) -> list[Word]:
    """Bugun (ve gecmiste) tekrar vakti gelmis, ogrenilmis kelimeler.

    Tekrar programini 'learned' durumu tetikler: kelime ogrenildi isaretlenince
    1/3/7/14/30 gun aralarla burada cikar; merdiven bitince (next_review_date
    None) artik cikmaz ama 'learned' kalir.
    """
    stmt = (
        select(Word)
        .where(
            Word.language_id == language_id,
            Word.learning_status == "learned",
            Word.next_review_date.is_not(None),
            Word.next_review_date <= date.today(),
        )
        .order_by(Word.next_review_date.asc(), Word.id.asc())
    )
    return list(db.scalars(stmt))


def set_learning_status(db: Session, word: Word, status: LearningStatus) -> Word:
    """Durum dropdown'i: durumu degistirir ve tekrar programini tutarli tutar."""
    word.learning_status = status
    if status == "learned":
        # Ogrenildi -> tekrar programini baslat (zaten programdaysa dokunma).
        if word.next_review_date is None and word.review_stage == 0:
            word.next_review_date = date.today() + timedelta(days=INTERVALS[0])
        if word.learned_at is None:
            word.learned_at = datetime.now()
    else:  # new / learning: programda degil
        word.review_stage = 0
        word.next_review_date = None
        word.learned_at = None
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
        word.learned_at = datetime.now()

    db.add(
        ReviewEvent(word_id=word.id, language_id=word.language_id, result=result)
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


def create_word(db: Session, language_id: int, data: WordCreate) -> Word:
    word = Word(language_id=language_id, **data.model_dump())
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


def update_word(db: Session, word: Word, data: WordUpdate) -> Word:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(word, field, value)
    db.commit()
    db.refresh(word)
    return word


def delete_word(db: Session, word: Word) -> None:
    db.delete(word)
    db.commit()
