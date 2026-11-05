from app.agent.tools import execute_tool
from app.models import User

from .conftest import TestingSessionLocal, log_workout, weekly_dates


def test_agent_chat_and_accept_suggestion(client, auth_headers):
    for index, performed_at in enumerate(weekly_dates(5)):
        log_workout(
            client,
            auth_headers,
            performed_at,
            "Bench Press",
            [(8, 70 + index * 2.5)] * 3,
        )

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers,
        json={"message": "How am I doing?"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mode"] == "deterministic"
    assert [call["name"] for call in body["tool_calls"]] == [
        "get_history",
        "get_progress",
        "suggest_adjustment",
    ]
    assert "Bench Press" in body["reply"]

    suggestion = body["suggestion"]
    assert suggestion is not None
    assert suggestion["status"] == "pending"
    assert suggestion["kind"] in {"increase", "maintain", "deload", "reduce_volume"}

    accepted = client.post(
        f"/api/suggestions/{suggestion['id']}/accept", headers=auth_headers
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    proposed = suggestion["payload"]["proposed_target_weight"]
    exercises = client.get("/api/exercises", headers=auth_headers).json()
    assert exercises[0]["target_weight"] == proposed

    again = client.post(
        f"/api/suggestions/{suggestion['id']}/accept", headers=auth_headers
    )
    assert again.status_code == 409


def test_agent_suggests_deload_on_plateau(client, auth_headers):
    for performed_at in weekly_dates(5):
        log_workout(
            client,
            auth_headers,
            performed_at,
            "Overhead Press",
            [(8, 47.5)] * 3,
        )

    response = client.post(
        "/api/agent/chat",
        headers=auth_headers,
        json={"message": "What should I do next for overhead press?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["suggestion"]["kind"] == "deload"
    assert "lighter" in body["suggestion"]["message"].lower()


def test_agent_reject_suggestion(client, auth_headers):
    log_workout(client, auth_headers, weekly_dates(3)[0], "Squat", [(5, 100)])
    response = client.post(
        "/api/agent/chat",
        headers=auth_headers,
        json={"message": "How is my squat?"},
    )
    suggestion = response.json()["suggestion"]
    rejected = client.post(
        f"/api/suggestions/{suggestion['id']}/reject", headers=auth_headers
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"


def test_get_history_tool_filters_by_exercise(client, auth_headers):
    log_workout(client, auth_headers, weekly_dates(2)[0], "Bench Press", [(8, 70)])
    log_workout(client, auth_headers, weekly_dates(2)[1], "Squat", [(5, 100)])

    db = TestingSessionLocal()
    try:
        user = db.query(User).first()
        result, suggestion = execute_tool(db, user, "get_history", {"exercise": "Bench Press"})
        assert suggestion is None
        assert result["workout_count"] == 1
        assert result["workouts"][0]["sets"][0]["exercise"] == "Bench Press"
    finally:
        db.close()


def test_agent_with_no_data(client, auth_headers):
    response = client.post(
        "/api/agent/chat",
        headers=auth_headers,
        json={"message": "How am I doing?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["suggestion"] is None
    assert "any workouts" in body["reply"].lower()
