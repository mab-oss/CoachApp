from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user
from ..database import get_db
from ..models import Exercise, User, Workout, WorkoutSet
from ..progress import find_exercise, get_or_create_exercise
from ..schemas import ExerciseRead, WorkoutCreate, WorkoutRead

router = APIRouter(prefix="/api", tags=["workouts"])


def serialize_workout(workout: Workout) -> WorkoutRead:
    return WorkoutRead(
        id=workout.id,
        performed_at=workout.performed_at,
        notes=workout.notes,
        sets=[
            {
                "id": workout_set.id,
                "exercise": workout_set.exercise.name,
                "set_index": workout_set.set_index,
                "reps": workout_set.reps,
                "weight": workout_set.weight,
            }
            for workout_set in workout.sets
        ],
    )


@router.get("/exercises", response_model=list[ExerciseRead])
def list_exercises(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Exercise]:
    return list(
        db.scalars(
            select(Exercise).where(Exercise.user_id == current_user.id).order_by(Exercise.name)
        ).all()
    )


@router.get("/workouts", response_model=list[WorkoutRead])
def list_workouts(
    exercise: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkoutRead]:
    query = (
        select(Workout)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .where(Workout.user_id == current_user.id)
        .order_by(Workout.performed_at.desc(), Workout.id.desc())
    )
    if date_from:
        query = query.where(Workout.performed_at >= date_from)
    if date_to:
        query = query.where(Workout.performed_at <= date_to)
    if exercise:
        exercise_row = find_exercise(db, current_user.id, exercise)
        if exercise_row is None:
            return []
        query = query.where(Workout.sets.any(WorkoutSet.exercise_id == exercise_row.id))

    workouts = db.scalars(query.limit(limit)).unique().all()
    return [serialize_workout(workout) for workout in workouts]


@router.post("/workouts", response_model=WorkoutRead, status_code=status.HTTP_201_CREATED)
def create_workout(
    payload: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutRead:
    workout = Workout(
        user_id=current_user.id,
        performed_at=payload.performed_at,
        notes=payload.notes,
    )
    db.add(workout)
    db.flush()

    set_counters: dict[int, int] = defaultdict(int)
    for item in payload.sets:
        exercise = get_or_create_exercise(db, current_user.id, item.exercise)
        set_counters[exercise.id] += 1
        db.add(
            WorkoutSet(
                workout_id=workout.id,
                exercise_id=exercise.id,
                set_index=set_counters[exercise.id],
                reps=item.reps,
                weight=item.weight,
            )
        )

    db.commit()
    stored = db.scalar(
        select(Workout)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .where(Workout.id == workout.id)
    )
    return serialize_workout(stored)


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    workout = db.scalar(
        select(Workout).where(Workout.id == workout_id, Workout.user_id == current_user.id)
    )
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found.")
    db.delete(workout)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
