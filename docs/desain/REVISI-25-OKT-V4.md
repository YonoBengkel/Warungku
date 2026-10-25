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

- [x] **Logo promo per kategori barang (Q92)**, berwarna menurut jenis promo.
- [x] **Kotak promo utuh (Q90)** yang membuka halaman promo.
- [x] **Halaman promo dan Buat Promo (Q91).**

Catatan tahap 3 (Edge headless, 1536 × 834 dan 390 × 844, terang dan gelap):
- **Logo (Q92):** delapan glyph digambar dengan skill logo-design: Kopi, Teh & Matcha, Susu & Olahan, Pemanis,
  Kemasan, Bahan Makanan, Pendukung, Campuran.
  - Gambarnya: biji kopi, pucuk teh, kotak susu, permen, gelas bawa pulang, mangkuk nasi, tetes air berisi es,
    dan kisi empat siluet mini.
  - Geometrinya dihitung oleh `tools/buat_logo_promo.py`, yang menulis `frontend/src/data/glyphPromo.ts` dan
    master SVG di `docs/desain/logo-promo/`. Lembar ujinya `docs/desain/logo-promo/lembar-logo-promo.png`.
  - Lolos audit skill (100/100): satu warna, tanpa sudut nyaris-lurus. Masih terbaca di ubin 24px.
  - Rancangan pertama kubus gula diganti permen, karena kubus tiga muka terbaca sebagai ikon "paket".
- **Pemilihan logo** (`components/domain/logoPromo.tsx`):
  - kategori katalog dipetakan ke glyph; "Kopi & Teh" dipecah lewat nama barang, Protein ikut Bahan Makanan;
  - logo sebuah promo = kelompok barang terbanyak di dalamnya; seri atau belum ada barang memakai Campuran;
  - `LogoPromo` di `KartuPromo.tsx` menggambarnya putih di ubin warna jenis promo (redup bila promo berakhir).
    Dipakai di kartu Beranda UMKM, kepala halaman promo UMKM, dan kotak promo distributor. Lencana kecil di
    jalur beli tetap memakai ikon jenis.
- **Daftar promo (Q90):** satu kotak utuh per promo, tiga sebaris mulai 1280px. Isinya:
  - logo, jenis, judul;
  - potongan atau "Tanpa potongan", dan masa berlaku ("Sampai 30 Okt · 5 hari lagi");
  - barang ikut (tiga nama, sisanya "+N").

  Kotak "Sudah berakhir" bentuknya sama tapi redup. Tombol Ubah, Akhiri Sekarang, dan pop-up dihapus.
- **Halaman promo (Q91):** `/distributor-portal/promo/<id>` dan `/promo/baru` (`PromoUbah.tsx`), dengan
  formulir lama yang sama.
  - **Desktop:** dua kolom. Kiri jenis, isi kartu, dan masa berlaku; kanan pratinjau dan barang ikut.
    Tingkat keanggotaan selebar halaman, tiga sebaris.
  - **HP:** pratinjau paling atas.
  - **Tombol:** Pasang Promo, Simpan Promo, atau Pasang Lagi di bilah bawah. Akhiri Sekarang merah bergaris
    di dasar halaman, dengan konfirmasi.
  - **Tinggi halaman:** 1.404px untuk Cuci Gudang dan 1.791px untuk keanggotaan; dulu satu kolom 2.366px.
- **Uji alur:** di basis data uji, promo baru dipasang, logonya berganti ke permen saat Gula Pasir dicentang,
  lalu promonya diakhiri dan pindah ke "Sudah berakhir".

## Tahap 4 — Beranda dan Sebaran distributor

- [x] **Beranda (Q95):** isi tetap, kotak bergaya Beranda UMKM.
- [x] **Sebaran (Q87, Q84):** peta Leaflet dan OpenStreetMap penuh sampai bawah; teks penjelas dihapus.

Catatan tahap 4 (Edge headless, 1536 × 834 dan 390 × 844, terang dan gelap):
- **Beranda distributor** (`Dashboard.tsx`): isinya tetap, kotaknya meniru Beranda UMKM.
  - **Yang perlu kamu urus hari ini:** kartu "N pesanan menunggu kamu jawab" ada di dalam kotak ini, selebar
    kartu tugas UMKM (setengah baris, lalu sepertiga mulai 1280px). Bila tidak ada yang menunggu, muncul
    baris hijau "Semua aman hari ini.".
  - **Rekap pesanan:** lima petak bergaya Perlu Tindakan (ikon berlingkaran dan angka di tengah, nama di
    bawah), sebaris mulai 1024px. Di HP dua kolom, dan petak Ditolak selebar dua kolom (358px).
  - **Sebaran pemesan:** tiga petak bergaya sama dengan cincin seperti di peta, dan "Buka peta ›" di kanan
    judul.
  - **Pesanan terbaru:** kartu bergaya kartu pesanan UMKM, dua sebaris mulai 1024px dan tiga mulai 1280px;
    kartu sebaris sama tinggi. Isinya:
    - logo dan nama pemesan, serta status;
    - barang ringkas ("Biji Kopi Arabika 3 kg + 1 barang lain");
    - total, waktu masuk, dan nomor pesanan.
- **Peta Sebaran** (`components/domain/PetaSebaran.tsx`): Leaflet dan OpenStreetMap dengan `buatPeta` yang
  sama dengan peta rincian pesanan.
  - Penanda tetap cincin bernomor: merah utuh, jingga putus-putus, biru ganda, dirender React lewat portal.
    Bentuk cincinnya pindah ke `TandaTitik.tsx`, supaya Beranda tidak ikut memuat Leaflet.
  - Mengetuk titik (atau Enter) memilih tokonya di daftar kanan; titik terpilih bercincin gelap, dan peta
    bergeser bila titik yang dipilih dari daftar ada di luar pandangan.
  - Di desktop peta memanjang sampai 32px di atas dasar layar (bawahnya 777px di layar 834px). Kalimat di
    bawahnya kini "Angka di titik adalah jumlah pesanan toko itu.".
  - Kotak koordinat `BATAS_PETA` dan pemadatan titik lama dihapus.
- **Hitungan titik (Q84):** judul di tengah tanpa keterangan, kalimat penjelas tiap kotak dan kalimat "Satu
  toko bisa masuk beberapa kartu…" dihapus (`KETERANGAN_TITIK` ikut hilang). "Seberapa tepat letaknya?"
  dihapus.
- **Perbaikan sampingan:** pilihan barang di Sebaran kini membaca katalog portal yang tersambung. Dulu ia
  membaca katalog contoh, sehingga peta per barang selalu kosong saat portal tersambung ke server.

## Tahap 5 — data

- [x] **Minta Berhenti (Q89):** dua pengajuan dari kedai simulasi, versi variasi dinaikkan, dan data contoh.
- [x] **Image backend 0.11.0 (Q97).**

Catatan tahap 5:
- **Variasi demo** (`data/dataset/variasi_demo.py`): dua kontrak baru dengan Sumber Tani Nusantara yang
  sedang berjalan, berstatus aktif dengan pengajuan berhenti yang belum dijawab, seperti tombol Minta
  Berhenti di portal usaha:
  - Kedai Kopi Sudut Bantul, Gula Aren Cair, Kontrak C, diajukan kemarin: "Menu kopi susu gula aren
    dihentikan sementara selama dapur direnovasi.";
  - Kafe Beranda Kotabaru, Matcha Bubuk, Kontrak C, diajukan 3 hari lalu: "Pindah ke pemasok yang lebih
    dekat, ongkos kirimnya lebih ringan.".

  Kontrak Kopi Kita tidak berubah. Kontrak lama tidak diubah statusnya, jadi contoh Aktif, Rutin, dan Akan
  berakhir tetap ada; kontrak kedai jadi 10.
- **Versi variasi:** `basi()` kini juga benar bila kontrak kedai dengan distributor demo lebih sedikit dari
  daftarnya.
  - Akibatnya `nyalakan.cmd` dan `siapkan.cmd` langsung memasang ulang di basis data lama, dan putaran
    berikutnya "masih segar".
  - Hitungannya dari jumlah kontrak, bukan dari pengajuannya: pengajuan hilang begitu dijawab lewat portal,
    dan menjawabnya saat demo tidak boleh memicu pasang ulang.
- **Data contoh frontend:** sudah punya satu pengajuan berhenti sejak revisi 23 Oktober (`kp-07`, "Usaha sedang
  sepi…"), jadi tidak diubah.
- **Image `yonobengkel/turnify-flow-backend:0.11.0`:** dibangun dari `Rombak#4` dan di-push ke Docker Hub
  (digest `sha256:14f7f0bf…`). `deployment/docker-compose.yml`, contoh perintah di Dockerfile, dan README
  kini menunjuk ke sana. Versi paketnya sama persis dengan 0.10.0 (FastAPI 0.161.1, pandas 3.1.0,
  LightGBM 4.7.0).
- **Uji image** di basis data `0.2.0` yang masih baru, lewat jaringan Docker sendiri:
  - API bermigrasi sendiri `a650ed7218eb → 5e0c7a3d9b21`, dan API serta layanan model sehat;
  - langkah data `siapkan.cmd` di dalam kontainer: 968 deskripsi dirapikan, variasi ketiga akun (distributor:
    11 pesanan, 10 kontrak, 9 promo), dan putaran kedua "masih segar";
  - frontend uji ke API image: Beranda, Kontrak (tab Minta Berhenti 2), Promo, Sebaran, Beranda UMKM, dan
    Distributor tanpa galat konsol, tanpa respons 4xx atau 5xx di log.

## Tahap 6 — akhir

- [ ] DESIGN.md, sapuan regresi, perbandingan sebelum–sesudah, lembar logo promo, dan pembersihan
  lingkungan uji.
