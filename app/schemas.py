from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Логин должен содержать минимум 3 символа")
        if any(character.isspace() for character in value):
            raise ValueError("Логин не должен содержать пробелы")
        return value


class UserLogin(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: datetime


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    weight_kg: float = Field(default=0, ge=0, le=2000)
    reps: int = Field(ge=1, le=10000)
    sets: int = Field(default=1, ge=1, le=1000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Название упражнения не может быть пустым")
        return value


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    weight_kg: float
    reps: int
    sets: int
    volume: float
    workout_id: int
    created_at: datetime


class WorkoutBase(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    workout_date: date
    category: str = Field(min_length=1, max_length=50)
    duration_minutes: int = Field(ge=1, le=1440)
    completed: bool = False
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "category")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Поле не может быть пустым")
        return value

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class WorkoutCreate(WorkoutBase):
    pass


class WorkoutUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    workout_date: date | None = None
    category: str | None = Field(default=None, min_length=1, max_length=50)
    duration_minutes: int | None = Field(default=None, ge=1, le=1440)
    completed: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "category")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Поле не может быть пустым")
        return value

    @field_validator("notes")
    @classmethod
    def normalize_optional_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class WorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    workout_date: date
    category: str
    duration_minutes: int
    completed: bool
    notes: str | None
    owner_id: int
    created_at: datetime
    exercises: list[ExerciseOut]
    total_volume: float
    exercise_count: int


class WorkoutListOut(BaseModel):
    items: list[WorkoutOut]
    total: int
    limit: int
    offset: int


class CategoryStats(BaseModel):
    category: str
    workout_count: int
    total_duration_minutes: int
    total_volume_kg: float


class WorkoutStatsOut(BaseModel):
    total_workouts: int
    completed_workouts: int
    total_duration_minutes: int
    average_duration_minutes: float
    total_volume_kg: float
    categories: list[CategoryStats]


class ExerciseHistoryItem(BaseModel):
    exercise_id: int
    workout_id: int
    workout_title: str
    workout_date: date
    weight_kg: float
    reps: int
    sets: int
    volume: float


class ExerciseHistoryOut(BaseModel):
    name: str
    sessions: int
    total_sets: int
    total_volume_kg: float
    best_weight_kg: float
    items: list[ExerciseHistoryItem]
