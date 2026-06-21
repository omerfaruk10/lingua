# Lingua

Çok dilli dil öğrenme **takip sistemi**. AI uygulamanın içinde çalışmaz —
sadece ilerleme takibi (konular) + kişisel kelime bankası (kelimeler + Gmail
tarzı etiketler). Öğretim ayrı, Claude sohbetinde yapılır.

Her dil kendi çalışma alanına sahiptir; birden fazla dili paralel takip
edebilirsin (örn. İngilizce ve İtalyanca aynı anda).

## Sayfalar

- **Diller** (`/languages`) — Ana sayfa. Takip ettiğin dillerin listesi.
  Yeni dil ekler, sıralar (sürükle-bırak) ve birine tıklayıp çalışma alanına
  girersin. URL'de dil kodu görünür: `/languages/en/...`.
- **Konular** (`Topics`) — O dilde çalıştığın konuların kanban panosu:
  _Başlamadı · Devam ediyor · Tamamlandı_. Kartları sürükleyip durumunu ve
  sırasını değiştirebilirsin.
- **Kelimeler** (`Words`) — Kişisel kelime bankan. Her kelimede okunuş,
  anlam, tanım, örnek cümle ve etiketler tutulur. Etikete göre filtrelersin.
- **Etiketler** (`Labels`) — Kelimeleri gruplamak için Gmail tarzı renkli
  etiketler. Buradaki sıra, kelime kartlarındaki etiket sırasını da belirler.

Arayüz dili (TR/EN/IT/ES/DE/FR) sağ üstten değiştirilebilir; öğrenilen
dilden bağımsızdır.

## Çalıştırma (en kolay)

`start-lingua.bat` dosyasına **çift tıkla**. Backend ve frontend ayrı
pencerelerde açılır, birkaç saniye sonra tarayıcı **http://localhost:5173**
adresine gider.

**Kapatmak:** açılan iki pencereyi kapat, ya da `stop-lingua.bat`'a çift tıkla.

## Elle çalıştırma (iki terminal)

```powershell
# Terminal 1 — Backend (port 8010)
cd backend
.\.venv\Scripts\uvicorn.exe app.main:app --port 8010

# Terminal 2 — Frontend
cd frontend
npm run dev
```

> Backend 8010 portunda (8000 başka bir uygulamada). Frontend `frontend/.env`
> ile oraya bağlanır.

## Veri ve yedek

Tüm verin **`backend/lingua.db`** (SQLite) dosyasına diske yazılır ve kapatıp
açınca kalıcıdır. Yedek almak için bu **tek dosyayı** kopyalaman yeterli;
taşımak için de onu kopyalarsın.

## Daha fazla

Mimari, API uçları ve testler: [backend/README.md](backend/README.md)
