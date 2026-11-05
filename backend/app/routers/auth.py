from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..config import settings
from ..database import get_db
from ..demo import cleanup_expired_demo_users, create_isolated_demo_user, is_reserved_demo_email
from ..models import User
from ..schemas import LoginRequest, Token, UserCreate, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> Token:
    email = payload.email.lower()
    if is_reserved_demo_email(email):
        raise HTTPException(status_code=400, detail="This email is reserved for demo accounts.")
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id), user=UserRead.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return Token(access_token=create_access_token(user.id), user=UserRead.model_validate(user))


@router.post("/demo", response_model=Token)
def demo_login(db: Session = Depends(get_db)) -> Token:
    cleanup_expired_demo_users(db, settings.access_token_expire_minutes)
    user = create_isolated_demo_user(db)
    return Token(access_token=create_access_token(user.id), user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
