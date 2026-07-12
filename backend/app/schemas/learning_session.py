from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.word import WordRead

QuestionType = Literal["intro", "choice", "typing"]
AnswerResult = Literal["completed", "correct", "minor_typo", "incorrect"]


class LearningOptionRead(BaseModel):
    word_id: int
    term: str


class LearningTaskRead(BaseModel):
    attempt_token: str
    question_type: QuestionType
    word: WordRead
    prompt: str | None = None
    options: list[LearningOptionRead] = []


class LearningProgressRead(BaseModel):
    completed_count: int
    cancelled_count: int
    total_count: int


class LearningSummaryItemRead(BaseModel):
    word: WordRead
    mistake_count: int


class LearningSessionRead(BaseModel):
    id: int
    course_id: int
    status: Literal["active", "completed", "cancelled"]
    phase: Literal["practice", "summary", "terminal"]
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    completed_word_ids: list[int] | None
    progress: LearningProgressRead
    current_task: LearningTaskRead | None = None
    summary_items: list[LearningSummaryItemRead] = []


class LearningAnswerRequest(BaseModel):
    attempt_token: str
    question_type: QuestionType
    selected_word_id: int | None = None
    submitted_answer: str | None = None

    @model_validator(mode="after")
    def validate_shape(self):
        if self.question_type == "choice":
            if self.selected_word_id is None or self.submitted_answer is not None:
                raise ValueError("choice requires selected_word_id only")
        elif self.question_type == "typing":
            if self.selected_word_id is not None or not (self.submitted_answer or "").strip():
                raise ValueError("typing requires a non-empty submitted_answer only")
        elif self.selected_word_id is not None or self.submitted_answer is not None:
            raise ValueError("intro does not accept an answer payload")
        return self


class LearningAnswerResponse(BaseModel):
    result: AnswerResult
    correct_term: str | None = None
    session: LearningSessionRead


class LearningCompleteRequest(BaseModel):
    learned_word_ids: list[int] = []


class LearningCancelResponse(BaseModel):
    session: LearningSessionRead


class LearningErrorDetail(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    code: str
    message: str
    current_session: LearningSessionRead | None = None
