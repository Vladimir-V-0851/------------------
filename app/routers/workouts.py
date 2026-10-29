from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Exercise, User, Workout
from app.schemas import (
    CategoryStats,
    WorkoutCreate,
    WorkoutListOut,
    WorkoutOut,
    WorkoutStatsOut,
    WorkoutUpdate,
)

router = APIRouter(prefix="/api/workouts", tags=["Тренировки"])


def get_owned_workout(db: Session, workout_id: int, owner_id: int) -> Workout:
    workout = db.scalar(
        select(Workout)
        .options(selectinload(Workout.exercises))
        .where(Workout.id == workout_id, Workout.owner_id == owner_id)
    )
    if workout is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тренировка не найдена",
        )
    return workout


@router.get("", response_model=WorkoutListOut)
def list_workouts(
    q: str | None = Query(default=None, max_length=150),
    category: str | None = Query(default=None, max_length=50),
    completed: bool | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    sort_by: Literal["date", "title", "duration", "created"] = Query(default="date"),
    order: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutListOut:
    filters = [Workout.owner_id == current_user.id]

    if q and q.strip():
        search = f"%{q.strip()}%"
        filters.append(or_(Workout.title.ilike(search), Workout.notes.ilike(search)))
    if category and category.strip():
        filters.append(Workout.category.ilike(f"%{category.strip()}%"))
    if completed is not None:
        filters.append(Workout.completed.is_(completed))
    if date_from is not None:
        filters.append(Workout.workout_date >= date_from)
    if date_to is not None:
        filters.append(Workout.workout_date <= date_to)

    sort_columns = {
        "date": Workout.workout_date,
        "title": Workout.title,
        "duration": Workout.duration_minutes,
        "created": Workout.created_at,
    }
    sort_column = sort_columns[sort_by]
    order_clause = sort_column.asc() if order == "asc" else sort_column.desc()

    total = db.scalar(select(func.count()).select_from(Workout).where(*filters)) or 0
    workouts = db.scalars(
        select(Workout)
        .options(selectinload(Workout.exercises))
        .where(*filters)
        .order_by(order_clause, Workout.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return WorkoutListOut(
        items=workouts,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=WorkoutStatsOut)
def workout_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutStatsOut:
    owner_filter = Workout.owner_id == current_user.id
    total_workouts = db.scalar(
        select(func.count()).select_from(Workout).where(owner_filter)
    ) or 0
    completed_workouts = db.scalar(
        select(func.count())
        .select_from(Workout)
        .where(owner_filter, Workout.completed.is_(True))
    ) or 0
    total_duration = db.scalar(
        select(func.coalesce(func.sum(Workout.duration_minutes), 0)).where(owner_filter)
    ) or 0
    average_duration = db.scalar(select(func.avg(Workout.duration_minutes)).where(owner_filter))
    total_volume = db.scalar(
        select(
            func.coalesce(
                func.sum(Exercise.weight_kg * Exercise.reps * Exercise.sets),
                0.0,
            )
        )
        .select_from(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .where(owner_filter)
    ) or 0.0

    category_rows = db.execute(
        select(
            Workout.category,
            func.count(Workout.id),
            func.coalesce(func.sum(Workout.duration_minutes), 0),
        )
        .where(owner_filter)
        .group_by(Workout.category)
        .order_by(func.count(Workout.id).desc(), Workout.category.asc())
    ).all()

    volume_rows = db.execute(
        select(
            Workout.category,
            func.coalesce(
                func.sum(Exercise.weight_kg * Exercise.reps * Exercise.sets),
                0.0,
            ),
        )
        .select_from(Exercise)
        .join(Workout, Exercise.workout_id == Workout.id)
        .where(owner_filter)
        .group_by(Workout.category)
    ).all()
    volume_by_category = {row[0]: float(row[1] or 0) for row in volume_rows}

    categories = [
        CategoryStats(
            category=row[0],
            workout_count=int(row[1]),
            total_duration_minutes=int(row[2] or 0),
            total_volume_kg=round(volume_by_category.get(row[0], 0.0), 2),
        )
        for row in category_rows
    ]

    return WorkoutStatsOut(
        total_workouts=int(total_workouts),
        completed_workouts=int(completed_workouts),
        total_duration_minutes=int(total_duration),
        average_duration_minutes=round(float(average_duration or 0), 1),
        total_volume_kg=round(float(total_volume), 2),
        categories=categories,
    )


@router.post("", response_model=WorkoutOut, status_code=status.HTTP_201_CREATED)
def create_workout(
    payload: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workout:
    result = db.execute(
        insert(Workout)
        .values(**payload.model_dump(), owner_id=current_user.id)
        .returning(Workout.id)
    )
    workout_id = result.scalar_one()
    db.commit()
    return get_owned_workout(db, workout_id, current_user.id)


@router.get("/{workout_id}", response_model=WorkoutOut)
def get_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workout:
    return get_owned_workout(db, workout_id, current_user.id)


@router.patch("/{workout_id}", response_model=WorkoutOut)
def update_workout(
    workout_id: int,
    payload: WorkoutUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workout:
    workout = get_owned_workout(db, workout_id, current_user.id)
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if field != "notes" and value is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Поле {field} не может быть пустым",
            )

    if updates:
        db.execute(
            update(Workout)
            .where(
                Workout.id == workout_id,
                Workout.owner_id == current_user.id,
            )
            .values(**updates)
        )
        db.commit()

    return get_owned_workout(db, workout.id, current_user.id)


@router.delete("/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    result = db.execute(
        delete(Workout).where(
            Workout.id == workout_id,
            Workout.owner_id == current_user.id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тренировка не найдена",
        )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
