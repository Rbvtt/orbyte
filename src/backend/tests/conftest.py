import os

os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-tests"
os.environ["JWT_EXPIRES_MIN"] = "60"

from app.config import get_settings

get_settings.cache_clear()
