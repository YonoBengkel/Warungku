<#
Nyalakan Turnify Flow di komputer lokal dengan satu perintah.

Cara pakai: klik dua kali nyalakan.cmd di akar repo, atau
    powershell -ExecutionPolicy Bypass -File tools\lokal\nyalakan.ps1

Yang dikerjakan, berurutan:
  1. Docker Desktop dinyalakan bila belum, lalu basis data (port 5433).
  2. Paket Python dipasang bila belum ada (cukup paket produksi + alembic).
  3. backend\.env disiapkan, termasuk WARUNGKU_RAHASIA acak supaya login
     tidak hangus setiap API dinyalakan ulang.
  4. Skema basis data dinaikkan ke versi terbaru (alembic upgrade head),
     UMKM produsen ditambahkan bila belum ada, dan variasi demo (pesanan,
     kontrak, stok) disegarkan bila umurnya lebih dari tiga hari.
  5. API (8000), layanan model (8001), dan frontend (5173), masing-masing di
     jendela sendiri. Layanan yang sudah menyala tidak dinyalakan dua kali.
  6. Ketiga mesin dijalankan sekali bila keluarannya belum lengkap.
  7. Peramban dibuka di halaman Masuk.

Pilihan:
  -TanpaPeramban   jangan buka peramban di akhir
  -JalankanMesin   jalankan ketiga mesin walau keluarannya sudah lengkap

Matikan semuanya dengan matikan.cmd.
#>
param(
    [switch]$TanpaPeramban,
    [switch]$JalankanMesin
)

# Sengaja bukan 'Stop': di Windows PowerShell 5.1, keluaran stderr program luar
# (docker, pip) dianggap galat dan menghentikan skrip walau programnya berhasil.
# Hasil setiap perintah diperiksa lewat $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$Akar = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Akar
$BerkasPid = Join-Path $env:TEMP 'turnify-lokal-pid.txt'
$Compose = 'docker compose -f deployment/docker-compose.yml'

function Langkah([string]$teks) { Write-Host ''; Write-Host "==> $teks" -ForegroundColor Cyan }
function Oke([string]$teks) { Write-Host "    $teks" -ForegroundColor Green }
function Info([string]$teks) { Write-Host "    $teks" }
function Gagal([string]$teks) {
    Write-Host ''
    Write-Host "BELUM BISA: $teks" -ForegroundColor Red
    exit 1
}

# Jalankan perintah lewat cmd supaya stderr tidak jadi galat PowerShell.
function Diam([string]$perintah) {
    cmd /c "$perintah >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}
function Tampil([string]$perintah) {
    cmd /c "$perintah 2>&1" | ForEach-Object { Write-Host "    $_" }
    return ($LASTEXITCODE -eq 0)
}

function Tunggu-Url([string]$url, [int]$detik) {
    $batas = (Get-Date).AddSeconds($detik)
    while ((Get-Date) -lt $batas) {
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
            return $true
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

function Url-Hidup([string]$url) {
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Port-Dipakai([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# Jendela PowerShell baru yang menjalankan satu layanan. Perintahnya dikirim
# sebagai -EncodedCommand supaya jalur berspasi tidak terpotong.
function Buka-Jendela([string]$judul, [string]$perintah) {
    $isi = "`$host.UI.RawUI.WindowTitle = '$judul'; Set-Location -LiteralPath '$Akar'; $perintah"
    $kode = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($isi))
    $p = Start-Process powershell -PassThru -ArgumentList "-NoExit -NoProfile -ExecutionPolicy Bypass -EncodedCommand $kode"
    Add-Content -LiteralPath $BerkasPid -Value $p.Id
}

Write-Host 'Turnify Flow: menyalakan semua layanan lokal' -ForegroundColor White

# --------------------------------------------------------------------------
Langkah 'Memeriksa program yang dibutuhkan'
foreach ($program in @('docker', 'node', 'npm')) {
    if (-not (Get-Command $program -ErrorAction SilentlyContinue)) {
        Gagal "$program tidak ditemukan. Pasang dulu (lihat bagian Mulai cepat di README)."
    }
}
$Python = 'python'
$PythonVenv = Join-Path $Akar '.venv\Scripts\python.exe'
if (Test-Path $PythonVenv) {
    $Python = $PythonVenv
} elseif (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Gagal 'python tidak ditemukan. Pasang Python 3.12 atau lebih baru.'
}
Oke "Python: $Python"

# --------------------------------------------------------------------------
Langkah 'Docker dan basis data'
if (-not (Diam 'docker info')) {
    $docker = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path $docker)) { Gagal 'Docker Desktop belum menyala dan tidak ditemukan di Program Files.' }
    Info 'Menyalakan Docker Desktop (bisa sampai dua menit)...'
    Start-Process $docker
    $batas = (Get-Date).AddMinutes(3)
    while (-not (Diam 'docker info')) {
        if ((Get-Date) -gt $batas) { Gagal 'Docker Desktop belum siap sesudah tiga menit. Buka Docker Desktop, tunggu, lalu ulangi.' }
        Start-Sleep -Seconds 3
    }
}
Oke 'Docker siap'

# Kontainer API dan layanan model dari jalur Docker memakai port yang sama
# dengan uvicorn di bawah. Skrip ini memakai uvicorn, jadi keduanya dihentikan.
$kontainer = cmd /c 'docker ps --format "{{.Names}}" 2>nul'
if (($kontainer -contains 'turnify-api') -or ($kontainer -contains 'turnify-ml')) {
    Info 'Menghentikan kontainer turnify-api dan turnify-ml (portnya dipakai uvicorn)...'
    Diam "$Compose --profile layanan stop api ml" | Out-Null
}

if (-not (Tampil "$Compose up -d db")) { Gagal 'Basis data tidak bisa dinyalakan. Periksa pesan docker di atas.' }
Info 'Menunggu basis data siap (pertama kali sekitar satu menit untuk memulihkan data)...'
$batas = (Get-Date).AddMinutes(5)
while ($true) {
    $status = cmd /c 'docker inspect --format "{{.State.Health.Status}}" warungku-db 2>nul'
    if ($status -eq 'healthy') { break }
    if ((Get-Date) -gt $batas) { Gagal "Basis data belum sehat sesudah lima menit (status: $status)." }
    Start-Sleep -Seconds 3
}
Oke 'Basis data siap di port 5433'

# --------------------------------------------------------------------------
Langkah 'Lingkungan Python'
if (-not (Diam "`"$Python`" -c `"import api, warungku, ml, dataset, lightgbm, alembic, uvicorn`"")) {
    Info 'Memasang paket Python (sekali saja, beberapa menit)...'
    if (-not (Tampil "`"$Python`" -m pip install -r requirements-produksi.txt `"alembic>=1.13`"")) { Gagal 'Pemasangan paket Python gagal. Lihat pesan pip di atas.' }
    if (-not (Tampil "`"$Python`" -m pip install -e . --no-deps")) { Gagal 'Pemasangan paket proyek gagal.' }
}
Oke 'Paket Python lengkap'

$Env = Join-Path $Akar 'backend\.env'
if (-not (Test-Path $Env)) {
    Copy-Item (Join-Path $Akar 'backend\.env.example') $Env
    Info 'backend\.env dibuat dari .env.example'
}
$isiEnv = Get-Content -LiteralPath $Env -Raw
if ($isiEnv -notmatch '(?m)^WARUNGKU_RAHASIA=\S') {
    $acak = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($acak)
    $rahasia = [Convert]::ToBase64String($acak) -replace '[+/=]', 'x'
    $awal = ''
    if ($isiEnv -and -not $isiEnv.EndsWith("`n")) { $awal = "`r`n" }
    Add-Content -LiteralPath $Env -Value ($awal + "WARUNGKU_RAHASIA=$rahasia") -Encoding ASCII
    Info 'WARUNGKU_RAHASIA acak ditambahkan ke backend\.env (berkas ini tidak dilacak git)'
}
Oke 'backend\.env siap'

# --------------------------------------------------------------------------
Langkah 'Skema dan data'
if (-not (Tampil "`"$Python`" -m alembic -c backend/alembic.ini upgrade head")) { Gagal 'Migrasi basis data gagal.' }
$keluaranProdusen = cmd /c "`"$Python`" -m dataset.umkm_produksi 2>&1"
if ($LASTEXITCODE -ne 0) {
    $keluaranProdusen | ForEach-Object { Write-Host "    $_" }
    Gagal 'UMKM produsen tidak bisa ditambahkan.'
}
$produsenBaru = [bool]($keluaranProdusen -match '^Selesai')
if ($produsenBaru) { Oke 'UMKM produsen (Dapur Sambal Bu Ratmi) ditambahkan' } else { Oke 'Skema terbaru, UMKM produsen sudah ada' }

# Variasi pesanan, kontrak, dan stok untuk dua akun demo. Tanggalnya relatif
# terhadap hari ini, jadi disegarkan kalau umurnya lebih dari tiga hari.
$keluaranVariasi = cmd /c "`"$Python`" -m dataset.variasi_demo --jika-basi 2>&1"
if ($LASTEXITCODE -ne 0) {
    $keluaranVariasi | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" }
    Write-Host '    Variasi demo belum terpasang; aplikasi tetap bisa dipakai.' -ForegroundColor Yellow
} elseif ($keluaranVariasi -match 'masih segar') {
    Oke 'Variasi demo (pesanan, kontrak, stok) masih segar'
} else {
    Oke 'Variasi demo (pesanan, kontrak, stok) dipasang ulang dengan tanggal hari ini'
}

# --------------------------------------------------------------------------
Langkah 'Menyalakan API, layanan model, dan frontend'
# Daftar jendela dari jalan sebelumnya dipertahankan selama jendelanya masih
# hidup, supaya matikan.cmd tetap bisa menutupnya walau skrip ini dijalankan
# dua kali. Nomor yang sudah mati dibuang: sesudah komputer dinyalakan ulang,
# nomor itu bisa dipakai program lain.
if (Test-Path $BerkasPid) {
    $hidup = @(Get-Content $BerkasPid | Where-Object {
        ($_ -match '^\d+$') -and ((Get-Process -Id $_ -ErrorAction SilentlyContinue).ProcessName -eq 'powershell')
    })
    Set-Content -LiteralPath $BerkasPid -Value $hidup
}

$layanan = @(
    @{ Nama = 'API'; Port = 8000; Url = 'http://localhost:8000/sehat'; Judul = 'Turnify API (8000)';
       Perintah = "& '$Python' -m uvicorn api.utama:app --port 8000" },
    @{ Nama = 'Layanan model'; Port = 8001; Url = 'http://localhost:8001/sehat'; Judul = 'Turnify layanan model (8001)';
       Perintah = "& '$Python' -m uvicorn ml.layanan:app --port 8001" },
    @{ Nama = 'Frontend'; Port = 5173; Url = 'http://localhost:5173'; Judul = 'Turnify frontend (5173)';
       Perintah = 'npm.cmd run dev' }
)

if (-not (Test-Path (Join-Path $Akar 'frontend\node_modules'))) {
    Info 'Memasang paket frontend (sekali saja)...'
    if (-not (Tampil 'npm.cmd install')) { Gagal 'npm install gagal.' }
}

foreach ($l in $layanan) {
    if (Url-Hidup $l.Url) {
        Oke "$($l.Nama) sudah menyala di port $($l.Port), dipakai apa adanya"
        continue
    }
    if (Port-Dipakai $l.Port) {
        Gagal "Port $($l.Port) dipakai program lain. Tutup program itu atau jalankan matikan.cmd, lalu ulangi."
    }
    Buka-Jendela $l.Judul $l.Perintah
    Info "$($l.Nama): jendela baru dibuka"
}
foreach ($l in $layanan) {
    if (-not (Tunggu-Url $l.Url 120)) { Gagal "$($l.Nama) belum menjawab di $($l.Url). Lihat pesan di jendelanya." }
    Oke "$($l.Nama) siap: $($l.Url)"
}

# --------------------------------------------------------------------------
Langkah 'Keluaran ketiga mesin'
$keadaan = cmd /c "`"$Python`" tools\lokal\cek_keadaan.py 2>nul" | ConvertFrom-Json
$perlu = $JalankanMesin -or $produsenBaru -or ($null -eq $keadaan) -or ($keadaan.uji_balik -eq 0) -or
         ($keadaan.tanpa_perkiraan -gt 0) -or ($keadaan.saran -eq 0) -or ($keadaan.segmen -eq 0)
if ($perlu) {
    $mesin = @(
        @{ Nama = 'Mesin 1 (perkiraan, sekitar 3,5 menit)'; Url = 'http://localhost:8001/mesin1/jalankan'; Badan = '{}' },
        @{ Nama = 'Mesin 2 (saran distributor)'; Url = 'http://localhost:8001/mesin2/jalankan'; Badan = '{}' },
        @{ Nama = 'Mesin 3 (segmen pelanggan)'; Url = 'http://localhost:8001/mesin3/jalankan'; Badan = $null }
    )
    foreach ($m in $mesin) {
        Info "Menjalankan $($m.Nama)..."
        try {
            if ($m.Badan) {
                Invoke-RestMethod -Method Post -Uri $m.Url -ContentType 'application/json' -Body $m.Badan -TimeoutSec 900 | Out-Null
            } else {
                Invoke-RestMethod -Method Post -Uri $m.Url -TimeoutSec 900 | Out-Null
            }
            Oke "$($m.Nama) selesai"
        } catch {
            Write-Host "    $($m.Nama) gagal: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host '    Aplikasi tetap bisa dipakai; lihat pesan di jendela layanan model.' -ForegroundColor Yellow
        }
    }
} else {
    Oke 'Keluaran ketiga mesin sudah lengkap, tidak perlu dijalankan ulang'
}

# --------------------------------------------------------------------------
Write-Host ''
Write-Host 'Semua menyala.' -ForegroundColor Green
Write-Host ''
Write-Host '  Aplikasi           http://localhost:5173'
Write-Host '  Dokumentasi API    http://localhost:8000/docs'
Write-Host '  Layanan model      http://localhost:8001/docs'
Write-Host ''
Write-Host '  Masuk: halaman Masuk > tab Pakai Email > tekan salah satu tombol "Isikan akun simulasi".'
Write-Host '    umkm1@warungku.test        Kopi Kita Jogja'
Write-Host '    produksi1@warungku.test    Dapur Sambal Bu Ratmi (ada tab Produksi)'
Write-Host '    distributor1@warungku.test lewat "Masuk ke portal distributor"'
Write-Host ''
Write-Host '  Jangan tutup tiga jendela layanan selama aplikasi dipakai.'
Write-Host '  Untuk mematikan semuanya: klik dua kali matikan.cmd.'

if (-not $TanpaPeramban) { Start-Process 'http://localhost:5173/masuk' }
