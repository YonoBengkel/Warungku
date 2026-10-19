@echo off
rem Siapkan dan nyalakan Turnify Flow lewat Docker, tanpa Python. Klik dua kali berkas ini.
rem
rem Boleh diunduh sendirian sebelum punya repo: taruh di folder mana saja, lalu
rem klik dua kali. Repo di-clone ke folder turnify-flow di sebelahnya, image
rem diunduh dari Docker Hub, dan semua layanan dinyalakan.
rem Di dalam repo, berkas ini juga dipakai untuk menyalakan aplikasi lagi.
rem Rinciannya di tools\lokal\siapkan.ps1
rem
rem Sengaja tanpa goto dan label: berkas yang diunduh langsung dari GitHub
rem berakhiran baris LF, dan cmd bisa salah membaca label di berkas seperti itu.
cd /d "%~dp0"
if exist "%~dp0tools\lokal\siapkan.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\lokal\siapkan.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $f = Join-Path $env:TEMP 'turnify-siapkan.ps1'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/YonoBengkel/Warungku/Rombak%%233/tools/lokal/siapkan.ps1' -OutFile $f } catch { Write-Host 'BELUM BISA: skrip penyiap tidak bisa diunduh dari GitHub. Periksa koneksi internet.' -ForegroundColor Red; exit 1 }; & $f -Folder '%~dp0turnify-flow' %*; exit $LASTEXITCODE"
)
echo.
pause
