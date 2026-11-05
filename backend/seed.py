"""Seed CoachApp with a demo account and eight weeks of realistic training data.

Usage:
    .venv\\Scripts\\python.exe seed.py
    .venv\\Scripts\\python.exe seed.py --force
"""

import argparse

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.demo import DEMO_EMAIL, DEMO_PASSWORD, seed_demo
from app.models import User


def seed(force: bool = False) -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if user is not None and not force:
            print(f"Demo account already exists ({DEMO_EMAIL}). Use --force to reset it.")
            return
        seed_demo(db, force=force)
        print("Seeded demo data.")
        print(f"  Email:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed CoachApp demo data.")
    parser.add_argument("--force", action="store_true", help="Delete and recreate the demo account.")
    args = parser.parse_args()
    seed(force=args.force)
