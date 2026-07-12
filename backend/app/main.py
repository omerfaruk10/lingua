import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ortam degiskenlerini yukle (GEMINI_API_KEY vb.). Once repo kokundeki .env
# (backend/ ustunde), sonra backend/.env — ikisi de opsiyonel.
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")
load_dotenv(_ROOT / "backend" / ".env")

from app import models  # noqa: E402,F401 -- modelleri Base.metadata'ya kaydeder
from app.database import Base, engine, ensure_schema  # noqa: E402
from app.routers import labels, languages, learning_sessions, stats, topics, words  # noqa: E402

# Iskelet asamasi: tablolari dogrudan olustur.
# SRS alanlari eklerken sema degisecegi icin ileride Alembic (migration) gelecek.
Base.metadata.create_all(bind=engine)
ensure_schema()  # var olan DB'ye eksik kolonlari ekle (veri korunur)

app = FastAPI(title="Lingua API", version="0.1.0")

# CORS: frontend (Vite/CRA) lokal gelistirme sunucularindan API'ye erisebilsin.
# Virgulle ayrilmis liste olarak env ile gecersiz kilinabilir.
_default_origins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
allow_origins = os.getenv("LINGUA_CORS_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(languages.router)
app.include_router(topics.router)
app.include_router(words.router)
app.include_router(learning_sessions.router)
app.include_router(labels.router)
app.include_router(stats.router)


@app.get("/health")
def health():
    return {"status": "ok"}
