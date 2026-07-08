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
| languages | Saf dil kataloğu (kod, ad, yerel ad) |
| courses | Bir öğrenme kurulumu: hedef dil + ana dil (`languages` FK'leri) |
| course_helpers | Bir kursun 0-3 yardımcı dili (courses–languages çok-çok, sıralı) |
| topics | Konular ve ilerleme durumu (not_started / in_progress / done), `course_id`'ye bağlı |
| words | Kelime kartları (okunuş, eş/zıt anlam, kök, tanım, örnek cümle, çeviri), `course_id`'ye bağlı |
| word_meanings | Bir kelimenin kursun her dilindeki anlamı (word_id + language_id başına bir satır) |
| labels | Renkli etiketler, `course_id`'ye bağlı |
| word_labels | Kelime–etiket çok-çok ilişkisi |
| review_events | Aralıklı tekrar geçmişi |
| ai_suggestion_cache | AI kelime önerileri için lokal cache (senses/details ayrı anahtarlarla) |

Tüm veriler `lingua.db` (SQLite) dosyasında saklanır. Kelime içe aktarma için `POST /languages/{course_id}/words/import` uç noktası kullanılır (frontend, CSV/TXT dosyasını sabit sütun sırasına göre kendisi ayrıştırıp JSON gönderir).

AI kelime önerileri için `POST /languages/{course_id}/words/suggest` ve
`POST /languages/{course_id}/words/suggest/details` uç noktaları kullanılır. Gemini/cache
sağlıklı sonuç vermezse düşük kaliteli sözlük/çeviri fallback'i kullanılmaz.
