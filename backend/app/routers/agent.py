from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agent.service import run_agent
from ..auth import get_current_user
from ..database import get_db
from ..models import ChatMessage, Exercise, Suggestion, User, utcnow
from ..schemas import ChatMessageRead, ChatRequest, ChatResponse, SuggestionRead

router = APIRouter(prefix="/api", tags=["agent"])


@router.post("/agent/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    reply, tool_calls, suggestion, mode = run_agent(db, current_user, payload.message)

    db.add(ChatMessage(user_id=current_user.id, role="user", content=payload.message))
    db.add(ChatMessage(user_id=current_user.id, role="assistant", content=reply))
    db.commit()

    if suggestion is not None:
        db.refresh(suggestion)

    return ChatResponse(
        reply=reply,
        tool_calls=tool_calls,
        suggestion=SuggestionRead.model_validate(suggestion) if suggestion else None,
        mode=mode,
    )


@router.get("/agent/messages", response_model=list[ChatMessageRead])
def list_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessage]:
    messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.id.desc())
        .limit(50)
    ).all()
    return list(reversed(messages))


@router.get("/suggestions", response_model=list[SuggestionRead])
def list_suggestions(
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Suggestion]:
    query = select(Suggestion).where(Suggestion.user_id == current_user.id)
    if status_filter:
        query = query.where(Suggestion.status == status_filter)
    return list(db.scalars(query.order_by(Suggestion.created_at.desc()).limit(50)).all())


def _get_pending(db: Session, user: User, suggestion_id: int) -> Suggestion:
    suggestion = db.scalar(
        select(Suggestion).where(
            Suggestion.id == suggestion_id, Suggestion.user_id == user.id
        )
    )
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found.")
    if suggestion.status != "pending":
        raise HTTPException(status_code=409, detail="This suggestion was already resolved.")
    return suggestion


@router.post("/suggestions/{suggestion_id}/accept", response_model=SuggestionRead)
def accept_suggestion(
    suggestion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Suggestion:
    suggestion = _get_pending(db, current_user, suggestion_id)
    if suggestion.exercise_id is not None:
        exercise = db.get(Exercise, suggestion.exercise_id)
        proposed = suggestion.payload.get("proposed_target_weight")
        if exercise is not None and proposed is not None:
            exercise.target_weight = float(proposed)
    suggestion.status = "accepted"
    suggestion.resolved_at = utcnow()
    db.commit()
    db.refresh(suggestion)
    return suggestion


@router.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionRead)
def reject_suggestion(
    suggestion_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Suggestion:
    suggestion = _get_pending(db, current_user, suggestion_id)
    suggestion.status = "rejected"
    suggestion.resolved_at = utcnow()
    db.commit()
    db.refresh(suggestion)
    return suggestion
