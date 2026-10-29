from __future__ import annotations

import os
import secrets

SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(48)
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "training_diary_session")
SESSION_MAX_AGE = int(os.getenv("SESSION_MAX_AGE", str(60 * 60 * 24 * 7)))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
