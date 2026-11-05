"""Demo account helpers shared by the seed CLI and the demo login endpoint."""

import secrets
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Exercise, User, Workout, WorkoutSet, utcnow
from .progress import week_start

DEMO_EMAIL = "demo@coachapp.dev"
DEMO_PASSWORD = "demo1234"
DEMO_PREFIX = "demo-"
DEMO_DOMAIN = "coachapp.dev"
DEMO_EMAIL_PATTERN = f"{DEMO_PREFIX}%@{DEMO_DOMAIN}"

NOTES = [
    "Felt strong today.",
    "Good session, steady tempo.",
    "Slightly tired but form was clean.",
    "Focused on controlled reps.",
    None,
]


def is_reserved_demo_email(email: str) -> bool:
    normalized = email.strip().lower()
    return normalized.startswith(DEMO_PREFIX) and normalized.endswith(f"@{DEMO_DOMAIN}")


def add_workout(db: Session, user_id: int, performed_at, exercises, notes=None) -> None:
    workout = Workout(user_id=user_id, performed_at=performed_at, notes=notes)
    db.add(workout)
    db.flush()
    for exercise_name, sets in exercises.items():
        exercise = db.scalar(
            select(Exercise).where(
                Exercise.user_id == user_id, Exercise.name == exercise_name
            )
        )
        if exercise is None:
            exercise = Exercise(user_id=user_id, name=exercise_name)
            db.add(exercise)
            db.flush()
        for index, (reps, weight) in enumerate(sets, start=1):
            db.add(
                WorkoutSet(
                    workout_id=workout.id,
                    exercise_id=exercise.id,
                    set_index=index,
                    reps=reps,
                    weight=weight,
                )
            )


def seed_user(db: Session, user: User, today: date | None = None) -> None:
    """Populate one user with eight weeks of realistic training data."""
    today = today or date.today()
    current_monday = week_start(today)
    notes_index = 0

    for week in range(8):
        monday = current_monday - timedelta(weeks=7 - week)
        bench = 70 + 2.5 * (week // 2)
        squat = 90 + 5 * (week // 2)
        deadlift = 110 + 5 * (week // 2)
        overhead = 45 if week < 3 else 47.5

        sessions = [
            (
                monday,
                {
                    "Bench Press": [(8, bench), (8, bench), (8, bench)],
                    "Overhead Press": [(8, overhead), (8, overhead), (8, overhead)],
                },
            ),
            (
                monday + timedelta(days=2),
                {"Back Squat": [(5, squat), (5, squat), (5, squat)]},
            ),
            (
                monday + timedelta(days=4),
                {
                    "Deadlift": [(5, deadlift), (5, deadlift), (5, deadlift)],
                    "Overhead Press": [(8, overhead), (8, overhead), (8, overhead)],
                },
            ),
        ]
        for performed_at, exercises in sessions:
            if performed_at > today:
                continue
            add_workout(
                db,
                user.id,
                performed_at,
                exercises,
                notes=NOTES[notes_index % len(NOTES)],
            )
            notes_index += 1


def seed_demo(db: Session, force: bool = False) -> User:
    """Create or reset the fixed demo account used by seed.py."""
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is not None:
        if not force:
            return user
        db.delete(user)
        db.commit()

    user = User(
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        created_at=utcnow(),
    )
    db.add(user)
    db.flush()
    seed_user(db, user)
    db.commit()
    db.refresh(user)
    return user


def create_isolated_demo_user(db: Session) -> User:
    """Create a fresh demo user with its own seeded training history."""
    for _ in range(5):
        user = User(
            email=f"{DEMO_PREFIX}{secrets.token_hex(8)}@{DEMO_DOMAIN}",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            created_at=utcnow(),
        )
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            continue

        try:
            seed_user(db, user)
            db.commit()
        except Exception:
            db.rollback()
            raise
        db.refresh(user)
        return user

    raise RuntimeError("Could not create a demo user after several attempts.")


def cleanup_expired_demo_users(db: Session, ttl_minutes: int) -> int:
    """Delete isolated demo users whose sessions have expired."""
    cutoff = utcnow() - timedelta(minutes=ttl_minutes)
    users = db.scalars(
        select(User).where(
            User.email.like(DEMO_EMAIL_PATTERN),
            User.created_at < cutoff,
        )
    ).all()
    for user in users:
        db.delete(user)
    if users:
        db.commit()
    return len(users)
