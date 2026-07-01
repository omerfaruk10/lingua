from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.topic import TopicStatus


class TopicBase(BaseModel):
    title: str
    description: str | None = None
    order_index: int = 0
    status: TopicStatus = TopicStatus.not_started


class TopicCreate(TopicBase):
    pass


class TopicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    order_index: int | None = None
    status: TopicStatus | None = None


class TopicRead(TopicBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    completed_at: datetime | None
    created_at: datetime
