from sqlalchemy.orm import Session

from ..config import settings
from ..models import Suggestion, User
from .tools import TOOL_SCHEMAS, compact_result, execute_tool, result_json

SYSTEM_PROMPT = """You are CoachApp, a strength-training coach built into a workout tracker.

Rules:
- Inspect the user's real data with the tools before answering.
- Always call get_history and get_progress before drawing conclusions.
- When you recommend a change, call suggest_adjustment to create a pending proposal.
- Suggestions are proposals only: the user must accept or reject them. Never claim a change was applied.
- Be concise: 2-4 short sentences. Use the user's actual numbers.
- If there is not enough data, say so and ask the user to log a few workouts.
"""

MAX_TOOL_ROUNDS = 6


def run_claude(
    db: Session, user: User, message: str
) -> tuple[str, list[dict], Suggestion | None]:
    from anthropic import Anthropic

    client = Anthropic(api_key=settings.anthropic_api_key)
    messages: list[dict] = [{"role": "user", "content": message}]
    tool_calls: list[dict] = []
    suggestion: Suggestion | None = None

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=TOOL_SCHEMAS,
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            text = "".join(block.text for block in response.content if block.type == "text").strip()
            return text or "I could not produce a summary from your data.", tool_calls, suggestion

        messages.append(
            {
                "role": "assistant",
                "content": [block.model_dump(exclude_none=True) for block in response.content],
            }
        )

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            result, created = execute_tool(db, user, block.name, dict(block.input))
            if created is not None:
                suggestion = created
            tool_calls.append(
                {
                    "name": block.name,
                    "arguments": dict(block.input),
                    "result": compact_result(block.name, result),
                }
            )
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result_json(result),
                }
            )
        messages.append({"role": "user", "content": tool_results})

    return "I gathered your data but could not finish the analysis. Please try again.", tool_calls, suggestion
