import os
import subprocess
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-tests"
os.environ["JWT_EXPIRES_MIN"] = "60"

from app.config import get_settings

get_settings.cache_clear()

import pytest
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.models import IdempotencyKey, Rescate, RescateHistorial


@pytest.fixture
def real_db():
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip(
            "Define TEST_DATABASE_URL con una base PostgreSQL para ejecutar los tests de integración"
        )

    backend_dir = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        env=env,
        check=True,
    )
    engine = create_engine(database_url, pool_pre_ping=True)
    with Session(engine) as db:
        yield db
        db.execute(delete(IdempotencyKey))
        db.execute(delete(RescateHistorial))
        db.execute(delete(Rescate))
        db.commit()
    engine.dispose()
