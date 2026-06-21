# Lingua — Backend

FastAPI · SQLAlchemy 2.0 · SQLite · Pydantic v2

## Çalıştırma

```bash
cd backend
uvicorn app.main:app --reload --port 8010
```

API: http://127.0.0.1:8010 · Swagger: http://127.0.0.1:8010/docs

## Testler

```bash
pytest
```

## Veri modeli

| Tablo | Açıklama |
|---|---|
| languages | Diller |
| topics | Konular ve ilerleme durumu (not_started / in_progress / done) |
| words | Kelime kartları (okunuş, anlam, tanım, örnek cümle) |
| labels | Renkli etiketler |
| word_labels | Kelime–etiket çok-çok ilişkisi |

Tüm veriler `lingua.db` (SQLite) dosyasında saklanır.
