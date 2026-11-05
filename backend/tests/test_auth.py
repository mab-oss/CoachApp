from datetime import date, timedelta

from sqlalchemy import select

from app.demo import DEMO_DOMAIN, DEMO_PREFIX
from app.models import User, Workout, utcnow


def test_register_login_and_me(client):
    register = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password123"},
    )
    assert register.status_code == 201
    body = register.json()
    assert body["user"]["email"] == "new@example.com"
    assert body["access_token"]

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"

    login = client.post(
        "/api/auth/login",
        json={"email": "new@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_duplicate_email_rejected(client):
    payload = {"email": "dupe@example.com", "password": "password123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert client.post("/api/auth/register", json=payload).status_code == 400


def test_wrong_password_rejected(client):
    client.post(
        "/api/auth/register",
        json={"email": "wrong@example.com", "password": "password123"},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "wrong@example.com", "password": "not-the-password"},
    )
    assert response.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_demo_login_creates_isolated_user_with_data(client):
    first = client.post("/api/auth/demo")
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["user"]["email"].startswith(DEMO_PREFIX)
    assert first_body["user"]["email"].endswith(f"@{DEMO_DOMAIN}")

    headers = {"Authorization": f"Bearer {first_body['access_token']}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    progress = client.get("/api/progress/summary", headers=headers)
    assert progress.status_code == 200, progress.text
    names = {item["exercise"] for item in progress.json()["exercises"]}
    assert {"Bench Press", "Overhead Press", "Back Squat", "Deadlift"} <= names

    second = client.post("/api/auth/demo")
    assert second.status_code == 200, second.text
    second_body = second.json()
    assert second_body["user"]["id"] != first_body["user"]["id"]
    assert second_body["user"]["email"] != first_body["user"]["email"]


def test_demo_cleanup_removes_expired_users(client, db_session):
    expired_email = f"{DEMO_PREFIX}expired@{DEMO_DOMAIN}"
    old = User(
        email=expired_email,
        password_hash="unused",
        created_at=utcnow() - timedelta(days=8),
    )
    db_session.add(old)
    db_session.commit()
    workout = Workout(
        user_id=old.id,
        performed_at=date.today(),
        notes="expired demo workout",
    )
    db_session.add(workout)
    db_session.commit()

    response = client.post("/api/auth/demo")
    assert response.status_code == 200, response.text

    db_session.expunge_all()
    assert db_session.scalar(select(User).where(User.email == expired_email)) is None
    assert (
        db_session.scalar(select(Workout).where(Workout.notes == "expired demo workout"))
        is None
    )


def test_register_rejects_reserved_demo_email(client):
    response = client.post(
        "/api/auth/register",
        json={"email": f"{DEMO_PREFIX}new@{DEMO_DOMAIN}", "password": "password123"},
    )
    assert response.status_code == 400
