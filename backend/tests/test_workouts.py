from datetime import date

from .conftest import log_workout


def test_create_and_list_workout(client, auth_headers):
    created = log_workout(
        client,
        auth_headers,
        date.today(),
        "Bench Press",
        [(8, 80), (8, 80), (6, 85)],
    )
    assert len(created["sets"]) == 3
    assert [item["set_index"] for item in created["sets"]] == [1, 2, 3]
    assert all(item["exercise"] == "Bench Press" for item in created["sets"])

    listed = client.get("/api/workouts", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    exercises = client.get("/api/exercises", headers=auth_headers)
    assert exercises.status_code == 200
    assert [item["name"] for item in exercises.json()] == ["Bench Press"]


def test_filter_workouts_by_exercise(client, auth_headers):
    log_workout(client, auth_headers, date.today(), "Squat", [(5, 100)])
    log_workout(client, auth_headers, date.today(), "Bench Press", [(8, 70)])

    filtered = client.get("/api/workouts?exercise=Squat", headers=auth_headers)
    assert filtered.status_code == 200
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["sets"][0]["exercise"] == "Squat"


def test_delete_workout(client, auth_headers):
    created = log_workout(client, auth_headers, date.today(), "Deadlift", [(5, 120)])
    response = client.delete(f"/api/workouts/{created['id']}", headers=auth_headers)
    assert response.status_code == 204
    assert client.get("/api/workouts", headers=auth_headers).json() == []


def test_workouts_require_auth(client):
    assert client.get("/api/workouts").status_code == 401
    assert client.post("/api/workouts", json={}).status_code == 401
