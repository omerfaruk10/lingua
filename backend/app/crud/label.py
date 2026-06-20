from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.label import Label
from app.schemas.label import LabelCreate, LabelUpdate


def get_labels(db: Session, language_id: int) -> list[Label]:
    return list(
        db.scalars(
            select(Label).where(Label.language_id == language_id).order_by(Label.name)
        )
    )


def get_label(db: Session, label_id: int) -> Label | None:
    return db.get(Label, label_id)


def create_label(db: Session, language_id: int, data: LabelCreate) -> Label:
    label = Label(language_id=language_id, **data.model_dump())
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
