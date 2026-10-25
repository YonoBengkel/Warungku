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

- [x] **Bagian atas Stok (Q65):** kolom cari, tiga kotak angka, dan Tambah Barang setinggi 56px.
- [x] **Tambah dan Ubah Barang dua kolom (Q67)**, Simpan dan Batal di bilah bawah.
- [x] **Rincian barang mengisi tinggi layar (Q68):** grafik Tren memanjang.

Catatan tahap 2:
- **Stok, diukur di Edge headless:** kolom cari, ketiga kotak angka, dan Tambah Barang masing-masing
  56px di 1536px. Di 390px kolom cari dan kotak angka 56px, Tambah Barang 36px di samping judul.
  Angka di kotak kini 22px dengan jarak dalam yang lebih tipis.
- **Tambah dan Ubah Barang:**
  - mulai 1024px dua kolom selebar halaman; di 1536 × 834 tinggi kolom kiri 1067px dan kanan 936px;
  - tinggi halaman 1318px (dulu 2248px), jadi di layar Ilham masih menggulir sekitar 480px; perkiraan
    150–250px di Q67 terlalu kecil;
  - kolom yang belum beres kini disebut di kiri bilah bawah, menggantikan kotak peringatan di atas
    tombol; di desktop, tanpa galat, kiri bilah berisi "Kolom bertanda * wajib diisi";
  - di HP tombol Simpan dan Batal berdampingan supaya bilahnya pendek.
- **Rincian barang:** mulai 1280px halaman setinggi layar, dan kolom tengah memanjang sampai dasar.
  `GrafikTren` mendapat `isiTinggi`: grafiknya mengisi sisa tinggi wadahnya, dengan `tinggi` sebagai
  batas bawah. Gambar duduk di lapisan `absolute` supaya wadahnya diukur dari sisa kolom, bukan
  ditahan tinggi gambar lama (`useTinggiWadah` di `dasarGrafik.ts`). Hasilnya, tanpa gulir di kedua
  ukuran:

  | Layar | Tinggi grafik Tren |
  |---|---|
  | 1536 × 834 | 281px |
  | 1536 × 730 | 177px |

  Di bawah 1280px grafiknya tetap 150px.
- **Pane peramban:** pane yang tersembunyi tidak menggambar bingkai, sehingga `ResizeObserver` tidak
  berjalan dan ukuran grafik di sana basi. Pengukuran memakai Edge headless.

## Tahap 3 — Prediksi

- [x] **Isi tinggi layar (Q68):** "Perkiraan bulan depan per barang" di Prediksi per kategori dan
  grafik di Prediksi per barang memanjang.
- [x] **Hitungan saran dan Dipesan dari (Q70)** di kolom kanan Prediksi per barang.

Catatan tahap 3 (Edge headless, tema terang):
- Mulai 1024px halaman Prediksi setinggi layar dikurangi jarak atas-bawah `<main>`. Di kategori,
  baris bawah ("Perkiraan bulan depan per barang") mengisi sisa tinggi:
  - `GrafikBatang` mendapat `isiTinggi` seperti `GrafikTren`;
  - daftar barang di kanannya kini `absolute` di wadah setinggi baris (paling pendek 9rem), jadi
    menampilkan sebanyak yang muat dan tidak ikut meninggikan halaman.
- Ukuran yang terukur, semuanya tanpa gulir halaman:

  | Halaman | 1536 × 834 | 1536 × 730 |
  |---|---|---|
  | Kemasan: grafik batang | 265px (dulu 120px) | 161px |
  | Kemasan: daftar | keempat barang terlihat | menggulir sedikit, ujungnya memudar |
  | Susu Kental Manis: grafik | 323px (dulu 200px) | 219px |

  Di halaman per barang kedua kotaknya sama tinggi sampai di atas bilah bawah.
- Komponen baru `HitunganSaran` (`components/domain/HitunganSaran.tsx`) menulis asal angka saran
  dengan rumus yang sama dengan `rekomendasiDari`, sehingga angkanya selalu sama dengan bilah bawah.
  Contoh Susu Kental Manis:
  - terpakai bulan ini 69,2 liter, perkiraan bulan depan 67,8 liter, sisa − 40,8 liter;
  - kurang 27 liter, isi 1 dus 6 liter;
  - saran beli 5 dus (4,5 dus, dibulatkan ke atas).

  Untuk arah "tetap" kartunya menyebut berapa persen perkiraan yang tertutup sisa; untuk arah
  "kurang", kelebihannya. Keduanya tanpa angka beli.
- **Dipesan dari** (Q70):
  - menyebut distributor yang dipakai tombol keranjang: nama, logo, harga per satuan (harga kontrak
    bila ada), dan tautan "Lihat penawarannya";
  - contoh: Dairy Prima Jaya, Rp 180.000/dus, harga beli sekali, cocok dengan perkiraan biaya
    Rp 900.000 untuk 5 dus di bilah bawah.

## Tahap 4 — Distributor dan Pesanan

- [x] **Label metode (Q71)** rata kanan di baris tab, hanya saat Rekomendasi tampil.
- [x] **Dua tombol di bawah halaman Distributor dihapus (Q72).**
- [x] **Tab Pesanan · Kontrak sebaris dengan Lacak Pesanan (Q73).**
- [x] **Hitungan saran ringkas di rincian barang distributor (Q79).**

Catatan tahap 4 (Edge headless, 1536 × 834 dan 390 × 844):
- **Halaman Distributor:**
  - label "Thompson Sampling + fuzzy" kini di baris tab; tepi kanannya lurus dengan tombol Filter;
  - di tab Cari Barang, atau bila ada kata cari atau saringan kota, label itu tidak tampil;
  - di HP baris tab tidak muat, jadi label tetap di kanan judul Rekomendasi;
  - "Lihat stok yang menipis" dan "Buka keranjang" dihapus dari kedua tab.
- **Pesanan:** di desktop tab Pesanan · Kontrak di kiri dan Lacak Pesanan (berangka) di ujung kanan, sebaris; chip
  Semua/Berjalan/Selesai langsung di bawah tab. Di HP Lacak Pesanan tetap di atas tab.
- **Rincian barang distributor:** kartu "Stok kamu untuk barang ini" mendapat bagian "Kebutuhan bulan
  depan".
  - Isinya `HitunganSaran` ringkas (tanpa pemakaian bulan ini) dalam kemasan jual penawaran itu, hanya
    untuk barang yang sudah diperkirakan.
  - Rumus jumlah beli kini satu, `jumlahBeliUntuk`, dan dipakai kartu itu maupun jumlah awal lembar Beli
    Sekali.
  - Dulu jumlah awal itu membulatkan saran dalam kemasan barang lebih dulu, baru dikonversi ke kemasan
    distributor. Hasilnya bisa lebih besar, misalnya kurang 11 liter dengan kemasan barang 10 liter dan
    kemasan distributor 4 liter: dulu 5, sekarang 3.
  - Jumlah awal Beli Sekali tetap dibatasi stok distributor.
- Baris "Isi 1 …" di kartu hitungan disembunyikan bila kemasannya sama dengan satuan tampil barang
  ("Isi 1 kg: 1 kg" tidak menjelaskan apa-apa).

## Tahap 5 — Lacak Pesanan

- [ ] **Daftar dengan garis empat titik (Q75)**, kedua portal (Q77).
- [ ] **Peta di rincian pesanan (Q76)** dan rincian Pesanan Masuk (Q80).

## Tahap 6 — akhir

- [ ] DESIGN.md: kepala halaman, bilah aksi, tombol kembali, layar acuan, Lacak Pesanan.
- [ ] Perbandingan sebelum–sesudah di 1536 × 834 dan 1536 × 730.
- [ ] Lingkungan uji dibersihkan. Image backend tidak dibangun karena V3 hanya mengubah frontend.
