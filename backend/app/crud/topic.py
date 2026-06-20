from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.topic import Topic, TopicStatus
from app.schemas.topic import TopicCreate, TopicUpdate


def get_topics(db: Session, language_id: int) -> list[Topic]:
    return list(
        db.scalars(
            select(Topic)
            .where(Topic.language_id == language_id)
            .order_by(Topic.order_index, Topic.id)
        )
    )


def get_topic(db: Session, topic_id: int) -> Topic | None:
    return db.get(Topic, topic_id)


def create_topic(db: Session, language_id: int, data: TopicCreate) -> Topic:
    topic = Topic(language_id=language_id, **data.model_dump())
    _sync_completed_at(topic)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def update_topic(db: Session, topic: Topic, data: TopicUpdate) -> Topic:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    _sync_completed_at(topic)
    db.commit()
    db.refresh(topic)
    return topic


def delete_topic(db: Session, topic: Topic) -> None:
    db.delete(topic)
    db.commit()


def _sync_completed_at(topic: Topic) -> None:
    """status 'done' olunca tarihi otomatik koy, 'done'dan cikinca temizle."""
    if topic.status == TopicStatus.done:
        if topic.completed_at is None:
            topic.completed_at = datetime.now(timezone.utc)
    else:
        topic.completed_at = None
