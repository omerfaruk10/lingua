from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.label import Label
from app.schemas.label import LabelCreate, LabelUpdate


def get_labels(db: Session, course_id: int) -> list[Label]:
    return list(
        db.scalars(
            select(Label)
            .where(Label.course_id == course_id)
            .order_by(Label.order_index, Label.id)
        )
    )


def get_label(db: Session, label_id: int) -> Label | None:
    return db.get(Label, label_id)


def create_label(db: Session, course_id: int, data: LabelCreate) -> Label:
    # Yeni etiket listenin sonuna eklensin
    count = (
        db.scalar(
            select(func.count())
            .select_from(Label)
            .where(Label.course_id == course_id)
        )
        or 0
    )
    label = Label(course_id=course_id, order_index=count, **data.model_dump())
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


def update_label(db: Session, label: Label, data: LabelUpdate) -> Label:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(label, field, value)
    db.commit()
    db.refresh(label)
    return label


def delete_label(db: Session, label: Label) -> None:
    db.delete(label)
    db.commit()
