import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 -- modelleri Base.metadata'ya kaydeder
from app.database import Base, get_db
from app.main import app


@pytest.fixture
def client():
    """Her test icin temiz, in-memory bir DB + ona bagli TestClient.

    StaticPool: in-memory SQLite'in tum baglantilarda ayni veriyi gormesini saglar.
    FK pragma'si database.py'deki global Engine event'i sayesinde burada da aktif.
    """
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
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def language(client):
    """Hazir bir dil (cogu test buna ihtiyac duyar)."""
    return client.post(
        "/languages", json={"code": "it", "name": "Italian", "native_name": "Italiano"}
    ).json()
