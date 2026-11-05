import os
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.pop("ANTHROPIC_API_KEY", None)

from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

settings.anthropic_api_key = None

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session(client):
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def auth_headers(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "lifter@example.com", "password": "strongpass123"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def log_workout(client, headers, performed_at: date, exercise: str, sets: list[tuple[int, float]]):
    response = client.post(
        "/api/workouts",
        headers=headers,
        json={
            "performed_at": performed_at.isoformat(),
            "notes": "test session",
            "sets": [
                {"exercise": exercise, "reps": reps, "weight": weight}
                for reps, weight in sets
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def weekly_dates(count: int) -> list[date]:
    today = date.today()
    return [today - timedelta(weeks=count - 1 - index) for index in range(count)]
