# Revisi 25 Oktober V3 — cabang Rombak#4

Daftar kerja dari catatan revisi Ilham `referensi/Revisi 25 Oct V3.docx` (di luar git), yang
diperjelas lewat tanya-jawab Q65–Q82 pada 25 Oktober 2026. Isinya tujuh bagian: Stok, Tambah
Barang, Prediksi, Distributor, Pesanan, Lacak Pesanan, dan tombol kembali. Revisi sebelumnya ada
di [REVISI-23-OKT.md](REVISI-23-OKT.md) dan [REVISI-23-OKT-V2.md](REVISI-23-OKT-V2.md). Setiap
tahap dikomit dan di-push sendiri begitu lolos uji.

Layar acuan berubah di V3 (Q68). Tangkapan layar Ilham menunjukkan area halaman sekitar
1534 × 834 piksel CSS (laptop 1920 × 1200 dengan skala 125%), bukan 1536 × 730 seperti yang
dipakai V2. Dasbor kini mengisi tinggi layar berapa pun dan diuji di dua ukuran: **1536 × 834**
dan **1536 × 730**. Tanda: [x] selesai, [~] sebagian, [ ] belum.

## Tahap 1 — kerangka bersama

- [x] **Kepala halaman rapat ke atas (Q66).** `KepalaHalaman` (47 halaman, kedua portal) mulai di
  posisi menempelnya, jadi tidak bergeser lagi saat digulir. Kepala halaman Stok di HP ikut.
- [x] **Tombol kembali (Q78):** panah kembali mundur ke halaman sebelumnya; alamat `kembaliKe`
  hanya cadangan bila halaman dibuka langsung. Tombol Batal di formulir ikut mundur. Halaman
  sesudah Simpan atau Kirim mengganti formulirnya di riwayat.
- [x] **Bilah aksi bawah (Q69)** selalu di dasar layar di 20 halaman; luberan tombol di Prediksi
  dibetulkan.
- [x] **Lacak Pesanan keluar dari menu samping (Q74)** di kedua portal; angka "sedang di jalan"
  pindah ke tombol Lacak Pesanan di halaman Pesanan.

Catatan tahap 1:
- Kepala halaman memakai margin negatif sebesar jarak atas `<main>` (`-mt-4 lg:-mt-6`). Dulu ia
  mulai di bawah jarak itu lalu naik 16px (HP) atau 24px (desktop) saat digulir.
- `useKembali()` (di `components/ui/navigasi.tsx`) mundur bila nomor entri riwayat React Router
  (`history.state.idx`) lebih dari 0. Di entri pertama ia pindah ke cadangan dengan `replace`,
  supaya panah kembali di halaman cadangan tidak memantul kembali ke halaman tadi. Properti
  `kembaliRiwayat` (V2) dihapus karena semua kepala halaman kini begitu.
- Halaman sesudah kirim yang kini mengganti formulirnya di riwayat:
  - Tambah Barang, Ubah Barang, Koreksi Stok, Batas Aman;
  - Terima Barang, Beri Penilaian, Kontrak Rutin;
  - Data Usaha, Jenis Usaha, Pasangkan Menu Kasir.

  Tombol "Kembali ke Susu & Olahan" di Prediksi tetap ke kategori yang disebutnya.
- `BilahAksi` kini `position: fixed`, dengan pengganti setinggi bilah di alur halaman supaya
  baris terakhir tidak tertutup. Tingginya dibagikan lewat `--tinggi-bilah`, sehingga toast
  muncul di atas bilah. Bilahnya selebar area kanan menu samping, dan isinya selebar isi
  `<main>` (paling lebar 1400px). Pembungkus `sticky` di Keranjang, Ringkasan, Selesai, dan
  Pesan Cepat dihapus. Properti baru `lebarAksi="lebar"` dipakai Prediksi: pengatur jumlah dan
  tombolnya lebih lebar dari 448px, sehingga dulu tombolnya menjorok ke luar.
- Di halaman Lacak Pesanan menu Pesanan yang menyala (portal distributor:
  `tabDistributorAktif`).
- Diuji di 1536 × 834 dan 390 × 844:
  - kepala halaman Tambah Barang, rincian penawaran, dan Stok (HP) tetap di posisinya sebelum
    dan sesudah digulir;
  - mundur dari Matcha Bubuk ke Matcha House Supply, lalu ke tab Daftar Distributor;
  - bilah di rincian penawaran dan rincian Pesanan Masuk ada di dasar layar;
  - toast "diatur jadi 5 dus" muncul 24px di atas bilah.

## Tahap 2 — Stok

- [ ] **Bagian atas Stok (Q65):** kolom cari, tiga kotak angka, dan Tambah Barang setinggi 56px.
- [ ] **Tambah dan Ubah Barang dua kolom (Q67)**, Simpan dan Batal di bilah bawah.
- [ ] **Rincian barang mengisi tinggi layar (Q68):** grafik Tren memanjang.

## Tahap 3 — Prediksi

- [ ] **Isi tinggi layar (Q68):** "Perkiraan bulan depan per barang" di Prediksi per kategori dan
  grafik di Prediksi per barang memanjang.
- [ ] **Hitungan saran dan Dipesan dari (Q70)** di kolom kanan Prediksi per barang.

## Tahap 4 — Distributor dan Pesanan

- [ ] **Label metode (Q71)** rata kanan di baris tab, hanya saat Rekomendasi tampil.
- [ ] **Dua tombol di bawah halaman Distributor dihapus (Q72).**
- [ ] **Tab Pesanan · Kontrak sebaris dengan Lacak Pesanan (Q73).**
- [ ] **Hitungan saran ringkas di rincian barang distributor (Q79).**

## Tahap 5 — Lacak Pesanan

- [ ] **Daftar dengan garis empat titik (Q75)**, kedua portal (Q77).
- [ ] **Peta di rincian pesanan (Q76)** dan rincian Pesanan Masuk (Q80).

## Tahap 6 — akhir

- [ ] DESIGN.md: kepala halaman, bilah aksi, tombol kembali, layar acuan, Lacak Pesanan.
- [ ] Perbandingan sebelum–sesudah di 1536 × 834 dan 1536 × 730.
- [ ] Lingkungan uji dibersihkan. Image backend tidak dibangun karena V3 hanya mengubah frontend.
