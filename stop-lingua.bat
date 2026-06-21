@echo off
echo Lingua durduruluyor...
taskkill /FI "WINDOWTITLE eq Lingua Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Lingua Frontend*" /T /F >nul 2>&1
echo Durduruldu.
timeout /t 2 /nobreak >nul
