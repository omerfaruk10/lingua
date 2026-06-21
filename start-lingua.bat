@echo off
title Lingua
echo ============================================
echo   Lingua baslatiliyor...
echo ============================================
echo.

REM Backend (FastAPI) - 8010 portu, ayri pencerede
start "Lingua Backend" /D "%~dp0backend" cmd /k .venv\Scripts\uvicorn.exe app.main:app --port 8010

REM Frontend (Vite) - 5173 portu, ayri pencerede
start "Lingua Frontend" /D "%~dp0frontend" cmd /k npm run dev

echo Iki pencere acildi (Backend + Frontend).
echo Tarayici birazdan acilacak: http://localhost:5173
echo.
echo Kapatmak icin: acilan iki pencereyi kapat ya da stop-lingua.bat'i calistir.

REM Sunucular ayaga kalksin diye birkac saniye bekle, sonra tarayiciyi ac
timeout /t 6 /nobreak >nul
start "" http://localhost:5173
exit
