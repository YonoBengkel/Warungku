# Revisi 25 Oktober V4 — cabang Rombak#4

Daftar kerja dari catatan revisi Ilham `referensi/Revisi 25 Oct V4.docx` (di luar git), yang diperjelas
lewat tanya-jawab Q83–Q98 pada 25 Oktober 2026. Isinya sepuluh bagian:
- **portal usaha:** Stok, Lacak Pesanan, dan tab Kontrak di Pesanan;
- **portal distributor:** Beranda, Sebaran pemesan, rincian Pesanan Masuk, Kontrak, Promo, Ringkasan
  Penjualan, dan Profil;
- **tambahan:** logo promo yang berbeda-beda.

Revisi sebelumnya ada di [REVISI-25-OKT-V3.md](REVISI-25-OKT-V3.md). Setiap tahap dikomit dan di-push sendiri
begitu lolos uji. Layar acuan tetap dua ukuran, 1536 × 834 dan 1536 × 730. Tanda: [x] selesai,
[~] sebagian, [ ] belum.

## Tahap 1 — portal usaha dan bagian bersama

- [x] **Huruf bagian atas Stok (Q83):** judul 28px di desktop, isi kolom cari dan Tambah Barang 17px.
- [x] **Hitung Barang di Lacak Pesanan (Q84)** sejajar dengan teks di atasnya, di desktop juga.
- [x] **Ringkasan Penjualan tanpa celah (Q84):** Terlaris setinggi dua baris bila ada rincian dan pelanggan
  teratas.
- [x] **Rincian pesanan mengisi layar (Q88)** di kedua portal.
- [x] **Tab Kontrak (Q85):** satu kotak per kelompok, tiga per baris.

Catatan tahap 1 (Edge headless, 1536 × 834):
- **Stok:** judul `lg:text-[1.75rem]`; kolom cari `text-subjudul` dengan ikon 20px; Tambah Barang
  `lg:text-subjudul` dengan ikon 18px di desktop (15px di HP, lewat `lg:size-[18px]`). Kotak angka tidak
  berubah.
- **Ringkasan Penjualan:** saat rincian dan pelanggan teratas sama-sama ada, kisinya
  `grid-rows-[auto_1fr]`. Rincian dan pelanggan teratas ditaruh di kolom kiri, Terlaris di kanan setinggi dua
  baris.
  - Baris kedua `1fr`, jadi kelebihan tinggi Terlaris jatuh ke sana, bukan menjarakkan kedua kotak di kiri
    (jarak keduanya kini 16px).
  - Ringkasan distributor memendek dari 1.673 ke 1.295px.
- **Rincian pesanan** (`PesananMasukDetail`, `PesananDetail`): halaman setinggi layar dikurangi jarak
  `<main>`, kolom memanjang. Kotak terakhir tiap kolom ikut memanjang sampai 32px di atas bilah bawah:
  - di Pesanan Masuk: Barang yang Dipesan, lalu Jejak Pesanan (atau Penilaian bila ada);
  - di portal usaha: Rincian Pesanan dan Pembayaran.

  Rincian Pesanan Masuk yang disiapkan kini tepat 834px.
- **Tab Kontrak:** tiap kelompok satu kotak (`section`), dengan tiga bagian:
  - **kepala:** logo atau gambar barang lewat `Avatar`, nama, jumlah kontrak, dan kewajiban per bulan;
  - **isi:** `BarisKontrak`, satu baris per kontrak yang membuka rinciannya. Judul baris adalah yang bukan
    nama kelompok (distributor di Per barang, barang di Per pemasok);
  - **kaki (Per pemasok):** Pesan sekaligus dan Lihat kerja sama.

  Kotak sebaris sama tinggi, kakinya rata bawah. Tingginya kini 936px (Per barang, dulu 1.839) dan 1.074px
  (Per pemasok, dulu 1.899). Tanpa geseran di 390px.

## Tahap 2 — kerangka dan akun distributor

- [x] **Profil keluar dari menu utama (Q93):** 5 tab, blok akun di kiri bawah, logo Turnify Flow di kiri atas,
  pita alat uji pindah ke halaman akun.
- [x] **Halaman akun bergaya UMKM (Q94)** dengan halaman bawahan Profil Toko, Barang yang Dijual, dan
  Penilaian & Ulasan.

Catatan tahap 2 (Edge headless, 1536 × 834 dan 390 × 844):
- **Kerangka:** menu utama tinggal Beranda, Pesanan, Kontrak, Promo, Pelanggan (juga di bilah bawah HP).
  - Kiri atas kini `TandaMerek` dengan "Turnify Flow · Portal Distributor".
  - Kiri bawah ada blok akun (logo toko, nama, "Lihat akun") yang menyala di semua halaman `/profil`.
  - Di HP, logo toko di bilah atas membuka akun. Pita kuning, di desktop maupun HP, dihapus.
- **Akun** (`/distributor-portal/profil`, `ProfilDistributor.tsx`): kartu kepala (logo, nama, Distributor ·
  kota · bintang, Terverifikasi, bergabung sejak), lalu dua kolom kelompok:
  - **Toko:** Profil Toko dan Barang yang Dijual;
  - **Tampilan:** Terang atau Gelap;
  - **Penilaian:** Penilaian & Ulasan.

  Di bawahnya kotak bergaris putus **Alat uji purwarupa**: akun distributor (Masuk atau Keluar) dan
  Kembali ke portal UMKM. `Kelompok`, `BarisMenu`, dan `TombolPilihan` dipindah dari `Akun.tsx` ke
  `components/ui/menuAkun.tsx` supaya dipakai kedua portal.
- **Halaman bawahan:** semuanya punya tombol kembali ke Akun.
  - `/profil/toko`: info usaha dengan deskripsi, yang dilayani, dan lokasi gudang.
  - `/profil/barang`: satu kotak per barang, tiga per baris, dengan Tambah di kepala halaman.
  - `/profil/ulasan`: penilaian di kiri, semua ulasan di kanan, bukan lagi lima terakhir.

  Formulirnya tidak berubah, hanya pindah ke `formProfil.tsx`.
- Ketiga halaman bawahan pas 834px. Akun 846px di desktop dan 1.345px di HP, tanpa geseran di 390px.

## Tahap 3 — Promo

- [ ] **Logo promo per kategori barang (Q92)**, berwarna menurut jenis promo.
- [ ] **Kotak promo utuh (Q90)** yang membuka halaman promo.
- [ ] **Halaman promo dan Buat Promo (Q91).**

## Tahap 4 — Beranda dan Sebaran distributor

- [ ] **Beranda (Q95):** isi tetap, kotak bergaya Beranda UMKM.
- [ ] **Sebaran (Q87, Q84):** peta Leaflet dan OpenStreetMap penuh sampai bawah; teks penjelas dihapus.

## Tahap 5 — data

- [ ] **Minta Berhenti (Q89):** dua pengajuan dari kedai simulasi, versi variasi dinaikkan, dan data contoh.
- [ ] **Image backend 0.11.0 (Q97).**

## Tahap 6 — akhir

- [ ] DESIGN.md, sapuan regresi, perbandingan sebelum–sesudah, lembar logo promo, dan pembersihan
  lingkungan uji.
