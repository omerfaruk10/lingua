from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.database import get_db
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicRead, TopicUpdate

router = APIRouter(prefix="/languages/{language_id}/topics", tags=["topics"])


def _ensure_language(db: Session, language_id: int) -> None:
    if crud.language.get_language(db, language_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")


def _get_owned_topic(db: Session, language_id: int, topic_id: int) -> Topic:
    """Konuyu getirir ve gercekten bu dile ait oldugunu dogrular (izolasyon)."""
    topic = crud.topic.get_topic(db, topic_id)
    if topic is None or topic.language_id != language_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic


@router.get("", response_model=list[TopicRead])
def list_topics(language_id: int, db: Session = Depends(get_db)):
    _ensure_language(db, language_id)
    return crud.topic.get_topics(db, language_id)


@router.post("", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
def create_topic(language_id: int, data: TopicCreate, db: Session = Depends(get_db)):
    _ensure_language(db, language_id)
    return crud.topic.create_topic(db, language_id, data)


@router.get("/{topic_id}", response_model=TopicRead)
def get_topic(language_id: int, topic_id: int, db: Session = Depends(get_db)):
    return _get_owned_topic(db, language_id, topic_id)


@router.patch("/{topic_id}", response_model=TopicRead)
def update_topic(language_id: int, topic_id: int, data: TopicUpdate, db: Session = Depends(get_db)):
    topic = _get_owned_topic(db, language_id, topic_id)
    return crud.topic.update_topic(db, topic, data)


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(language_id: int, topic_id: int, db: Session = Depends(get_db)):
    topic = _get_owned_topic(db, language_id, topic_id)
    crud.topic.delete_topic(db, topic)
