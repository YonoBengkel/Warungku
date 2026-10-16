@echo off
rem Matikan semua layanan lokal Turnify Flow. Klik dua kali berkas ini.
rem Rinciannya di tools\lokal\matikan.ps1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\lokal\matikan.ps1" %*
echo.
pause
