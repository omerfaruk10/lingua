from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.language import CourseError, resolve_ref
from app.models.course import Course
from app.models.language import Language
from app.schemas.language import CourseCreate, CourseUpdate, LangRef

MAX_HELPERS = 3


def get_courses(db: Session) -> list[Course]:
    return list(db.scalars(select(Course).order_by(Course.order_index, Course.id)))


def get_course(db: Session, course_id: int) -> Course | None:
    return db.get(Course, course_id)


def _resolve_helpers(db: Session, refs: list[LangRef], exclude_ids: set[int]) -> list[Language]:
    helpers: list[Language] = []
    seen: set[int] = set()
    for ref in refs[:MAX_HELPERS]:
        lang = resolve_ref(db, ref)
        if lang.id in exclude_ids or lang.id in seen:
            continue
        seen.add(lang.id)
        helpers.append(lang)
    return helpers


def _next_course_order(db: Session) -> int:
    current = db.scalar(select(func.coalesce(func.max(Course.order_index), -1)))
    return (current if current is not None else -1) + 1


def _find_duplicate(
    db: Session, target_id: int, native_id: int, helper_ids: set[int], exclude_id: int | None = None
) -> Course | None:
    """Hedef+ana dili ayni olan kurslar arasinda yardimci dil seti de birebir
    ayni olani arar. Farkli ana ya da farkli yardimci dil seti duplicate sayilmaz."""
    candidates = db.scalars(
        select(Course).where(
            Course.target_language_id == target_id, Course.native_language_id == native_id
        )
    )
    for c in candidates:
        if exclude_id is not None and c.id == exclude_id:
            continue
        if {h.id for h in c.helper_languages} == helper_ids:
            return c
    return None


def create_course(db: Session, data: CourseCreate) -> Course:
    """Yeni kurs olusturur. Ayni hedef dil icin farkli ana/yardimci dillerle
    birden fazla kurs olabilir, ama hedef+ana+yardimci seti birebir ayni olan
    ikinci bir kurs reddedilir (anlamsiz tam tekrar)."""
    target = resolve_ref(db, data.target)
    native = resolve_ref(db, data.native)
    if target.id == native.id:
        raise CourseError("Target and native language cannot be the same")

    helpers = _resolve_helpers(db, data.helpers, exclude_ids={target.id, native.id})

    if _find_duplicate(db, target.id, native.id, {h.id for h in helpers}) is not None:
        raise CourseError(
            "A course with this exact target/native/helper combination already exists"
        )

    course = Course(
        target_language_id=target.id,
        native_language_id=native.id,
        order_index=_next_course_order(db),
    )
    db.add(course)
    db.flush()  # id lazim (helper_languages secondary insert icin)
    course.helper_languages = helpers
    db.commit()
    db.refresh(course)
    return course


def update_course(db: Session, course: Course, data: CourseUpdate) -> Course:
    prospective_native_id = course.native_language_id
    if data.native is not None:
        native = resolve_ref(db, data.native)
        if native.id == course.target_language_id:
            raise CourseError("Target and native language cannot be the same")
        prospective_native_id = native.id

    prospective_helpers = course.helper_languages
    if data.helpers is not None:
        exclude = {course.target_language_id, prospective_native_id}
        prospective_helpers = _resolve_helpers(db, data.helpers, exclude_ids=exclude)

    if data.native is not None or data.helpers is not None:
        dup = _find_duplicate(
            db,
            course.target_language_id,
            prospective_native_id,
            {h.id for h in prospective_helpers},
            exclude_id=course.id,
        )
        if dup is not None:
            raise CourseError(
                "A course with this exact target/native/helper combination already exists"
            )

    if data.order_index is not None:
        course.order_index = data.order_index
    if data.native is not None:
        course.native_language_id = prospective_native_id
    if data.helpers is not None:
        course.helper_languages = prospective_helpers
    db.commit()
    db.refresh(course)
    return course


def delete_course(db: Session, course: Course) -> None:
    db.delete(course)
    db.commit()
