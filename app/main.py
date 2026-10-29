from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import (
    COOKIE_SECURE,
    SECRET_KEY,
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
)
from app.routers import auth, exercises, workouts

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Дневник тренировок",
    description="Веб-приложение для учёта тренировок, упражнений и прогресса.",
    version="1.0.0",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie=SESSION_COOKIE_NAME,
    max_age=SESSION_MAX_AGE,
    same_site="lax",
    https_only=COOKIE_SECURE,
)

app.include_router(auth.router)
app.include_router(workouts.router)
app.include_router(exercises.router)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def index_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/login", include_in_schema=False)
def login_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "login.html")


@app.get("/register", include_in_schema=False)
def register_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "register.html")
