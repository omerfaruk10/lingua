# Lingua

Çok dilli dil öğrenme takip sistemi. İlerleme takibi (konular) ve kişisel kelime bankası (kelimeler + etiketler) sunar.

## Sayfalar

| Sayfa | URL | Açıklama |
|---|---|---|
| Diller | `/languages` | Takip edilen dillerin listesi. Sürükle-bırak ile sıralama desteklenir. |
| Konular | `/languages/:code/topics` | Kanban panosu: Başlamadı · Devam Ediyor · Tamamlandı |
| Kelimeler | `/languages/:code/words` | Kelime bankası. Her kayıtta okunuş, anlam, tanım, örnek cümle ve etiketler bulunur. |
| Etiketler | `/languages/:code/labels` | Renk kodlu etiketler. Buradaki sıra, kelime kartlarındaki etiket sırasını belirler. |

Her dil bağımsız bir çalışma alanına sahiptir. Arayüz dili (TR/EN/IT/ES/DE/FR) öğrenilen dilden bağımsız olarak değiştirilebilir.

## Çalıştırma

```powershell
# Backend (port 8010)
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --port 8010

# Frontend
cd frontend
npm run dev
```

`start-lingua.bat` her ikisini birden başlatır.

## Veri

Tüm veriler `backend/lingua.db` (SQLite) dosyasında saklanır. Yedek almak için bu dosyayı kopyalamak yeterlidir.

## Daha fazla

[backend/README.md](backend/README.md) — mimari, API uçları, testler
