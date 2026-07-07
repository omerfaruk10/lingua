# Lingua

Çok dilli dil öğrenme takip sistemi. İlerleme takibi (konular) ve kişisel kelime bankası (kelimeler + etiketler) sunar.

Her **kurs**, bir hedef dil + bir ana dil + 0-3 yardımcı dilden oluşur (örn. İtalyanca öğrenirken ana dil Türkçe, yardımcı diller İngilizce/Almanca olabilir). Aynı hedef dil için farklı ana/yardımcı dil kombinasyonlarıyla birden fazla kurs açılabilir; her kurs bağımsız bir çalışma alanıdır.

## Sayfalar

| Sayfa | URL | Açıklama |
|---|---|---|
| Diller | `/languages` | Kursların listesi. Sürükle-bırak ile sıralama desteklenir. |
| Konular | `/languages/:courseSlug/topics` | Kanban panosu: Başlamadı · Devam Ediyor · Tamamlandı |
| Kelimeler | `/languages/:courseSlug/words` | Kelime bankası. Her kayıtta okunuş, eş/zıt anlam, kelime kökü, tanım, örnek cümle, çeviri ve etiketler bulunur. **Yapay Zeka** ile otomatik kelime doldurma, sesli telaffuz (Text-to-Speech) ve tüm diller için ücretsiz **çeviri sözlüğü** yedek mekanizması içerir. |
| Tekrar | `/languages/:courseSlug/review` | Zamanlanmış (1·3·7·14·30 gün) aralıklı tekrar akışı. |
| Etiketler | `/languages/:courseSlug/labels` | Renk kodlu etiketler. Buradaki sıra, kelime kartlarındaki etiket sırasını belirler. |
| İstatistik | `/languages/:courseSlug/stats` | Günlük/haftalık/aylık ilerleme grafikleri. |

`:courseSlug` hedef-ana[-yardımcı...] dil kodlarının birleşimidir (örn. `it-tr` veya `it-tr-en-de`). Arayüz dili (TR/EN/IT/ES/DE/FR) öğrenilen dilden bağımsız olarak değiştirilebilir.

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
