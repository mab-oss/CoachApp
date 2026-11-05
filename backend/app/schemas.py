from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class SetCreate(BaseModel):
    exercise: str = Field(min_length=1, max_length=120)
    reps: int = Field(gt=0, le=100)
    weight: float = Field(ge=0, le=1000)


class WorkoutCreate(BaseModel):
    performed_at: date
    notes: str | None = Field(default=None, max_length=500)
    sets: list[SetCreate] = Field(min_length=1)


class SetRead(BaseModel):
    id: int
    exercise: str
    set_index: int
    reps: int
    weight: float


class WorkoutRead(BaseModel):
    id: int
    performed_at: date
    notes: str | None
    sets: list[SetRead]


class ExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_weight: float | None


class WeeklyPoint(BaseModel):
    week_start: date
    volume: float
    best_e1rm: float
    best_weight: float
    total_sets: int


class ExerciseProgress(BaseModel):
    exercise: str
    target_weight: float | None
    weeks_tracked: int
    best_weight: float
    best_e1rm: float
    change_pct: float
    trend: str
    plateau: bool
    last_week_volume: float
    weekly: list[WeeklyPoint]


class ProgressSummary(BaseModel):
    exercises: list[ExerciseProgress]


class ToolCallRead(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: dict[str, Any]


class SuggestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int | None
    kind: str
    message: str
    payload: dict[str, Any]
    status: str
    created_at: datetime
    resolved_at: datetime | None


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: datetime


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCallRead]
    suggestion: SuggestionRead | None = None
    mode: str
