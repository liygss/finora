"""Shared test fixtures — in-memory SQLite + FastAPI TestClient."""

import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database.database import Base, get_db
from app.main import app
from app.middleware.auth import create_access_token, hash_password

# In-memory SQLite with StaticPool so all connections share the same DB
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset slowapi counter tiap tes supaya batas request/menit di endpoint
    auth & upload tidak membuat tes lain gagal (counter global per-process)."""
    yield
    from app.routers.authentication import limiter as auth_limiter
    from app.routers.upload import limiter as upload_limiter

    auth_limiter.reset()
    upload_limiter.reset()


@pytest.fixture()
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=False)


def _login_as(client: TestClient, user_id: str) -> TestClient:
    """Set auth cookie directly — bypasses rate limiter."""
    token = create_access_token(subject=user_id)
    client.cookies.set("access_token", token, path="/")
    return client


@pytest.fixture()
def auth_client(client, db):
    """TestClient dengan user terautentikasi (cookie-based)."""
    from app.database.models import User, RoleUser

    user = User(
        email="test@example.com",
        hashed_password=hash_password("Test1234!"),
        full_name="Test User",
        company_name="Test Corp",
        role=RoleUser.OWNER,
        is_active=True,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _login_as(client, user.id)


@pytest.fixture()
def admin_client(client, db):
    """TestClient dengan admin terautentikasi."""
    from app.database.models import User, RoleUser

    admin = User(
        email="admin@example.com",
        hashed_password=hash_password("Admin1234!"),
        full_name="Admin User",
        company_name="Test Corp",
        role=RoleUser.ADMIN,
        is_active=True,
        email_verified=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _login_as(client, admin.id)
