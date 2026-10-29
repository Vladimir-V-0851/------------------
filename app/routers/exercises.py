from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Exercise, User, Workout
from app.schemas import (
    ExerciseCreate,
    ExerciseHistoryItem,
    ExerciseHistoryOut,
    ExerciseOut,
)

router = APIRouter(prefix="/api", tags=["Упражнения"])


def get_owned_workout(db: Session, workout_id: int, owner_id: int) -> Workout:
    workout = db.scalar(
        select(Workout).where(
            Workout.id == workout_id,
            Workout.owner_id == owner_id,
        )
    )
    if workout is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тренировка не найдена",
        )
    return workout


@router.get("/workouts/{workout_id}/exercises", response_model=list[ExerciseOut])
def list_exercises(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Exercise]:
    get_owned_workout(db, workout_id, current_user.id)
    return list(
        db.scalars(
            select(Exercise)
            .where(Exercise.workout_id == workout_id)
            .order_by(Exercise.id.asc())
        ).all()
    )


@router.post(
    "/workouts/{workout_id}/exercises",
    response_model=ExerciseOut,
    status_code=status.HTTP_201_CREATED,
)
def create_exercise(
    workout_id: int,
    payload: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Exercise:
    get_owned_workout(db, workout_id, current_user.id)
    result = db.execute(
        insert(Exercise)
        .values(**payload.model_dump(), workout_id=workout_id)
        .returning(Exercise.id)
    )
    exercise_id = result.scalar_one()
    db.commit()
    exercise = db.get(Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Упражнение не найдено",
        )
    return exercise


@router.get("/exercises/history", response_model=ExerciseHistoryOut)
def exercise_history(
    name: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExerciseHistoryOut:
    search = f"%{name.strip()}%"
    filters = (
        Workout.owner_id == current_user.id,
        Exercise.name.ilike(search),
    )

    summary = db.execute(
        select(
            func.count(func.distinct(Workout.id)),
            func.coalesce(func.sum(Exercise.sets), 0),
            func.coalesce(
                func.sum(Exercise.weight_kg * Exercise.reps * Exercise.sets),
                0.0,
            ),
            func.coalesce(func.max(Exercise.weight_kg), 0.0),
        )
        .select_from(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .where(*filters)
    ).one()

    rows = db.execute(
        select(Exercise, Workout)
        .join(Workout, Exercise.workout_id == Workout.id)
        .where(*filters)
        .order_by(Workout.workout_date.desc(), Exercise.id.desc())
        .limit(limit)
    ).all()

    items = [
        ExerciseHistoryItem(
            exercise_id=exercise.id,
            workout_id=workout.id,
            workout_title=workout.title,
            workout_date=workout.workout_date,
            weight_kg=exercise.weight_kg,
            reps=exercise.reps,
            sets=exercise.sets,
            volume=exercise.volume,
        )
        for exercise, workout in rows
    ]

    return ExerciseHistoryOut(
        name=name.strip(),
        sessions=int(summary[0] or 0),
        total_sets=int(summary[1] or 0),
        total_volume_kg=round(float(summary[2] or 0), 2),
        best_weight_kg=round(float(summary[3] or 0), 2),
        items=items,
    )


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    owner_workouts = select(Workout.id).where(Workout.owner_id == current_user.id)
    result = db.execute(
        delete(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.workout_id.in_(owner_workouts),
        )
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Упражнение не найдено",
        )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
