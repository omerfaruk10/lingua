# Lingua

Çok dilli dil öğrenme **takip sistemi**. AI uygulamanın içinde çalışmaz —
sadece ilerleme takibi (konular) + kişisel kelime bankası (kelimeler + Gmail
tarzı etiketler). Öğretim ayrı, Claude sohbetinde yapılır.

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
