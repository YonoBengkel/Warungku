@echo off
rem Nyalakan Turnify Flow di komputer lokal. Klik dua kali berkas ini.
rem Rinciannya di tools\lokal\nyalakan.ps1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\lokal\nyalakan.ps1" %*
echo.
pause
