# Lingua — Backend

FastAPI · SQLAlchemy 2.0 · SQLite · Pydantic v2

Katman yapısı: `routers → crud → models`

## Kurulum

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
```

## Çalıştırma

```bash
uvicorn app.main:app --reload --port 8010
```

- API: http://127.0.0.1:8010
- Swagger: http://127.0.0.1:8010/docs

İlk çalıştırmada `lingua.db` otomatik oluşturulur.

## Testler

```bash
pip install -r requirements-dev.txt
pytest
```

Testler izole in-memory DB kullanır.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `LINGUA_DATABASE_URL` | `sqlite:///./lingua.db` | Veritabanı bağlantısı |
| `LINGUA_CORS_ORIGINS` | `localhost:5173,3000,127.0.0.1:5173` | İzin verilen frontend origin'leri (virgülle ayrılmış) |

## Veri modeli

- **languages** — diller; tüm alt kaynaklar `language_id` ile izole
- **topics** — konu takibi; `status` (not_started / in_progress / done), `done` atanınca `completed_at` otomatik set edilir
- **words** — 11 alanlı kelime kartı; yalnızca `term` zorunlu
- **labels** + **word_labels** — çok-çok etiket ilişkisi; `order_index` kelime kartlarındaki görünüm sırasını belirler

## API

```
GET/POST            /languages
GET/PATCH/DELETE    /languages/{lid}

GET/POST            /languages/{lid}/topics
GET/PATCH/DELETE    /languages/{lid}/topics/{tid}

GET/POST            /languages/{lid}/words          ?search= &label_id=
GET/PATCH/DELETE    /languages/{lid}/words/{wid}
POST/DELETE         /languages/{lid}/words/{wid}/labels/{label_id}

GET/POST            /languages/{lid}/labels
PATCH/DELETE        /languages/{lid}/labels/{label_id}
```
