# Revisi 30 Oktober V6, cabang Rombak#4

Daftar kerja dari catatan revisi Ilham `referensi/Revisi 30 Oct V6.pdf` (di luar git), yang diperjelas lewat
dua putaran tanya-jawab (Q121 sampai Q132) dan satu tambahan untuk halaman Stok pada 30 Oktober 2026. Isinya:
- **menu samping:** gerak pil seperti situs portofolio Ilham, warna yang lebih lembut;
- **kepala Beranda:** huruf sama dengan gambar referensi, baris status data kasir satu gaya;
- **lonceng:** sejajar dengan elemen baris kepala tiap halaman;
- **halaman Stok:** kotak dan huruf di baris kepala;
- **Akun:** Tampilan dan Keluar paling bawah;
- **celah bawah** halaman desktop dipangkas;
- **ikon Flaticon** untuk petak Ringkasan Penjualan (sisa revisi V5).

Revisi sebelumnya ada di [REVISI-30-OKT-V5.md](REVISI-30-OKT-V5.md). Bahan pilihan untuk kedua putaran ada di
`referensi/Revisi 30 Oct V6/Mockup Revisi V6.html` (di luar git). Di mockup itu pertanyaan putaran 2 bernomor
Q129, Q131, Q132, dan Q133; yang dijawab Ilham adalah nomor di percakapan, Q129 sampai Q132, seperti di tabel.
Komit hanya saat Ilham meminta. Tanda: [x] selesai, [~] sebagian, [ ] belum.

## Keputusan

| No | Keputusan |
|---|---|
| Q121 | Akar masalah diperbaiki: menu samping tidak dipasang ulang saat pindah halaman. Gerak pil meniru portofolio (420 ms, `cubic-bezier(0.76, 0, 0.24, 1)`, berangkat saat diklik). Gerak dikurangi tetap mematikannya. |
| Q122 | Menu samping terang lembut (pilihan C): latar lavender, pil tanpa lengkung cekung. Oranye pil diminta lebih terang (Q129). |
| Q123 | "Selamat datang," Schibsted Grotesk 800, nama usaha Fraunces 700 miring, kedua portal. |
| Q124 | Baris ketiga ("Data kasir masuk ...") satu gaya untuk semua keadaan. Ikon centang memakai berkas dari Ilham. |
| Q125 | Lonceng tetap melayang, tetapi sejajar dengan elemen baris kepala tiap halaman (pil tanggal di Beranda, label metode di Prediksi), di semua halaman kedua portal. |
| Q126 | Tampilan pindah ke paling bawah Akun, di bawah Alat uji purwarupa: Terang, Gelap, Keluar sebaris di desktop dan HP. Akun distributor urutannya sama, hanya Terang dan Gelap. |
| Q127 | Celah bawah sekitar 19 px di semua halaman desktop yang bergulir. HP tidak berubah. |
| Q128 | Izin unduh tiga ikon Flaticon (9019160, 9019144, 9019224) untuk petak Ringkasan Penjualan. |
| Q129 | Pil O4: `#FF9A3C` dengan teks gelap `#1F1208` (8,7:1). |
| Q130 | Menu samping tema gelap: `#1D1729` ke `#17121F`, teks `#ECE6F7`, pil O4 yang sama. |
| Q131 | Tiga keadaan lain baris ketiga memakai ikon buatan Claude yang serasi dengan centang: seru amber, pensil ungu, info biru. |
| Q132 | Lonceng tetap melayang saat halaman digulir. |
| Stok | Kotak Cari barang, Habis, Menipis, Aman, dan Tambah Barang disamakan ukurannya dengan kotak lain (pil tanggal Beranda). Huruf dari "Stok" sampai "Tambah Barang" mengikuti ukuran kotaknya. |
| Susulan | Sesudah V6 diperiksa, Ilham meminta bentuk cekungan menu aktif dari `SIdebar.html` kembali, tanpa mengambil warna dari berkas itu: tab sewarna latar halaman yang menyambung ke halaman, lengkung cekung di atas dan bawah, pil di dalamnya. Warnanya tetap warna V6. |

## Tahap 1, menu samping

- [x] **Tidak dipasang ulang (Q121):** `App.tsx` dulu membungkus semua rute dengan `<BatasGalat key={pathname}>`,
  jadi kerangka dan menu samping dipasang ulang di tiap perpindahan dan pil muncul langsung di tempat baru.
  `Suspense` juga di tingkat aplikasi, sehingga halaman lazy yang pertama dibuka mengganti seluruh layar dengan
  kerangka abu-abu. Kini:
  - `layouts/IsiHalaman.tsx` (baru) membungkus `<Outlet />` dengan `BatasGalat key={pathname}` dan `Suspense`, dan
    dipakai `KerangkaAplikasi` serta `KerangkaDistributor`;
  - di `App.tsx` kunci batas galat hanya berganti untuk rute tanpa kerangka (`RUTE_TANPA_KERANGKA`); semua rute
    berkerangka berbagi kunci `kerangka`.
- [x] **Gerak portofolio (Q121):** `MenuSamping.tsx` menyimpan `tujuan` saat butir diklik (klik dengan tombol
  pengubah diabaikan), jadi pil berangkat sebelum rute berganti. Tujuan dihapus begitu butir aktif berubah, supaya
  tidak bisa aktif lagi. `aria-current` tetap mengikuti rute yang sungguh aktif. `.penanda-samping-gerak` 420 ms.
- [x] **Warna (Q122, Q129, Q130):** token `--c-samping-*`, `--c-pil-*`, `--c-akun-samping-*` di `index.css`, dan
  `--color-pil-ink` baru:
  - terang: latar `#F4EFFB` ke `#EBE3F7`, garis tepi kanan `#E2DBEF`, teks `#3B2D5C` (9,8 sampai 10,8:1),
    keterangan `#5B4C7D` (6,1 sampai 6,7:1), kartu akun putih;
  - gelap: `#1D1729` ke `#17121F`, teks `#ECE6F7` (14,3 sampai 15,1:1), keterangan `#B9AED0` (8,3 sampai 8,8:1);
  - pil `#FF9A3C` polos, teks `#1F1208` (8,7:1) di kedua tema.
- [x] **Cekungan kembali (susulan):** `.penanda-samping` kembali menjadi tab sewarna latar halaman (`--c-bg`,
  sudut kiri `--r-xl`) dengan lengkung cekung 28px di atas dan bawah (`::before`, `::after`), dan pil di dalamnya
  bersudut bulat penuh, seperti `SIdebar.html`. Tab, lengkung, dan pil bergeser bersama.

Catatan tahap 1:
- **Garis di tab dan lengkung:** latar halaman terang (`#F4F6F8`) hanya berbeda ΔE 2 sampai 4 dari lavender di
  daerah menu, jadi tanpa garis tab dan lengkungnya hampir tidak terlihat dan garis tepi menu hanya terputus. Tab
  dan lengkungnya diberi garis 1px `--c-samping-tepi`, sehingga garis tepi menu seolah membelok mengitari tab.
  Lingkaran garis di lengkung berjari-jari 27 sampai 28px dari titik yang digeser 1px ke dalam, supaya ujungnya
  menyambung tepat dengan garis tepi menu dan garis tab (dicek pada perbesaran 8 kali). Di tema gelap tab lebih
  gelap dari menu (ΔE sekitar 5), jadi cekungannya sudah terlihat tanpa garis. Pilihan menggelapkan lavender
  dibuang karena Ilham meminta warnanya tetap.
- **Batas pil** terhadap tab dan latar menu hanya sekitar 1,9:1. Butir aktif juga ditandai teks tebal bertinta
  gelap dan `aria-current`, jadi statusnya tidak bergantung pada warna pil saja.
- **Angka Keranjang** di menu kini ungu penuh (`bg-brand text-ink-inverse`), karena putih bertinta ungu dari V5
  hilang di atas latar terang. Cincin fokus di menu 3px sewarna teks menu.
- **Bukti:** rekaman 10 bingkai berjarak 45 ms di Edge headless (Beranda ke Stok, Stok ke Ringkasan Penjualan)
  memperlihatkan pil di posisi antara dan menu samping yang tidak berkedip. Sesudah cekungan kembali, rekaman
  Stok ke Ringkasan Penjualan menangkap tab di tengah jalan (di atas Keranjang) dengan garis dan kedua
  lengkungnya utuh.

## Tahap 2, kepala Beranda

- [x] **Huruf (Q123):** `index.html` memuat Schibsted Grotesk 800 dan Fraunces 700 miring hanya untuk kepala ini.
  Plus Jakarta Sans miring dari V5 tidak dimuat lagi. Token `font-sapaan` dan `font-nama-usaha` di `@theme`.
  `KepalaSambutan.tsx` memakainya, ukuran 30px di HP dan 40px di desktop tetap.
- [x] **Baris status data kasir (Q124, Q131):** `PitaDataKasir` di `components/domain/index.tsx` ditulis ulang
  dengan `BarisStatus`: ikon bulat 18px, teks `text-isi`, tautan tebal bila ada tindakan. Keadaannya:
  - produsen: pensil ungu, "Pemakaian bahan baku dicatat dari sesi masak", Buka Produksi;
  - kasir belum tersambung: info biru, Hubungkan;
  - catat manual: pensil ungu, Catat hari ini;
  - sedang menyinkron: info biru;
  - data lebih dari 18 jam: seru amber, "Data kasir terakhir masuk X, angka stok mungkin belum sesuai", Cek
    Koneksi Kasir;
  - data baru: centang hijau, "Data kasir masuk X".

  `PitaDasar` dan pita berwarna dihapus.
- [x] **Ikon status:** `public/gambar/status/centang.png` dari JPG Ilham (latar `#F7F7F7` dipotong jadi lingkaran
  transparan, 64px), `amber.svg`, `produksi.svg`, `info.svg` (lingkaran bergradien dengan tanda putih). Versi
  besarnya di `referensi/Revisi 30 Oct V6/`.

## Tahap 3, lonceng

- [x] **Sejajar baris kepala (Q125, Q132):** `useAtasLonceng` di `components/domain/Pemberitahuan.tsx` mencari
  `#konten [data-sejajar-lonceng]`, lalu menaruh titik tengah lonceng (44px) di titik tengah elemen itu, paling
  sedikit 8px dari atas. Tanpa tanda, lonceng 16px dari atas. Panelnya mulai 8px di bawah lonceng.
- [x] **Ukur ulang:** saat isi `#konten` berubah (`MutationObserver`, satu kali per bingkai), saat ukuran layar
  berubah, sesudah huruf termuat, dan saat digulir hanya bila elemennya di dalam bagian yang menempel.
- [x] **Tanda di 11 tempat:** baris `KepalaHalaman` (semua halaman detail), pil tanggal `KepalaSambutan`, dan
  baris kepala Stok, Prediksi (label metode), Pesanan, Produksi, Belanja, Kontrak distributor, Pesanan masuk
  (Lacak Pesanan), Promo distributor (Buat Promo), dan Pelanggan. `TidakDitemukan` tanpa tanda.

Catatan tahap 3:
- **Bukti:** selisih titik tengah lonceng dan elemennya 0 px di 1536 × 834, di Beranda, Stok, Prediksi, Pesanan,
  rincian pesanan, Ringkasan Penjualan, dan Akun pemilik usaha, serta Beranda, Pesanan, Promo, Kontrak, dan
  Pelanggan distributor. Elemen yang berdiri di kanan baris kepala (pil tanggal, label metode, Lacak Pesanan,
  Buat Promo) berjarak 12px dari lonceng.

## Tahap 4, kepala Stok

- [x] **Kotak dan huruf (tambahan Stok):** `pages/stok/Stok.tsx`. Di desktop kolom cari, ketiga tombol angka, dan
  Tambah Barang setinggi 40px (`lg:h-10`), sama dengan pil tanggal Beranda; di HP tetap 44px. Judul kembali
  `text-judul` (pengecualian 28px V4 dicabut). Kolom cari `text-kartu` di desktop (16px di HP), angka tombol
  `text-subjudul` dengan label `text-isi`, Tambah Barang `text-kartu` dengan ikon 16px.

## Tahap 5, Akun

- [x] **Tampilan paling bawah (Q126):** `pages/akun/Akun.tsx`. Bagian Tampilan pindah dari kolom kiri ke bawah
  kotak Alat uji purwarupa, dengan Terang, Gelap, dan Keluar sebaris tiga kolom sama lebar di semua ukuran. Keluar
  memakai ragam `bahaya-garis` setinggi dan setebal bingkai tombol tema, tetap membuka konfirmasi. Terang dan
  Gelap dikelompokkan (`role="group"`) supaya Keluar tidak terbaca sebagai pilihan tema.
- [x] **Akun distributor (Q126):** `ProfilDistributor.tsx`, Tampilan di bawah alat uji, hanya Terang dan Gelap.
  Keluar dari akun distributor tetap di dalam kotak alat uji.

## Tahap 6, celah bawah

- [x] **20 px di desktop (Q127):** `<main>` kedua kerangka `lg:pb-8` menjadi `lg:pb-5`, dan 79 akar halaman yang
  memakai `pb-4`, `pb-6`, atau `pb-8` mendapat `lg:pb-0` (termasuk akar keadaan lain di halaman yang sama, misalnya
  barang tidak ditemukan atau undangan terkirim). `FormulirBarang`
  (Tambah dan Ubah Barang) juga, karena ia membawa `pb-8` sendiri. HP tidak berubah.
- [x] **Halaman setinggi layar:** Stok, Prediksi, rincian pesanan, rincian pesanan masuk, dan Sebaran pemesan kini
  `calc(100dvh-2.75rem)` (jarak atas 24px ditambah bawah 20px).

Catatan tahap 6:
- **Bukti:** celah antara isi terakhir dan dasar layar 20 px di Beranda dan Akun (1536 × 834, digulir ke bawah).
  Halaman yang tidak bergulir (Akun distributor) tetap menyisakan ruang kosong di bawah.

## Tahap 7, ikon Ringkasan Penjualan

- [x] **Ikon Flaticon (Q128):** diunduh dari `cdn-icons-png.flaticon.com/512/9019/<id>.png` (PNG 512px), dikecilkan ke
  128px, disimpan di `public/gambar/penjualan/`: `ikon-penjualan-total.png` (9019160, koin),
  `ikon-penjualan-nota.png` (9019144, nota), `ikon-penjualan-rata.png` (9019224, grafik batang).
- [x] **Di petak:** `KartuRingkasanPenjualan` menampilkannya polos 40px tanpa lingkaran, sama dengan ikon Perlu
  Tindakan. `IkonUang` dihapus karena tidak dipakai lagi.

Catatan tahap 7:
- **Bukti:** kartu ini hanya muncul dengan sesi server, jadi diperiksa dengan memasang komponen aslinya di halaman
  yang berjalan (modul Vite yang sama) dengan data contoh 30 hari. Ketiga gambar termuat 40px di tema terang,
  gelap, dan 390px.
- **Di tema gelap** panah hitam pada ikon grafik agak samar di atas petak gelap. Labelnya tetap terbaca, jadi
  dibiarkan sampai Ilham memutuskan.

## Pemeriksaan akhir

- `tsc -b` dan `vite build` lolos.
- **Lingkungan:** pengujian memakai mode data contoh (API tidak menyala). Pemulihan basis data uji yang kedua
  membuat mesin Docker berhenti mendadak (kemungkinan memori host), sehingga kontainer uji `uji-v6` dan
  `warungku-db` milik Ilham ikut berhenti. `warungku-db` tidak dinyalakan ulang tanpa izin Ilham.
- **Tangkapan Edge headless** di 1536 × 834 terang dan gelap, 1536 × 730, dan 390 × 844: Beranda, Stok,
  Prediksi, Pesanan, rincian pesanan, Ringkasan Penjualan, Akun, serta Beranda, Pesanan, Promo, Kontrak,
  Pelanggan, dan Akun distributor (dibuka lewat Buka Portal Distributor).
- **Yang masih terbuka:**
  - pemeriksaan ulang dengan data server (kartu Ringkasan Penjualan sungguhan, masuk sebagai distributor) begitu
    basis data bisa dinyalakan lagi;
  - panah ikon grafik di tema gelap (lihat tahap 7).
