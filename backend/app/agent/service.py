from sqlalchemy.orm import Session

from ..config import settings
from ..models import Suggestion, User
from .claude import run_claude
from .deterministic import run_deterministic


def run_agent(
    db: Session, user: User, message: str
) -> tuple[str, list[dict], Suggestion | None, str]:
    if settings.anthropic_api_key:
        try:
            reply, tool_calls, suggestion = run_claude(db, user, message)
            return reply, tool_calls, suggestion, "claude"
        except Exception:
            db.rollback()
            reply, tool_calls, suggestion = run_deterministic(db, user, message)
            return reply, tool_calls, suggestion, "deterministic-fallback"

    reply, tool_calls, suggestion = run_deterministic(db, user, message)
    return reply, tool_calls, suggestion, "deterministic"
