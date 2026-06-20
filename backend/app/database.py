import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# SQLite dosyasi backend/ kokunde durur. Tek dosya = kolay yedek/tasima.
# Testler ayri bir DB kullanabilsin diye env ile gecersiz kilinabilir.
SQLALCHEMY_DATABASE_URL = os.getenv("LINGUA_DATABASE_URL", "sqlite:///./lingua.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # SQLite + FastAPI'nin thread havuzu icin gerekli.
    connect_args={"check_same_thread": False},
)


@event.listens_for(Engine, "connect")
def _enable_sqlite_fk(dbapi_connection, connection_record):
    """SQLite FK kisitlarini denetlemez; ON DELETE CASCADE icin acmamiz gerek."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Tum ORM modellerinin ortak tabani."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: istek basina bir DB oturumu acar/kapatir."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
