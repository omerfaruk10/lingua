from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models.word import Word
from app.schemas.word import (
    LearningStatus,
    WordCreate,
    WordCounts,
    WordImportRequest,
    WordImportResult,
    WordPage,
    WordRead,
    WordReviewRequest,
    WordSense,
    WordStatusUpdate,
    WordSort,
    WordSuggestDetailsRequest,
    WordSuggestDetailsResponse,
    WordSuggestRequest,
    WordSuggestResponse,
    WordUpdate,
    WordLevel,
)
from app.services import suggest as suggest_service

router = APIRouter(prefix="/languages/{course_id}/words", tags=["words"])


def _ensure_course(db: Session, course_id: int) -> None:
    if crud.course.get_course(db, course_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")


def _get_owned_word(db: Session, course_id: int, word_id: int) -> Word:
    word = crud.word.get_word(db, word_id)
    if word is None or word.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")
    return word


def _get_owned_label(db: Session, course_id: int, label_id: int):
    label = crud.label.get_label(db, label_id)
    if label is None or label.course_id != course_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return label


def _cache_accepted_create(db: Session, course, data: WordCreate) -> None:
    code_by_id = {course.native_language.id: course.native_language.code}
    for helper in course.helper_languages:
        code_by_id[helper.id] = helper.code

    meanings_by_code = {
        code_by_id[item.language_id]: item.value.strip()
        for item in data.meanings
        if item.language_id in code_by_id and item.value and item.value.strip()
    }
    if not meanings_by_code:
        return

    suggest_service.cache_accepted_word(
        term=data.term,
        part_of_speech=data.part_of_speech,
        meanings_by_code=meanings_by_code,
        details={
            "phonetic": data.phonetic,
            "phonetic_native": data.phonetic_native,
            "pronunciation_note_native": data.pronunciation_note_native,
            "level": data.level,
            "definition_target": data.definition_target,
            "example_sentence": data.example_sentence,
            "example_translation": data.example_translation,
            "synonyms": data.synonyms,
            "antonyms": data.antonyms,
            "word_family": data.word_family,
        },
        target=(course.target_language.code, course.target_language.name),
        native=(course.native_language.code, course.native_language.name),
        helpers=[(h.code, h.name) for h in course.helper_languages],
        db=db,
    )


@router.get("", response_model=list[WordRead])
def list_words(
    course_id: int,
    search: str | None = None,
    label_id: int | None = None,
    learning_status: LearningStatus | None = Query(default=None, alias="status"),
    level: WordLevel | None = None,
    part_of_speech: str | None = None,
    db: Session = Depends(get_db),
):
    _ensure_course(db, course_id)
    return crud.word.get_words(
        db,
        course_id,
        search=search,
        label_id=label_id,
        status=learning_status,
        level=level,
        part_of_speech=part_of_speech,
    )


@router.get("/page", response_model=WordPage)
def list_word_page(
    course_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25),
    sort: WordSort = "created_asc",
    search: str | None = None,
    label_id: int | None = None,
    learning_status: LearningStatus | None = Query(default=None, alias="status"),
    level: WordLevel | None = None,
    part_of_speech: str | None = None,
    db: Session = Depends(get_db),
):
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if page_size not in {5, 10, 25, 50, 100}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="page_size must be one of 5, 10, 25, 50, 100",
        )
    return crud.word.get_word_page(
        db,
        course_id,
        native_language_id=course.native_language_id,
        page=page,
        page_size=page_size,
        sort=sort,
        search=search,
        label_id=label_id,
        status=learning_status,
        level=level,
        part_of_speech=part_of_speech,
    )


@router.get("/counts", response_model=WordCounts)
def word_counts(course_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.word.get_word_counts(db, course_id)


@router.post("", response_model=WordRead, status_code=status.HTTP_201_CREATED)
def create_word(course_id: int, data: WordCreate, db: Session = Depends(get_db)):
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    word = crud.word.create_word(db, course_id, data)
    _cache_accepted_create(db, course, data)
    return word


@router.post("/import", response_model=WordImportResult)
def import_words(course_id: int, data: WordImportRequest, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.word.import_words(db, course_id, data)


@router.post("/suggest", response_model=WordSuggestResponse)
def suggest_word(course_id: int, data: WordSuggestRequest, db: Session = Depends(get_db)):
    """AI (Gemini/cache) ile kelime alanlari onerir. Anahtar ya da saglikli
    cevap yoksa 503 doner; frontend bu durumda "oneri yok" mesajini gosterir."""
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    term = data.term.strip()
    if not term:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty term")

    # Anlam kodunu language_id'ye eslemek icin: ana dil + yardimci diller.
    code_to_id = {course.native_language.code: course.native_language.id}
    for h in course.helper_languages:
        code_to_id[h.code] = h.id

    try:
        senses, model, source = suggest_service.suggest_word(
            term,
            target=(course.target_language.code, course.target_language.name),
            native=(course.native_language.code, course.native_language.name),
            helpers=[(h.code, h.name) for h in course.helper_languages],
        )
    except suggest_service.SuggestUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    result_senses = []
    for sense in senses:
        meanings_by_id = {
            code_to_id[code]: val
            for code, val in (sense.get("meanings") or {}).items()
            if code in code_to_id
        }
        result_senses.append(
            WordSense(part_of_speech=sense.get("part_of_speech"), meanings=meanings_by_id)
        )
    return WordSuggestResponse(senses=result_senses, model=model, source=source)


@router.post("/suggest/details", response_model=WordSuggestDetailsResponse)
def suggest_word_details(
    course_id: int, data: WordSuggestDetailsRequest, db: Session = Depends(get_db)
):
    course = crud.course.get_course(db, course_id)
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    
    try:
        details, model, source = suggest_service.suggest_word_details(
            term=data.term.strip(),
            part_of_speech=data.part_of_speech,
            meaning=data.meaning.strip(),
            target=(course.target_language.code, course.target_language.name),
            native=(course.native_language.code, course.native_language.name),
            helpers=[(h.code, h.name) for h in course.helper_languages],
        )
    except suggest_service.SuggestUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
        
    return WordSuggestDetailsResponse(**details, model=model, source=source)


@router.get("/due", response_model=list[WordRead])
def list_due_words(course_id: int, db: Session = Depends(get_db)):
    _ensure_course(db, course_id)
    return crud.word.get_due_words(db, course_id)


@router.get("/{word_id}", response_model=WordRead)
def get_word(course_id: int, word_id: int, db: Session = Depends(get_db)):
    return _get_owned_word(db, course_id, word_id)


@router.patch("/{word_id}", response_model=WordRead)
def update_word(course_id: int, word_id: int, data: WordUpdate, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    return crud.word.update_word(db, word, data)


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_word(course_id: int, word_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    crud.word.delete_word(db, word)


@router.patch("/{word_id}/status", response_model=WordRead)
def set_word_status(
    course_id: int, word_id: int, data: WordStatusUpdate, db: Session = Depends(get_db)
):
    word = _get_owned_word(db, course_id, word_id)
    return crud.word.set_learning_status(db, word, data.status)


@router.post("/{word_id}/review", response_model=WordRead)
def review_word(
    course_id: int, word_id: int, data: WordReviewRequest, db: Session = Depends(get_db)
):
    word = _get_owned_word(db, course_id, word_id)
    return crud.word.review_word(db, word, data.result)


@router.post("/{word_id}/labels/{label_id}", response_model=WordRead)
def add_label_to_word(course_id: int, word_id: int, label_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    label = _get_owned_label(db, course_id, label_id)
    return crud.word.add_label(db, word, label)


@router.delete("/{word_id}/labels/{label_id}", response_model=WordRead)
def remove_label_from_word(course_id: int, word_id: int, label_id: int, db: Session = Depends(get_db)):
    word = _get_owned_word(db, course_id, word_id)
    label = _get_owned_label(db, course_id, label_id)
    return crud.word.remove_label(db, word, label)
