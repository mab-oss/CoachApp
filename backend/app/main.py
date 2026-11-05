from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import agent, auth, progress, workouts


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="CoachApp API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workouts.router)
app.include_router(progress.router)
app.include_router(agent.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "agent_mode": "claude" if settings.anthropic_api_key else "deterministic"}
