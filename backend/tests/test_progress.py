from .conftest import log_workout, weekly_dates


def test_progress_improving(client, auth_headers):
    for index, performed_at in enumerate(weekly_dates(6)):
        log_workout(
            client,
            auth_headers,
            performed_at,
            "Bench Press",
            [(8, 70 + index * 2.5)] * 3,
        )

    response = client.get("/api/progress?exercise=Bench%20Press", headers=auth_headers)
    assert response.status_code == 200
    progress = response.json()
    assert progress["weeks_tracked"] == 6
    assert progress["best_weight"] == 82.5
    assert progress["change_pct"] > 0
    assert progress["trend"] == "improving"
    assert progress["plateau"] is False
    assert len(progress["weekly"]) == 6


def test_progress_plateau(client, auth_headers):
    for performed_at in weekly_dates(5):
        log_workout(
            client,
            auth_headers,
            performed_at,
            "Overhead Press",
            [(8, 47.5)] * 3,
        )

    response = client.get("/api/progress?exercise=Overhead%20Press", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["plateau"] is True


def test_progress_summary_and_unknown_exercise(client, auth_headers):
    log_workout(client, auth_headers, weekly_dates(3)[0], "Squat", [(5, 100)])
    summary = client.get("/api/progress/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert [item["exercise"] for item in summary.json()["exercises"]] == ["Squat"]

    missing = client.get("/api/progress?exercise=Nope", headers=auth_headers)
    assert missing.status_code == 404
