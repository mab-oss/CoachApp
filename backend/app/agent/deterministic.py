from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Exercise, Suggestion, User
from ..progress import find_exercise
from .tools import compact_result, execute_tool

ADJUSTMENT_WORDS = (
    "should",
    "adjust",
    "next",
    "increase",
    "deload",
    "lighter",
    "change",
    "recommend",
    "suggest",
    "what do i do",
)


def _mentioned_exercise(db: Session, user: User, message: str) -> Exercise | None:
    exercises = db.scalars(select(Exercise).where(Exercise.user_id == user.id)).all()
    lower = message.lower()
    matches = [exercise for exercise in exercises if exercise.name.lower() in lower]
    if matches:
        return max(matches, key=lambda exercise: len(exercise.name))
    if len(exercises) == 1:
        return exercises[0]
    aliases = {
        "bench": "bench",
        "squat": "squat",
        "deadlift": "deadlift",
        "overhead": "press",
        "ohp": "press",
        "row": "row",
    }
    for token, alias in aliases.items():
        if token in lower:
            for exercise in exercises:
                if alias in exercise.name.lower():
                    return exercise
    return None


def _summary_line(progress: dict) -> str:
    line = f"{progress['exercise']}: best estimated 1RM {progress['best_e1rm']:g} kg"
    if progress["change_pct"]:
        direction = "up" if progress["change_pct"] > 0 else "down"
        line += f", {direction} {abs(progress['change_pct']):g}% over {progress['weeks_tracked']} weeks"
    else:
        line += f" across {progress['weeks_tracked']} weeks"
    if progress["plateau"]:
        line += " (no improvement for 3 weeks)"
    return line


def _choose_suggestion(progress: dict) -> tuple[str, str, str]:
    name = progress["exercise"]
    if progress["plateau"]:
        return (
            "deload",
            f"Take a lighter week for {name}: reduce working weights by about 10%.",
            f"{name} has not improved for 3 weeks, so a short deload should help recovery.",
        )
    if progress["change_pct"] >= 2:
        return (
            "increase",
            f"Add 2.5 kg to {name} next session.",
            f"{name} is improving steadily ({progress['change_pct']:g}% over the window).",
        )
    if progress["change_pct"] <= -2:
        return (
            "reduce_volume",
            f"Reduce {name} volume by about 20% next session and keep the weight moderate.",
            f"{name} is trending down ({progress['change_pct']:g}%), which suggests accumulated fatigue.",
        )
    return (
        "maintain",
        f"Keep the same weight on {name} and add one rep per set.",
        f"{name} is stable, so a small rep progression is a safer next step than more weight.",
    )


def run_deterministic(db: Session, user: User, message: str) -> tuple[str, list[dict], Suggestion | None]:
    tool_calls: list[dict] = []
    lower = message.lower()
    wants_adjustment = any(word in lower for word in ADJUSTMENT_WORDS)
    mentioned = _mentioned_exercise(db, user, message)

    history_args = {"weeks": 8}
    history_result, _ = execute_tool(db, user, "get_history", history_args)
    tool_calls.append(
        {
            "name": "get_history",
            "arguments": history_args,
            "result": compact_result("get_history", history_result),
        }
    )

    progress_args = {"weeks": 8}
    if mentioned is not None:
        progress_args["exercise"] = mentioned.name
    progress_result, _ = execute_tool(db, user, "get_progress", progress_args)
    tool_calls.append(
        {
            "name": "get_progress",
            "arguments": progress_args,
            "result": compact_result("get_progress", progress_result),
        }
    )

    exercises = progress_result.get("exercises", [])
    if not exercises:
        return (
            "I don't have any workouts logged yet. Add a few sessions and ask me again - "
            "then I can show your progress and suggest a next step.",
            tool_calls,
            None,
        )

    lines = [_summary_line(progress) for progress in exercises[:5]]
    if len(exercises) > 5:
        lines.append(f"...and {len(exercises) - 5} more exercises.")
    reply = "Here's how you're doing:\n" + "\n".join(lines)

    target = exercises[0]
    if mentioned is not None:
        target = next(
            (progress for progress in exercises if progress["exercise"] == mentioned.name),
            target,
        )
    elif not wants_adjustment:
        target = next((progress for progress in exercises if progress["plateau"]), target)
    elif any(progress["plateau"] for progress in exercises):
        target = next(progress for progress in exercises if progress["plateau"])

    action, change, reason = _choose_suggestion(target)
    suggestion_args = {
        "exercise": target["exercise"],
        "action": action,
        "change": change,
        "reason": reason,
    }
    suggestion_result, suggestion = execute_tool(db, user, "suggest_adjustment", suggestion_args)
    tool_calls.append(
        {
            "name": "suggest_adjustment",
            "arguments": suggestion_args,
            "result": compact_result("suggest_adjustment", suggestion_result),
        }
    )

    if suggestion is not None:
        reply += f"\n\nMy suggestion: {change} Do you want me to apply it?"

    return reply, tool_calls, suggestion
