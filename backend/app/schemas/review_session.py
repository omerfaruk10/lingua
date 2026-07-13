from typing import Literal
from pydantic import BaseModel, model_validator
from app.schemas.word import WordRead

class ReviewOptionRead(BaseModel):
    word_id: int
    term: str

class ReviewTaskRead(BaseModel):
    attempt_token: str
    question_type: str
    word: WordRead
    prompt: str | None = None
    options: list[ReviewOptionRead] = []

class ReviewItemRead(BaseModel):
    id: int
    word: WordRead
    item_status: str
    current_step: str
    meaning_result: str
    context_result: str
    failure_action: str | None
    scheduled_date: str
    stage_at_start: int
    finalized_at: str | None

class ReviewSessionRead(BaseModel):
    id: int
    course_id: int
    status: str
    phase: str
    current_task: ReviewTaskRead | None
    items: list[ReviewItemRead]

class ReviewAnswerRequest(BaseModel):
    attempt_token: str
    question_type: str
    selected_word_id: int | None = None
    submitted_answer: str | None = None
    skip: bool = False
    @model_validator(mode="after")
    def shape(self):
        if self.question_type.endswith("choice") and self.selected_word_id is None:
            raise ValueError("choice requires selected_word_id")
        if self.question_type in {"meaning", "context", "remediation_typing"} and not self.skip and not (self.submitted_answer or "").strip():
            raise ValueError("typing requires submitted_answer")
        return self

class ReviewAnswerResponse(BaseModel):
    result: str
    correct_term: str | None
    session: ReviewSessionRead

class ReviewDecisionRequest(BaseModel):
    action: Literal["retry_tomorrow", "restart"]

class ReviewedTodayRead(BaseModel):
    word: WordRead
    result: str
    reviewed_at: str
    next_review_date: str | None

class ReviewOverviewRead(BaseModel):
    active_session: ReviewSessionRead | None
    waiting_due_words: list[WordRead]
    reviewed_today: list[ReviewedTodayRead]
