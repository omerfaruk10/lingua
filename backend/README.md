# Lingua — Backend

Çok dilli dil öğrenme **takip sistemi**. İçinde AI çalışmaz; sadece ilerleme
takibi (konular) + kişisel kelime bankası (kelimeler + Gmail tarzı etiketler).

## Stack
FastAPI · SQLAlchemy 2.0 · SQLite · Pydantic v2 — `routers → crud → models` ayrımı.

## Kurulum
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows (bash: source .venv/Scripts/activate)
pip install -r requirements.txt
```

## Çalıştırma
```bash
uvicorn app.main:app --reload
```
- API: http://127.0.0.1:8000
- İnteraktif dokümanlar (Swagger): http://127.0.0.1:8000/docs

İlk çalıştırmada `lingua.db` otomatik oluşur.

## Test
```bash
pip install -r requirements-dev.txt
pytest
```
Testler izole, in-memory bir DB kullanır; `lingua.db`'ye dokunmaz.

## Ortam değişkenleri (opsiyonel)
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `LINGUA_DATABASE_URL` | `sqlite:///./lingua.db` | DB bağlantısı |
| `LINGUA_CORS_ORIGINS` | `localhost:5173,3000,127.0.0.1:5173` | İzinli frontend origin'leri (virgülle) |

## Veri modeli
- **languages** — diller (her dilin verisi `language_id` ile izole)
- **topics** — müfredat/ilerleme; `status` (not_started/in_progress/done), `done` olunca `completed_at` otomatik
- **words** — 11 alanlı kelime kartı; sadece `term` zorunlu, tekrar serbest
- **labels** + **word_labels** — Gmail tarzı çok-çok etiketler

## API uçları
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

## Notlar
- Şema migration'ı şu an `create_all` ile. SRS alanları eklenince **Alembic** gelecek.
