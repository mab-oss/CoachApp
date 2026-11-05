import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..models import Suggestion, User
from ..progress import (
    find_exercise,
    get_exercise_progress,
    get_history,
    get_progress_summary,
    round_to_plate,
)

TOOL_SCHEMAS = [
    {
        "name": "get_history",
        "description": "Read the user's past workouts, optionally filtered by date range or exercise.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "ISO date (YYYY-MM-DD), optional."},
                "date_to": {"type": "string", "description": "ISO date (YYYY-MM-DD), optional."},
                "exercise": {"type": "string", "description": "Exercise name, optional."},
            },
            "required": [],
        },
    },
    {
        "name": "get_progress",
        "description": (
            "Calculate training trends: weekly volume, personal records, percent change, "
            "and whether an exercise has plateaued."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "exercise": {"type": "string", "description": "Exercise name; omit for all exercises."},
                "weeks": {"type": "integer", "description": "Lookback window in weeks (default 8)."},
            },
            "required": [],
        },
    },
    {
        "name": "suggest_adjustment",
        "description": (
            "Create a proposed training change. This only creates a pending suggestion that the "
            "user must accept or reject; it never modifies the training plan directly."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "exercise": {"type": "string", "description": "Exercise the change applies to."},
                "action": {
                    "type": "string",
                    "enum": ["increase", "deload", "maintain", "reduce_volume"],
                    "description": "Kind of adjustment.",
                },
                "change": {"type": "string", "description": "One-sentence proposal shown to the user."},
                "reason": {"type": "string", "description": "Why the change is recommended."},
                "proposed_target_weight": {
                    "type": "number",
                    "description": "Target working weight in kg, optional.",
                },
            },
            "required": ["exercise", "action", "change", "reason"],
        },
    },
]


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def _proposed_weight(action: str, base: float) -> float:
    if base <= 0:
        return 0.0
    if action == "increase":
        return round_to_plate(base + 2.5)
    if action == "deload":
        return round_to_plate(base * 0.9)
    return round_to_plate(base)


def execute_tool(
    db: Session, user: User, name: str, arguments: dict
) -> tuple[dict, Suggestion | None]:
    if name == "get_history":
        today = date.today()
        workouts = get_history(
            db,
            user.id,
            date_from=_parse_date(arguments.get("date_from")) or today - timedelta(weeks=8),
            date_to=_parse_date(arguments.get("date_to")) or today,
            exercise_name=arguments.get("exercise"),
        )
        return {"workout_count": len(workouts), "workouts": workouts}, None

    if name == "get_progress":
        weeks = int(arguments.get("weeks") or 8)
        weeks = max(2, min(52, weeks))
        exercise = arguments.get("exercise")
        if exercise:
            progress = get_exercise_progress(db, user.id, exercise, weeks=weeks)
            exercises = [progress] if progress else []
        else:
            exercises = get_progress_summary(db, user.id, weeks=weeks)
        return {"weeks": weeks, "exercises": exercises}, None

    if name == "suggest_adjustment":
        exercise = find_exercise(db, user.id, str(arguments.get("exercise", "")))
        if exercise is None:
            return {"error": "Exercise not found."}, None

        action = str(arguments.get("action", "maintain"))
        progress = get_exercise_progress(db, user.id, exercise.name, weeks=8)
        base = exercise.target_weight or (progress or {}).get("best_weight") or 0.0
        proposed = arguments.get("proposed_target_weight")
        proposed = float(proposed) if proposed is not None else _proposed_weight(action, base)

        suggestion = Suggestion(
            user_id=user.id,
            exercise_id=exercise.id,
            kind=action,
            message=str(arguments.get("change", "Adjust training."))[:500],
            payload={
                "exercise": exercise.name,
                "action": action,
                "reason": str(arguments.get("reason", ""))[:500],
                "proposed_target_weight": round(proposed, 1),
            },
        )
        db.add(suggestion)
        db.flush()
        return {
            "suggestion_id": suggestion.id,
            "exercise": exercise.name,
            "action": action,
            "message": suggestion.message,
            "proposed_target_weight": suggestion.payload["proposed_target_weight"],
            "status": "pending",
            "requires_user_approval": True,
        }, suggestion

    return {"error": f"Unknown tool: {name}"}, None


def compact_result(name: str, result: dict) -> dict:
    if name == "get_history":
        return {"workout_count": result.get("workout_count", 0)}
    if name == "get_progress":
        return {
            "weeks": result.get("weeks"),
            "exercises": [
                {
                    "exercise": item["exercise"],
                    "best_e1rm": item["best_e1rm"],
                    "change_pct": item["change_pct"],
                    "trend": item["trend"],
                    "plateau": item["plateau"],
                }
                for item in result.get("exercises", [])
            ],
        }
    return result


def result_json(result: dict) -> str:
    return json.dumps(result, default=str)
