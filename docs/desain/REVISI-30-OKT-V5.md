# Revisi 30 Oktober V5, cabang Rombak#4

Daftar kerja dari catatan revisi Ilham `referensi/Revisi 30 Oct V5.pdf` (di luar git) beserta lampirannya
di `referensi/Revisi 30 Oct V5/`, yang diperjelas lewat tanya-jawab Q99 sampai Q120 pada 30 Oktober 2026.
Isinya lima butir:
- **notifikasi:** panel ala Tokopedia dan letak loncengnya;
- **halaman Stok:** tata letak desktop rincian barang;
- **Akun:** kotak Alat uji purwarupa tanpa Tampilan perkiraan;
- **Beranda:** Ringkasan Penjualan, kepala Selamat datang, kartu promo, Perlu Tindakan, serta "Yang perlu
  kamu urus hari ini" dan "Pesanan berjalan";
- **menu samping:** rancangan teman Ilham (`SIdebar.html`).

Revisi sebelumnya ada di [REVISI-25-OKT-V4.md](REVISI-25-OKT-V4.md). Tahapnya sidebar, notifikasi, Beranda,
rincian barang, lalu Akun (Q113). Tiap tahap dicek di 1536 × 834 dan 390 × 844, tema terang dan gelap, lewat
Edge headless di lingkungan uji terpisah (salinan `turnify-flow-db:0.3.0` di port 5435, API 8010, Vite 5180).
Komit hanya saat Ilham meminta. Tanda: [x] selesai, [~] sebagian, [ ] belum.

## Keputusan

| No | Keputusan |
|---|---|
| Q99 | Lonceng tetap di kanan atas, sejajar baris judul, dan membuka panel ala Tokopedia. Tanpa headbar. |
| Q100 | Panel sekitar 400 px: judul "Pemberitahuan" dan "Tandai semua dibaca", tab "Perlu tindakan" (angkanya sama dengan lonceng) dan "Semua", paling banyak enam butir dengan tombolnya, "Lihat semua" ke halaman pemberitahuan, gambar kosong, tertutup oleh ketukan di luar atau Esc. |
| Q101 | Di HP lonceng tetap membuka halaman penuh. Portal distributor memakai panel yang sama. |
| Q102 | Rincian barang di desktop: baris atas tiga kartu sama tinggi (sisa tercatat dan tombolnya, "Stok tidak cukup" dengan perkiraan 3 hari, Saran distributor), baris bawah Tren pemakaian dua pertiga dan Riwayat pergerakan sepertiga. Tab Ringkasan/Riwayat hanya di HP. |
| Q103 | Tampilan perkiraan dihapus beserta kodenya. Kotak Alat uji purwarupa satu baris tiga kolom dengan tombol sejajar. |
| Q104 | Ringkasan Penjualan dan kepala Beranda di kedua portal. "Urus hari ini" di UMKM persis referensi, di distributor berdampingan dengan donat Rekap pesanan. Promo dan Perlu Tindakan hanya UMKM. |
| Q105 | Ringkasan Penjualan dibuat mockup dulu (`referensi/Revisi 30 Oct V5/Mockup Ringkasan Penjualan.html`, disetujui Ilham). Ikonnya dari Flaticon, gaya Mihimihi Flat yang sama dengan ikon Perlu Tindakan. |
| Q106 | Kepala Beranda mengikuti `Selamat Datang.jpeg`. Distributor tanpa baris data kasir. Di HP ditumpuk. |
| Q107 | Foto per jenis promo menggantikan logo per kategori V4. "Lihat semua" membuka halaman semua promo. Karusel tetap berputar dengan titik dan panah kecil. Pratinjau dan daftar promo distributor memakai kartu baru. |
| Q108 | Ikon Perlu Tindakan dari referensi dipakai apa adanya (proyek belum komersial). |
| Q109 | "Urus hari ini" berupa daftar tiga butir paling mendesak, "Lihat semua" membuka seluruhnya di kartu. "Pesanan berjalan" memakai donat status kita dan dua pesanan terpenting. |
| Q110 | Susunan Beranda UMKM desktop: kepala, promo, Perlu Tindakan, urus hari ini dan Pesanan berjalan berdampingan, Ringkasan Penjualan, Prediksi Stok, Kuota Kontrak. Halaman boleh digulir. |
| Q111 | Menu samping teman Ilham di kedua portal: pil aktif yang bergeser halus (mati bila gerak dikurangi), hover lembut, lengkung cekung presisi, sambungan mengikuti latar halaman. Bilah bawah HP tetap. |
| Q112 | Satu ungu: referensi disesuaikan ke keluarga #4A148C, termasuk gradien menu samping. |
| Q113 | Cara kerja: lihat paragraf pembuka. |
| Q114 | Foto promo Unsplash: Cuci Gudang `BNBA1h-NgdY`, Promo Keanggotaan `0gICDd3mAp4`, Produk Baru `t14ZhuQQuxE`. |
| Q115 | Pil menu aktif coral yang digelapkan, teks putih paling sedikit 4,5:1. |
| Q116 | Halaman baru `/promo`: kisi tiga kolom (satu di HP), urut dari yang paling cepat berakhir, chip jenis promo, kartu ke rincian promo. |
| Q117 | Spanduk rincian promo memakai foto jenisnya. `logoPromo.tsx` dihapus, `docs/desain/logo-promo` tetap. |
| Q118 | Donat Rekap pesanan distributor hanya untuk pesanan berjalan. Selesai dan Ditolak angka kecil yang bisa diketuk. |
| Q119 | Beranda distributor desktop: kepala, urus hari ini dan donat berdampingan, Ringkasan Penjualan, Sebaran pemesan, Pesanan terbaru. |
| Q120 | Status dibaca pemberitahuan disimpan di peramban per akun untuk kedua portal. "Tandai semua dibaca" hanya menghapus tanda belum dibaca. Angka lonceng tetap menghitung butir yang perlu tindakan. |

## Tahap 1, menu samping

- [x] **Menu samping bersama (Q111, Q112, Q115):** `components/ui/MenuSamping.tsx`, dipakai `KerangkaAplikasi`
  dan `KerangkaDistributor`. `TautanSamping` dihapus karena tidak dipakai lagi.

Catatan tahap 1:
- **Token baru** di `index.css`, dengan pasangan tema gelap:
  - gradien `--c-samping-atas` #6431B0 ke `--c-samping-bawah` #4A148C, dan `--c-samping-cahaya` coral di kiri bawah;
  - teks `--c-samping-ink` putih (8,05:1 sampai 11,86:1, di sorotan hover 5,78:1);
  - pil `--c-pil-1` #BF3F0B ke `--c-pil-2` #C9470F (teks putih 5,34:1 sampai 4,78:1);
  - kartu akun kaca (nama 10,3:1, "Lihat akun" 5,6:1).

  Tema gelap: gradien #2D1258 ke #1D0B3A, teks #F3EEFC (13,78:1 sampai 15,89:1).
- **Penanda aktif** (`.penanda-samping`): satu tab berwarna `--c-bg` yang diukur dari menu aktif lewat
  `getBoundingClientRect` dan `ResizeObserver`, lalu bergeser dengan `transform` 320 ms. Posisi pertama dipasang
  tanpa gerak. Lengkung cekungnya dua pseudo-element `radial-gradient` 28 px di atas dan bawah, persis
  referensi. Gerak dikurangi mematikannya lewat aturan `prefers-reduced-motion` yang sudah ada.
- **Ukuran:** lebar tetap `--rail-w` 16,5rem (referensi 280 px), supaya `BilahAksi` dan lonceng tidak bergeser.
  Butir menu setinggi 44 px (referensi sekitar 42 px), sesuai target sentuh.
- **Angka di menu:** Pesanan distributor merah (`bg-kritis`), Keranjang putih bertinta ungu, karena ungu penuh
  tidak terlihat di atas menu ungu. Jumlahnya dibacakan lewat `aria-label` tautannya.
- **Nama toko** di kartu akun boleh dua baris ("Sumber Tani Nusantara").
- **Fokus keyboard** di menu memakai garis putih 3 px, karena garis ungu merek tidak terlihat di atas ungu.

## Tahap 2, pemberitahuan

- [x] **Panel lonceng (Q99, Q100, Q101):** `LoncengMelayang` di `components/domain/Pemberitahuan.tsx` kini tombol
  yang membuka panel, dipakai kedua kerangka. Di HP lonceng bilah atas tetap tautan ke halaman penuh.
- [x] **Status dibaca tersimpan (Q120):** `lib/dibaca.ts`, kunci `turnify-dibaca-usaha-<id>` dan
  `turnify-dibaca-distributor-<id>` di `localStorage`. "Tandai semua dibaca" ada di panel dan di kedua halaman
  pemberitahuan.

Catatan tahap 2:
- **Isi panel:** judul, "Tandai semua dibaca" (hanya bila ada yang belum dibaca), tab "Perlu tindakan" dan "Semua"
  dengan angkanya, paling banyak enam butir, kaki "6 dari N ditampilkan" dan "Lihat semua". Tab awal "Perlu
  tindakan" bila ada isinya. Kosong: ikon lonceng di lingkaran ungu lembut dan satu kalimat.
- **Lebar dan tinggi:** `min(25rem, 100vw - rail - 3rem)`, tinggi paling banyak layar dikurangi 5,5rem dan daftar
  menggulir di dalamnya. Dicek juga di 1536 × 730.
- **Angka lonceng UMKM** kini dihitung dari daftar panel (`usePemberitahuanUsaha`): butir `butuhTindakan` yang
  barangnya belum dipesan. Dulu `useJumlahPerluTindakan` di store menghitung `butuhTindakan && !dibaca`, jadi
  membaca menurunkan angka; hook itu dihapus. Barang yang sudah dipesan tidak dihitung lagi, sama dengan baris
  pasif di halaman Pemberitahuan (di mode data contoh sebelumnya masih terhitung sampai barangnya diterima).
- **Chip "Perlu tindakan"** di halaman Pemberitahuan UMKM tetap ada sesudah dibaca, sama dengan angka lonceng.
- **Status dibaca UMKM** disimpan per id `srv-...` beserta tanda isinya (`tingkat|judul`) dan waktunya. Butir yang
  memburuk (menipis lalu habis) muncul lagi sebagai belum dibaca. Di mode data contoh status dibaca hanya di memori.
- **Status dibaca distributor** disimpan per kunci butir beserta tandanya (`judul|detail`), lewat satu salinan di
  modul yang dipakai bersama panel dan halaman (`useSyncExternalStore`). Yang disimpan hanya butir yang masih ada.
- **Label aksi distributor** (tambahan, menyamakan dengan UMKM): Jawab Pesanan, Lihat Pesanan, Tinjau Pengajuan,
  Tinjau Permintaan, Lihat Kontrak, Lihat Promo. Di halaman penuh panah kanan diganti label itu.
- **Bukti:** Edge headless di 1536 × 834 terang dan gelap, kedua portal, dan 390 × 844. Angka lonceng tetap 3
  sesudah "Tandai semua dibaca", titik biru hilang, dan sesudah muat ulang tetap terbaca. Esc menutup panel dan
  mengembalikan fokus ke lonceng, ketukan di luar menutup panel. Membuka satu butir distributor menyimpan satu tanda
  dan sisa belum dibaca turun dari 6 ke 5.

## Tahap 3, Beranda

- [x] **Kepala sapaan (Q106):** `components/domain/KepalaSambutan.tsx`, kedua portal. UMKM membawa pita data kasir
  di bawah nama. Huruf miring 800 dimuat dari Google Fonts (`ital,wght@...;1,800`).
- [x] **Kartu promo berfoto (Q107, Q114, Q117):** `KartuPromo` ditulis ulang dengan `FotoPromo` dan
  `LencanaJenisPromo`. Dipakai Beranda, halaman baru `/promo` (`pages/promo/SemuaPromo.tsx`, Q116), daftar promo
  distributor, pratinjau di halaman ubah promo, dan spanduk rincian promo. `logoPromo.tsx` dan
  `data/glyphPromo.ts` dihapus; `docs/desain/logo-promo/` dan `tools/buat_logo_promo.py` tetap sebagai arsip.
- [x] **Perlu Tindakan (Q108):** `PerluTindakan` dengan empat ikon dari rancangan di `public/gambar/tindakan/`
  (dua PNG dikecilkan ke 104 px, dua SVG disalin apa adanya).
- [x] **Urus hari ini dan Pesanan berjalan (Q109, Q110):** `KartuUrusan`, `BarisUrusan`, dan `DonatStatus` di
  `components/domain/KartuBeranda.tsx`. `KartuTindakan` lama dihapus karena tidak dipakai lagi.
- [x] **Beranda distributor (Q104, Q118, Q119):** kepala, urus hari ini berdampingan dengan donat Rekap pesanan
  (hanya pesanan berjalan, Selesai dan Ditolak angka kecil yang bisa diketuk), Ringkasan Penjualan, Sebaran
  pemesan, Pesanan terbaru.
- [~] **Ringkasan Penjualan (4A):** tata letak mengikuti mockup yang disetujui. Ikonnya sementara ikon garis kita
  sendiri (uang, nota, grafik); ikon Flaticon menunggu izin unduh dari Ilham.

Catatan tahap 3:
- **Wadah promo** kini kotak putih seperti rancangan, bukan wadah coral. Coral pindah ke pil potongan di atas
  foto; pada Cuci Gudang pilnya putih karena coral di atas jingga tidak terbaca. `nada="aksen"` di `Korsel`
  dihapus karena tidak dipakai lagi; `Korsel` mendapat `aksi` untuk "Lihat semua".
- **Kontras di atas foto:** bayangan 95% di dasar dan 78% di 42% tinggi kartu, jadi teks putih paling sedikit
  4,8:1 walau fotonya putih polos. Spanduk rincian promo memakai bayangan pekat (85% sampai 60% tinggi), 5,7:1.
- **Daftar urusan UMKM:** stok habis yang sudah dalam perjalanan turun ke bawah dan tidak merah; kuota kurang
  digabung satu baris bila lebih dari satu; label tombol dipendekkan (Keranjang, Lihat, Kontrak, Terima,
  Periksa) dengan awalan khusus pembaca layar untuk "Masukkan ke Keranjang". Saran belanja kini membuka
  Pesan Cepat dulu, tidak langsung masuk keranjang.
- **Pesanan berjalan:** kiriman yang sudah sampai (bukti antar atau lewat perkiraan tiba) merah dengan tombol
  Terima, "terlambat N hari" bila lewat perkiraan; tombol ungu penuh hanya di baris pertama.
- **Urus hari ini distributor** dibangun dari butir "Perlu tindakan" lonceng (`jenis` dan `pihak` baru di
  `ButirPemberitahuan`), digabung per kelompok: kiriman lewat perkiraan tiba (merah), pesanan menunggu jawaban,
  pengajuan kontrak, permintaan berhenti.
- **Palet donat** `seri-2`, `seri-1`, `seri-4` (biru baru) lolos `validate_palette.js` di semua pasangan, kedua tema.
- **Rute `/promo`** menyorot tab Beranda, begitu juga rincian promo.
- **Bukti:** Edge headless 1536 × 834 terang dan gelap (halaman penuh), 390 × 844 kedua portal, `/promo`, rincian
  promo, daftar promo distributor dengan promo berakhir, dan "Lihat semua" urusan (7 baris, `aria-expanded`).

## Tahap 4, rincian barang

- [x] **Tata letak desktop (Q102):** `pages/stok/StokDetail.tsx`. Mulai 1280px baris atas tiga kartu sama tinggi
  (sisa tercatat, perkiraan, saran distributor) dan baris bawah Tren dua pertiga serta Riwayat sepertiga. Di 1024
  sampai 1279px dua kolom. Di bawah 1024px tetap seperti sebelumnya: angka, saran, lalu tab Ringkasan dan Riwayat.

Catatan tahap 4:
- **Satu kotak untuk kolom kiri:** sedang dikirim, batas aman (kini satu baris bergaris atas), dan tombol Pesan
  Sekarang serta Koreksi Stok masuk ke kartu sisa tercatat, tombolnya rata bawah.
- **Kartu perkiraan** mendapat rincian per hari untuk tiga hari pertama sesudah data terakhir, dari garis perkiraan
  yang sama dengan grafik Tren (`KartuPerkiraan bawah`). Tanpa ini kartu tengah hampir kosong karena tingginya
  mengikuti kartu kiri.
- **Riwayat** di desktop lima terakhir dengan "Lihat semua" yang membuka sisanya di kartu itu juga. Di mode data
  server riwayat barang memang kosong (pergerakan belum dimuat dari API), jadi yang terlihat keadaan kosongnya.
- **`useKueriMedia`** (`lib/media.ts`) dipakai bersama `usePakaiMenuTarik`, supaya hanya satu susunan yang
  dirender, bukan dua susunan yang disembunyikan bergantian.
- Halaman ini tidak lagi dipaksa setinggi layar; DESIGN.md bagian 5 diperbarui.

## Tahap 5, Akun

- [x] **Tampilan perkiraan dihapus (Q103):** `layananPerkiraan` dan `aturLayananPerkiraan` di store, cabang
  "Hitungan sederhana" dan "Perkiraan tidak tampil" di `KartuPerkiraan`, serta kolomnya di Akun.
- [x] **Alat uji purwarupa satu baris (Q103):** pengantar, Akun simulasi, dan Peran akun, tombolnya sejajar di dasar
  kolom. Kotak yang sama di halaman akun distributor ikut disamakan (pengantar, Akun distributor, Peran akun).

## Pemeriksaan akhir

- `tsc -b` dan `vite build` lolos.
- Sapuan rute dengan Edge headless, tanpa galat konsol dan tanpa `role=alert`: UMKM `/beranda`, `/promo`,
  `/promo?jenis=cuci-gudang`, rincian promo, `/stok`, rincian barang, `/notifikasi`, `/akun`, `/pesanan`, `/prediksi`,
  `/belanja`, `/keranjang`, `/penjualan`; distributor Beranda, Pesanan, Promo, Buat Promo, Pemberitahuan, Akun,
  Ringkasan Penjualan, Kontrak; HP 390 × 844 untuk Beranda, `/promo`, rincian barang, Pemberitahuan, dan Akun.
- **Yang masih terbuka:** tiga ikon Flaticon untuk Ringkasan Penjualan (menunggu izin unduh dari Ilham). Sampai
  itu kartunya memakai ikon garis buatan sendiri.
