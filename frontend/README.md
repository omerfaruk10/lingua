# Lingua — Frontend

React · TypeScript · Vite · Tailwind CSS

## Kurulum

```bash
cd frontend
npm install
```

## Çalıştırma

```bash
npm run dev
```

Uygulama http://localhost:5173 adresinde çalışır.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `VITE_API_URL` | `http://127.0.0.1:8010` | Backend API adresi |

`.env.example` dosyasını `.env` olarak kopyalayıp gerekirse düzenle.

## Yapı

```
src/
  api/        # Backend istek fonksiyonları
  components/ # Paylaşılan UI bileşenleri
  hooks/      # React Query mutation/query hook'ları
  i18n/       # Çeviri dosyaları (TR/EN/IT/ES/DE/FR)
  lib/        # Yardımcı fonksiyonlar
  pages/      # Sayfa bileşenleri
  types/      # Backend şemalarıyla eşleşen TS tipleri
```
