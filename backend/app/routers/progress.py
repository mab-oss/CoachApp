from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..progress import get_exercise_progress, get_progress_summary
from ..schemas import ExerciseProgress, ProgressSummary

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/summary", response_model=ProgressSummary)
def progress_summary(
    weeks: int = Query(default=8, ge=2, le=52),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressSummary:
    return ProgressSummary(
        exercises=get_progress_summary(db, current_user.id, weeks=weeks)
    )


@router.get("", response_model=ExerciseProgress)
def exercise_progress(
    exercise: str,
    weeks: int = Query(default=8, ge=2, le=52),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    progress = get_exercise_progress(db, current_user.id, exercise, weeks=weeks)
    if progress is None:
        raise HTTPException(status_code=404, detail="Exercise not found.")
    return progress
