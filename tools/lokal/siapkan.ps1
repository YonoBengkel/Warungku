<#
Siapkan dan nyalakan Turnify Flow lewat Docker (jalur A), dari nol.

Untuk yang hanya ingin mencoba aplikasinya: tidak perlu Python, dan tidak
perlu mengerti Docker. Cara pakai: klik dua kali siapkan.cmd. Berkas itu boleh
diunduh sendirian, sebelum punya repo; repo lalu di-clone ke folder
turnify-flow di sebelahnya.

Yang dikerjakan, berurutan:
  1. Git, Docker Desktop, dan Node.js diperiksa. Yang belum ada ditawarkan
     untuk dipasang lewat winget (selalu ditanya dulu).
  2. Repo di-clone (branch Rombak#3), atau diperbarui bila sudah ada dan
     tidak ada perubahan yang belum dikomit.
  3. Docker Desktop dinyalakan, image basis data dan backend diunduh dari
     Docker Hub, lalu kontainer basis data (5433), API (8000), dan layanan
     model (8001) dinyalakan. Pertama kali, basis data memulihkan data
     simulasi sekitar satu menit.
  4. deployment\.env disiapkan dengan WARUNGKU_RAHASIA acak, supaya login
     tidak hangus setiap kontainer dinyalakan ulang.
  5. Paket frontend dipasang bila belum ada, lalu frontend (5173) dinyalakan
     di jendela kecil yang diperkecil ke taskbar.
  6. Peramban dibuka di halaman Masuk.

Menjalankannya lagi aman: yang sudah ada dipakai apa adanya, jadi berkas yang
sama juga dipakai untuk menyalakan aplikasi di hari berikutnya.
Matikan semuanya dengan matikan.cmd. Data di basis data tetap tersimpan.

Pilihan:
  -Folder <jalur>   tempat clone bila skrip dijalankan di luar repo
                    (bawaan: folder turnify-flow di folder saat ini)
  -TanpaPeramban    jangan buka peramban di akhir
  -LewatiGit        jangan clone atau memperbarui repo
#>
param(
    [string]$Folder = '',
    [switch]$TanpaPeramban,
    [switch]$LewatiGit
)

# Sengaja bukan 'Stop': di Windows PowerShell 5.1, keluaran stderr program luar
# (docker, git, npm) dianggap galat walau programnya berhasil. Hasil setiap
# perintah diperiksa lewat $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoUrl = 'https://github.com/YonoBengkel/Warungku.git'
$Cabang = 'Rombak#3'
$BerkasPid = Join-Path $env:TEMP 'turnify-lokal-pid.txt'
$Compose = 'docker compose -f deployment/docker-compose.yml --profile layanan'

function Langkah([string]$teks) { Write-Host ''; Write-Host "==> $teks" -ForegroundColor Cyan }
function Oke([string]$teks) { Write-Host "    $teks" -ForegroundColor Green }
function Info([string]$teks) { Write-Host "    $teks" }
function Awas([string]$teks) { Write-Host "    $teks" -ForegroundColor Yellow }
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

function Tanya([string]$pertanyaan) {
    $jawab = Read-Host "    $pertanyaan (y/n)"
    return ($jawab -match '^(y|ya|yes)$')
}

function Url-Hidup([string]$url) {
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Tunggu-Url([string]$url, [int]$detik) {
    $batas = (Get-Date).AddSeconds($detik)
    while ((Get-Date) -lt $batas) {
        if (Url-Hidup $url) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Port-Dipakai([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# Program yang baru dipasang winget belum ada di PATH jendela ini.
function Segarkan-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Pasang-Lewat-Winget([string]$nama, [string]$id) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Gagal "$nama belum terpasang dan winget tidak tersedia. Pasang $nama sendiri, lalu jalankan siapkan.cmd lagi."
    }
    if (-not (Tanya "$nama belum terpasang. Pasang sekarang lewat winget? Ketentuan paketnya akan disetujui atas namamu")) {
        Gagal "$nama dibutuhkan. Pasang sendiri, lalu jalankan siapkan.cmd lagi."
    }
    Info "Memasang $nama (beberapa menit, mungkin muncul jendela izin Windows)..."
    & winget install -e --id $id --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { Gagal "Pemasangan $nama lewat winget gagal. Pasang sendiri, lalu jalankan siapkan.cmd lagi." }
    Segarkan-Path
}

function Status-Kontainer([string]$nama) {
    return (cmd /c "docker inspect --format `"{{.State.Status}}`" $nama 2>nul")
}

function Tunggu-Basis-Data {
    Info 'Menunggu basis data siap (pertama kali sekitar satu menit untuk memulihkan data)...'
    $batas = (Get-Date).AddMinutes(6)
    while ($true) {
        $status = cmd /c 'docker inspect --format "{{.State.Health.Status}}" warungku-db 2>nul'
        if ($status -eq 'healthy') { return }
        if ((Get-Date) -gt $batas) { Gagal "Basis data belum siap sesudah enam menit (status: $status). Lihat: docker logs warungku-db" }
        Start-Sleep -Seconds 3
    }
}

Write-Host 'Turnify Flow: menyiapkan dan menyalakan lewat Docker' -ForegroundColor White

# --------------------------------------------------------------------------
Langkah 'Memeriksa program yang dibutuhkan'
$DockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Pasang-Lewat-Winget 'Git' 'Git.Git' }
Oke 'Git ada'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Pasang-Lewat-Winget 'Node.js' 'OpenJS.NodeJS.LTS' }
Oke 'Node.js ada'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and -not (Test-Path $DockerExe)) {
    Pasang-Lewat-Winget 'Docker Desktop' 'Docker.DockerDesktop'
    Write-Host ''
    Write-Host 'Docker Desktop baru dipasang. Nyalakan ulang komputer, buka Docker Desktop sekali' -ForegroundColor Yellow
    Write-Host 'dan selesaikan layar sambutannya, lalu klik dua kali siapkan.cmd lagi.' -ForegroundColor Yellow
    exit 0
}
$DockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $DockerBin)) { $env:Path += ";$DockerBin" }
Oke 'Docker Desktop ada'

# --------------------------------------------------------------------------
# Di dalam repo: skrip ini ada di tools\lokal. Di luar repo (siapkan.cmd yang
# diunduh sendirian): clone dulu, lalu serahkan ke salinan di dalam repo supaya
# yang berjalan selalu versi terbaru dari branch.
$AkarCalon = Join-Path $PSScriptRoot '..\..'
$DalamRepo = Test-Path (Join-Path $AkarCalon 'deployment\docker-compose.yml')
if ($DalamRepo) {
    $Akar = (Resolve-Path $AkarCalon).Path
} else {
    if (-not $Folder) { $Folder = Join-Path (Get-Location).Path 'turnify-flow' }
    $Akar = [IO.Path]::GetFullPath($Folder)
}

if (-not $LewatiGit) {
    Langkah 'Mengambil kode dari GitHub'
    if (Test-Path (Join-Path $Akar '.git')) {
        Set-Location -LiteralPath $Akar
        $berubah = cmd /c 'git status --porcelain --untracked-files=no 2>nul'
        if ($berubah) {
            Awas 'Ada perubahan yang belum dikomit, jadi kode tidak diperbarui. Kode yang ada dipakai apa adanya.'
        } else {
            if (-not (Diam 'git fetch origin')) {
                Awas 'Tidak bisa menghubungi GitHub. Kode yang ada dipakai apa adanya.'
            } else {
                $sekarang = cmd /c 'git branch --show-current 2>nul'
                if ($sekarang -ne $Cabang) {
                    if (-not (Tampil "git switch `"$Cabang`"")) { Gagal "Tidak bisa pindah ke branch $Cabang." }
                }
                if (-not (Tampil 'git pull --ff-only')) {
                    Awas 'Kode tidak bisa diperbarui otomatis. Kode yang ada dipakai apa adanya.'
                }
            }
        }
        Oke "Kode siap di $Akar"
    } elseif ((Test-Path $Akar) -and (Get-ChildItem -LiteralPath $Akar -Force | Select-Object -First 1)) {
        Gagal "Folder $Akar sudah berisi berkas lain. Pindahkan siapkan.cmd ke folder kosong, lalu ulangi."
    } else {
        Info "Clone ke $Akar ..."
        & git clone --branch $Cabang $RepoUrl $Akar
        if ($LASTEXITCODE -ne 0) { Gagal 'Clone dari GitHub gagal. Periksa koneksi internet, lalu ulangi.' }
        Oke "Kode siap di $Akar"
    }

    $SalinanRepo = Join-Path $Akar 'tools\lokal\siapkan.ps1'
    if (-not $DalamRepo -and (Test-Path $SalinanRepo)) {
        $argumen = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $SalinanRepo, '-LewatiGit')
        if ($TanpaPeramban) { $argumen += '-TanpaPeramban' }
        & powershell @argumen
        exit $LASTEXITCODE
    }
}
if (-not (Test-Path (Join-Path $Akar 'deployment\docker-compose.yml'))) {
    Gagal "Repo tidak ditemukan di $Akar."
}
Set-Location -LiteralPath $Akar

# --------------------------------------------------------------------------
Langkah 'Docker Desktop'
if (-not (Diam 'docker info')) {
    if (-not (Test-Path $DockerExe)) { Gagal 'Docker Desktop tidak ditemukan di Program Files.' }
    Info 'Menyalakan Docker Desktop (bisa sampai beberapa menit)...'
    Info 'Kalau Docker Desktop baru dipasang, selesaikan dulu layar sambutannya; skrip ini menunggu.'
    Start-Process $DockerExe
    $batas = (Get-Date).AddMinutes(6)
    while (-not (Diam 'docker info')) {
        if ((Get-Date) -gt $batas) { Gagal 'Docker Desktop belum siap sesudah enam menit. Buka Docker Desktop, tunggu sampai menyala, lalu ulangi.' }
        Start-Sleep -Seconds 3
    }
}
Oke 'Docker siap'

# Port yang dipakai program lain membuat kontainer gagal menyala. Kontainer
# Turnify sendiri boleh sudah menyala.
$portKontainer = @(@{ Port = 5433; Nama = 'warungku-db' }, @{ Port = 8000; Nama = 'turnify-api' }, @{ Port = 8001; Nama = 'turnify-ml' })
foreach ($p in $portKontainer) {
    if ((Status-Kontainer $p.Nama) -ne 'running' -and (Port-Dipakai $p.Port)) {
        Gagal "Port $($p.Port) dipakai program lain (mungkin layanan dari nyalakan.cmd). Jalankan matikan.cmd, lalu ulangi."
    }
}

# --------------------------------------------------------------------------
Langkah 'Rahasia login'
$Env = Join-Path $Akar 'deployment\.env'
$isiEnv = ''
if (Test-Path $Env) { $isiEnv = Get-Content -LiteralPath $Env -Raw }
if ($isiEnv -notmatch '(?m)^WARUNGKU_RAHASIA=\S') {
    $acak = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($acak)
    $rahasia = [Convert]::ToBase64String($acak) -replace '[+/=]', 'x'
    $awal = ''
    if ($isiEnv -and -not $isiEnv.EndsWith("`n")) { $awal = "`r`n" }
    Add-Content -LiteralPath $Env -Value ($awal + "WARUNGKU_RAHASIA=$rahasia") -Encoding ASCII
    Info 'WARUNGKU_RAHASIA acak ditulis ke deployment\.env (berkas ini tidak dilacak git)'
}
Oke 'deployment\.env siap'

# --------------------------------------------------------------------------
Langkah 'Image dari Docker Hub'
$image = @(cmd /c "$Compose config --images 2>nul" | Where-Object { $_ } | Sort-Object -Unique)
$kurang = @($image | Where-Object { -not (Diam "docker image inspect $_") })
if ($image.Count -eq 0) { Gagal 'Berkas deployment\docker-compose.yml tidak bisa dibaca.' }
if ($kurang.Count -gt 0) {
    Info "Mengunduh: $($kurang -join ', ')"
    Info 'Pertama kali sekitar 400 MB, tergantung koneksi.'
    & docker compose -f deployment/docker-compose.yml --profile layanan pull
    if ($LASTEXITCODE -ne 0) { Gagal 'Image tidak bisa diunduh. Periksa koneksi internet, lalu ulangi.' }
}
foreach ($i in $image) { Oke "Ada: $i" }

# --------------------------------------------------------------------------
Langkah 'Kontainer basis data, API, dan layanan model'
$volumeLama = Diam 'docker volume inspect backend_warungku_data'
if (-not (Tampil "$Compose up -d db")) { Gagal 'Basis data tidak bisa dinyalakan. Lihat pesan docker di atas.' }
Tunggu-Basis-Data

# Data hanya dipulihkan dari image ke volume yang masih kosong. Volume dari
# versi sebelum 16 Okt 2026 belum punya tabel produksi; backend sekarang
# membutuhkannya.
$adaProduksi = cmd /c 'docker exec warungku-db psql -U warungku -d warungku_dev -tAc "SELECT to_regclass(''public.produksi'') IS NOT NULL" 2>nul'
if ($volumeLama -and ($adaProduksi -ne 't')) {
    Awas 'Basis data di komputer ini berasal dari versi lama (sebelum 16 Oktober 2026).'
    Awas 'Sebagian fitur (UMKM produsen, tab Produksi) tidak akan jalan dengan data ini.'
    if (Tanya 'Ganti dengan data terbaru dari image? Data lama di basis data akan HILANG') {
        if (-not (Tampil "$Compose down -v")) { Gagal 'Data lama tidak bisa dihapus. Lihat pesan docker di atas.' }
        if (-not (Tampil "$Compose up -d db")) { Gagal 'Basis data tidak bisa dinyalakan.' }
        Tunggu-Basis-Data
        Oke 'Data terbaru dipulihkan dari image'
    } else {
        Awas 'Data lama dipertahankan.'
    }
}
Oke 'Basis data siap di port 5433'

if (-not (Tampil "$Compose up -d")) { Gagal 'API dan layanan model tidak bisa dinyalakan. Lihat pesan docker di atas.' }
foreach ($l in @(@{ Nama = 'API'; Url = 'http://localhost:8000/sehat' }, @{ Nama = 'Layanan model'; Url = 'http://localhost:8001/sehat' })) {
    if (-not (Tunggu-Url $l.Url 180)) { Gagal "$($l.Nama) belum menjawab di $($l.Url). Lihat: docker compose -f deployment/docker-compose.yml logs" }
    Oke "$($l.Nama) siap: $($l.Url)"
}

# --------------------------------------------------------------------------
Langkah 'Frontend'
if (-not (Test-Path (Join-Path $Akar 'frontend\node_modules'))) {
    Info 'Memasang paket frontend (sekali saja, beberapa menit)...'
    if (-not (Tampil 'npm.cmd install')) { Gagal 'npm install gagal. Lihat pesan di atas.' }
}
if (Url-Hidup 'http://localhost:5173') {
    Oke 'Frontend sudah menyala di port 5173, dipakai apa adanya'
} else {
    if (Port-Dipakai 5173) { Gagal 'Port 5173 dipakai program lain. Jalankan matikan.cmd, lalu ulangi.' }
    # Jendela kecil yang langsung diperkecil ke taskbar. Judul dan nomornya
    # sama dengan yang dikenali matikan.ps1. Perintah dikirim sebagai
    # -EncodedCommand supaya jalur berspasi tidak terpotong.
    $isi = "`$host.UI.RawUI.WindowTitle = 'Turnify frontend (5173)'; Set-Location -LiteralPath '$Akar'; npm.cmd run dev"
    $kode = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($isi))
    $proses = Start-Process powershell -PassThru -WindowStyle Minimized -ArgumentList "-NoExit -NoProfile -ExecutionPolicy Bypass -EncodedCommand $kode"
    Add-Content -LiteralPath $BerkasPid -Value $proses.Id
    if (-not (Tunggu-Url 'http://localhost:5173' 120)) { Gagal 'Frontend belum menjawab di port 5173. Buka jendela "Turnify frontend" di taskbar untuk melihat pesannya.' }
}
Oke 'Frontend siap: http://localhost:5173'

# --------------------------------------------------------------------------
Write-Host ''
Write-Host 'Semua menyala.' -ForegroundColor Green
Write-Host ''
Write-Host '  Aplikasi           http://localhost:5173'
Write-Host '  Dokumentasi API    http://localhost:8000/docs'
Write-Host '  Layanan model      http://localhost:8001/docs'
Write-Host "  Folder repo        $Akar"
Write-Host ''
Write-Host '  Masuk: halaman Masuk > tab Pakai Email > tekan salah satu tombol "Isikan akun simulasi".'
Write-Host '    umkm1@warungku.test        Kopi Kita Jogja'
Write-Host '    produksi1@warungku.test    Dapur Sambal Bu Ratmi (ada tab Produksi)'
Write-Host '    distributor1@warungku.test lewat "Masuk ke portal distributor"'
Write-Host ''
Write-Host '  Saat pertama menyala, layanan model mengisi data grafik bulanan di latar'
Write-Host '  belakang (sekitar 4 menit). Aplikasi sudah bisa dipakai selama itu.'
Write-Host ''
Write-Host '  Basis data, API, dan layanan model berjalan di Docker; frontend di jendela'
Write-Host '  "Turnify frontend" yang diperkecil di taskbar. Jangan tutup jendela itu.'
Write-Host '  Untuk mematikan semuanya: klik dua kali matikan.cmd di folder repo.'
Write-Host '  Untuk menyalakan lagi besok: klik dua kali siapkan.cmd di folder repo.'

if (-not $TanpaPeramban) { Start-Process 'http://localhost:5173/masuk' }
