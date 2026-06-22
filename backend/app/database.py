import os
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
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


def ensure_schema() -> None:
    """Hafif otomatik gocum: var olan DB'de eksik kolonlari ekler (veri korunur).

    create_all yeni tablolari kurar ama mevcut tablolara kolon eklemez; SRS/Alembic
    gelene kadar bu kucuk yardimci tek tek eklemeleri ustlenir.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "languages" not in tables:
        return

    lang_cols = {c["name"] for c in inspector.get_columns("languages")}
    if "order_index" not in lang_cols:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE languages ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0")
            )

    # SRS alanlari: var olan words tablosuna eksikse ekle (veri korunur).
    if "words" in tables:
        word_cols = {c["name"] for c in inspector.get_columns("words")}
        word_additions = {
            "learning_status": "ALTER TABLE words ADD COLUMN learning_status VARCHAR(20) NOT NULL DEFAULT 'new'",
            "review_stage": "ALTER TABLE words ADD COLUMN review_stage INTEGER NOT NULL DEFAULT 0",
            "next_review_date": "ALTER TABLE words ADD COLUMN next_review_date DATE",
            "learned_at": "ALTER TABLE words ADD COLUMN learned_at DATETIME",
        }
        missing = [sql for col, sql in word_additions.items() if col not in word_cols]
        if missing:
            with engine.begin() as conn:
                for sql in missing:
                    conn.execute(text(sql))
