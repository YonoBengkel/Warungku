<#
Matikan semua yang dinyalakan tools\lokal\nyalakan.ps1 atau tools\lokal\siapkan.ps1.

Cara pakai: klik dua kali matikan.cmd di akar repo, atau
    powershell -ExecutionPolicy Bypass -File tools\lokal\matikan.ps1

Pilihan:
  -SisakanBasisData   kontainer basis data dibiarkan menyala (kontainer API dan
                      layanan model dari siapkan.ps1 tetap dihentikan)

Data di basis data tidak hilang: kontainernya hanya dihentikan, volumenya tetap.
#>
param(
    [switch]$SisakanBasisData
)

$ErrorActionPreference = 'Continue'
$Akar = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Akar
$BerkasPid = Join-Path $env:TEMP 'turnify-lokal-pid.txt'

Write-Host 'Turnify Flow: mematikan layanan lokal' -ForegroundColor White

# 1. Jendela yang dibuka nyalakan.ps1, beserta seluruh proses anaknya.
if (Test-Path $BerkasPid) {
    foreach ($id in Get-Content $BerkasPid) {
        # Hanya jendela PowerShell: nomor lama bisa sudah dipakai program lain.
        if (($id -match '^\d+$') -and ((Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName -eq 'powershell')) {
            cmd /c "taskkill /PID $id /T /F >nul 2>&1"
        }
    }
    Remove-Item $BerkasPid -Force
}

# 2. Sisa yang masih memegang port (mis. dinyalakan dengan tangan): hanya
#    proses python dan node, supaya program lain tidak ikut dimatikan.
foreach ($port in @(8000, 8001, 5173)) {
    $koneksi = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($k in $koneksi) {
        $proses = Get-Process -Id $k.OwningProcess -ErrorAction SilentlyContinue
        if ($proses -and ($proses.ProcessName -in @('python', 'pythonw', 'node'))) {
            cmd /c "taskkill /PID $($proses.Id) /T /F >nul 2>&1"
        }
    }
}
# 3. Jendela layanan yang nomornya tidak tercatat lagi. Judul jendela tidak bisa
#    dibaca kalau jendelanya ditampung Windows Terminal, jadi yang dibaca adalah
#    perintah tersandi (-EncodedCommand) yang dikirim nyalakan.ps1.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CommandLine -match '-EncodedCommand\s+(\S+)') {
        $isi = ''
        try { $isi = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($Matches[1])) } catch { }
        if ($isi -like "*WindowTitle = 'Turnify *") { cmd /c "taskkill /PID $($_.ProcessId) /T /F >nul 2>&1" }
    }
}
Write-Host '    API, layanan model, dan frontend dimatikan' -ForegroundColor Green

# 4. Kontainer: API dan layanan model (jalur Docker, dari siapkan.ps1), lalu
#    basis data. Profil "layanan" harus disebut, kalau tidak Compose melewatkan
#    kontainer API dan layanan model.
if (Get-Command docker -ErrorAction SilentlyContinue) {
    cmd /c 'docker compose -f deployment/docker-compose.yml --profile layanan stop api ml >nul 2>&1'
    if ($SisakanBasisData) {
        Write-Host '    Basis data dibiarkan menyala'
    } else {
        cmd /c 'docker compose -f deployment/docker-compose.yml stop db >nul 2>&1'
        Write-Host '    Basis data dihentikan (datanya tetap tersimpan)' -ForegroundColor Green
    }
}
