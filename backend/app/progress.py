from collections import defaultdict
from datetime import date, timedelta
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .models import Exercise, Workout, WorkoutSet


def estimated_1rm(weight: float, reps: int) -> float:
    if reps <= 1:
        return weight
    return weight * (1 + reps / 30)


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def round_to_plate(value: float) -> float:
    return round(value / 2.5) * 2.5


def find_exercise(db: Session, user_id: int, name: str) -> Exercise | None:
    return db.scalar(
        select(Exercise).where(Exercise.user_id == user_id, Exercise.name.ilike(name.strip()))
    )


def get_or_create_exercise(db: Session, user_id: int, name: str) -> Exercise:
    cleaned = " ".join(name.split())
    exercise = find_exercise(db, user_id, cleaned)
    if exercise is None:
        exercise = Exercise(user_id=user_id, name=cleaned)
        db.add(exercise)
        db.flush()
    return exercise


def _progress_for_exercise(
    db: Session, user_id: int, exercise: Exercise, weeks: int, today: date
) -> dict:
    cutoff = week_start(today) - timedelta(weeks=weeks - 1)

    rows = db.execute(
        select(Workout.performed_at, WorkoutSet.reps, WorkoutSet.weight)
        .join(WorkoutSet, WorkoutSet.workout_id == Workout.id)
        .where(
            Workout.user_id == user_id,
            WorkoutSet.exercise_id == exercise.id,
            Workout.performed_at >= cutoff,
        )
        .order_by(Workout.performed_at)
    ).all()

    all_time = db.execute(
        select(WorkoutSet.reps, WorkoutSet.weight)
        .join(Workout, WorkoutSet.workout_id == Workout.id)
        .where(Workout.user_id == user_id, WorkoutSet.exercise_id == exercise.id)
    ).all()

    best_weight_all = max((weight for _, weight in all_time), default=0.0)
    best_e1rm_all = max((estimated_1rm(weight, reps) for reps, weight in all_time), default=0.0)

    buckets: dict[date, dict[str, float]] = defaultdict(
        lambda: {"volume": 0.0, "best_e1rm": 0.0, "best_weight": 0.0, "total_sets": 0}
    )
    for performed_at, reps, weight in rows:
        bucket = buckets[week_start(performed_at)]
        bucket["volume"] += weight * reps
        bucket["best_e1rm"] = max(bucket["best_e1rm"], estimated_1rm(weight, reps))
        bucket["best_weight"] = max(bucket["best_weight"], weight)
        bucket["total_sets"] += 1

    weekly = [
        {
            "week_start": day,
            "volume": round(bucket["volume"], 1),
            "best_e1rm": round(bucket["best_e1rm"], 1),
            "best_weight": round(bucket["best_weight"], 1),
            "total_sets": int(bucket["total_sets"]),
        }
        for day, bucket in sorted(buckets.items())
    ]

    change_pct = 0.0
    if len(weekly) >= 2:
        baseline = mean(point["best_e1rm"] for point in weekly[:2])
        recent = mean(point["best_e1rm"] for point in weekly[-2:])
        if baseline > 0:
            change_pct = round((recent - baseline) / baseline * 100, 1)

    plateau = False
    if len(weekly) >= 3:
        recent = weekly[-3:]
        recent_best = max(point["best_e1rm"] for point in recent)
        prior = weekly[:-3]
        if prior:
            plateau = recent_best <= max(point["best_e1rm"] for point in prior) * 1.001
        else:
            plateau = (recent_best - min(point["best_e1rm"] for point in recent)) <= 0.5

    if change_pct > 1:
        trend = "improving"
    elif change_pct < -1:
        trend = "declining"
    else:
        trend = "flat"

    return {
        "exercise": exercise.name,
        "target_weight": exercise.target_weight,
        "weeks_tracked": len(weekly),
        "best_weight": round(best_weight_all, 1),
        "best_e1rm": round(best_e1rm_all, 1),
        "change_pct": change_pct,
        "trend": trend,
        "plateau": plateau,
        "last_week_volume": weekly[-1]["volume"] if weekly else 0.0,
        "weekly": weekly,
    }


def get_exercise_progress(
    db: Session, user_id: int, exercise_name: str, weeks: int = 8, today: date | None = None
) -> dict | None:
    exercise = find_exercise(db, user_id, exercise_name)
    if exercise is None:
        return None
    return _progress_for_exercise(db, user_id, exercise, weeks, today or date.today())


def get_progress_summary(
    db: Session, user_id: int, weeks: int = 8, today: date | None = None
) -> list[dict]:
    exercises = db.scalars(
        select(Exercise).where(Exercise.user_id == user_id).order_by(Exercise.name)
    ).all()
    results = [
        _progress_for_exercise(db, user_id, exercise, weeks, today or date.today())
        for exercise in exercises
    ]
    return [result for result in results if result["weeks_tracked"] > 0]


def get_history(
    db: Session,
    user_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    exercise_name: str | None = None,
) -> list[dict]:
    query = (
        select(Workout)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .where(Workout.user_id == user_id)
        .order_by(Workout.performed_at.desc(), Workout.id.desc())
    )
    if date_from:
        query = query.where(Workout.performed_at >= date_from)
    if date_to:
        query = query.where(Workout.performed_at <= date_to)
    if exercise_name:
        query = query.where(
            Workout.sets.any(WorkoutSet.exercise.has(Exercise.name.ilike(exercise_name.strip())))
        )

    workouts = db.scalars(query.limit(100)).unique().all()
    result = []
    for workout in workouts:
        sets = [
            {
                "exercise": workout_set.exercise.name,
                "set_index": workout_set.set_index,
                "reps": workout_set.reps,
                "weight": workout_set.weight,
            }
            for workout_set in workout.sets
        ]
        if exercise_name:
            sets = [item for item in sets if item["exercise"].lower() == exercise_name.strip().lower()]
        result.append(
            {
                "id": workout.id,
                "performed_at": workout.performed_at.isoformat(),
                "notes": workout.notes,
                "sets": sets,
            }
        )
    return result
