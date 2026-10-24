# Revisi 23 Oktober V2 — cabang Rombak#4

Daftar kerja dari catatan revisi tambahan Ilham (`referensi/Revisi 23 Oct V2.docx`, di luar
git), yang diperjelas lewat tanya-jawab Q40–Q64 pada 24 Oktober 2026. Sebelas butir A–K,
semuanya untuk portal usaha (UMKM); lonceng pemberitahuan dan label metode ikut berubah di
portal distributor supaya kedua portal tetap seragam. Revisi pertama ada di
[REVISI-23-OKT.md](REVISI-23-OKT.md). Setiap tahap dikomit dan di-push sendiri begitu lolos uji.

Layar acuan untuk "tanpa gulir": area halaman 1536 × 730 piksel CSS (laptop 1920 × 1080 dengan
skala Windows 125%). Tanda: [x] selesai, [~] sebagian, [ ] belum.

## Tahap 1 — perbaikan cepat

- [x] **F. API yang tertinggal versi (Q47).** `nyalakan.cmd` menyalakan ulang jendela API dan
  layanan model yang ia buka sendiri bila berkas kode Python lebih baru daripada prosesnya;
  program lain di port itu hanya diberi tahu.
- [x] **F. Pesan galat (Q48).** Balasan bawaan FastAPI ("Not Found", "Method Not Allowed")
  diganti kalimat yang menyebut jalan keluarnya; pesan cadangan tidak lagi menyebut kode HTTP.
- [x] **C. Dua tombol di bawah Beranda dihapus (Q43).**
- [x] **D. Petak Perlu Tindakan (Q44):** ikon dan angka berdampingan di tengah, nama di bawah.
- [x] **E. "Yang perlu kamu urus hari ini" (Q45, Q59):** slider seperti promo, berputar sendiri.
- [x] **A. Pesanan "Semua" (Q41):** paling banyak 6 kartu per kelompok, "Lihat semua ›".
- [x] **E. Promo dan Ringkasan (Q46, Q60):** dicek tampil di basis data uji.

Catatan tahap 1:
- Penyebab "Not Found" dan promo yang tidak muncul di layar Ilham: lingkungan `nyalakan.cmd`
  menyala sejak sekitar 10.53 tanggal 23 Okt, sebelum tahap 1 dan 5 revisi pertama. Vite memuat
  kode baru sendiri, tetapi uvicorn tidak, dan `nyalakan.cmd` dulu memakai API yang sudah menyala
  apa adanya. Variasi demo lamanya juga belum berisi promo.
- Jendela milik `nyalakan.cmd` dikenali dari judul `Turnify ...` di perintah tersandinya, cara
  yang sama dengan `matikan.cmd`. Diuji terpisah tanpa menjalankan skripnya: program lain di
  port 8010 hanya diberi tahu, jendela bertanda Turnify ditutup lalu port-nya lepas, dan kode
  yang tidak berubah dibiarkan.
- Petak Perlu Tindakan di HP kini kisi 2 × 2 (dulu deret ikon yang digeser), karena ikon dan
  angka harus berdampingan juga di HP.
- Slider tugas: 2 kartu per halaman di 1024–1279px dan 3 mulai 1280px, sama dengan kisi lama.
  Pane peramban yang tidak menggambar bingkai membuatnya tampak diam; di Edge headless slider
  tugas dan promo sama-sama berputar.
- Tinggi halaman di 1536px (Kopi Kita): Beranda 2663 → 2476px, Pesanan 4400 → 979px.

## Tahap 2 — kerangka

- [x] **J. Lonceng pemberitahuan (Q53, Q54, Q58):** di desktop lonceng melayang di kanan atas,
  menu samping dan panel kecilnya dihapus; halaman pemberitahuan tanpa menu samping dengan
  tombol kembali. Kedua portal. HP tidak berubah.
- [x] **B. Label metode di kanan judul (Q42),** di lima tempat; "Perkiraan untuk bulan depan"
  di Prediksi dihapus.
- [x] **I. Bagian atas beku (Q52)** di halaman Distributor dan Pesanan.

Catatan tahap 2:
- `LoncengMelayang` menggantikan `MenuPemberitahuan` (panelnya dihapus beserta
  `butirDariNotifikasi` yang tidak dipakai lagi). Tepi kanannya sejajar tepi kanan isi `<main>`,
  juga di layar sangat lebar. Baris judul yang punya isi di kanan memberinya ruang lewat
  `RUANG_LONCENG` (`lg:pr-14`) di `KepalaHalaman` dan di judul halaman Stok, Prediksi, Pesanan,
  Produksi, Beranda, serta Dashboard, Pesanan, Promo, Pelanggan, dan Profil distributor.
- Halaman pemberitahuan: kerangkanya menyembunyikan menu samping dan lonceng di rute itu;
  `KepalaHalaman` mendapat `kembaliRiwayat`, yang mundur ke halaman sebelumnya atau ke Beranda
  bila halamannya dibuka langsung.
- Label metode: `JudulBagian`/`Bagian` mendapat `bungkus` (label turun ke bawah judul bila tidak
  muat sebaris, misalnya kartu saran di kolom sempit). Gelembung `LabelMetode` kini mengukur
  sendiri dan dirata kanan bila dari kiri ia keluar layar. Di kartu saran, waktu hitung pindah
  ke bawah judul.
- `BagianAtasBeku`: di desktop judul sampai tab/chip menempel; di HP pembungkusnya
  `display: contents` sehingga hanya kotak cari dan tab (Distributor) atau tab dan chip
  (Pesanan) yang menempel di bawah bilah atas. Garis bawah muncul begitu halaman digulir.

## Tahap 3 — penyaring

- [x] **G. Menu tarik-turun (Q49, Q56):** Kategori dan Urutkan di Stok, Filter di halaman
  Distributor. Desktop: terbuka saat disorot, diklik, atau Enter. HP tetap lembar bawah.

Catatan tahap 3:
- Komponen baru `MenuTarik` (`components/ui/menuTarik.tsx`):
  - terbuka saat disorot dengan jeda 150 ms;
  - tertutup saat kursor pergi dengan jeda 250 ms, saat Esc (fokus kembali ke pemicu), saat
    klik di luar, saat fokus keluar, atau setelah memilih;
  - klik tetikus pada pemicu yang sudah terbuka karena disorot tidak menutupnya lagi, tetapi
    Enter tetap membuka dan menutup;
  - celah ke isinya berupa padding, jadi kursor yang menyeberang tidak menutup menu.
- `usePakaiMenuTarik`: menu dipakai di perangkat bertetikus dengan lebar minimal 640px. Satu
  keadaan buka di halaman menggerakkan menu itu atau `Lembar`, dan isi pilihannya ditulis
  sekali untuk keduanya.
- Di Stok, chip Kategori dan Urutkan dikeluarkan dari `BarisChip` di perangkat bertetikus,
  karena wadah yang menggulir ke samping akan memotong menunya. `Chip` mendapat `bukaMenu`
  (`aria-haspopup`/`aria-expanded` alih-alih `aria-pressed`).
- Diuji dengan kursor dan tombol sungguhan lewat DevTools Protocol di Edge headless: hover
  membuka (tidak sebelum 150 ms), memilih kategori menerapkan penyaring lalu menutup, Filter
  Distributor tetap terbuka sesudah memilih kota, Enter membuka dan menutup Urutkan, Esc
  mengembalikan fokus. Di 360px chip Kategori membuka lembar bawah.

## Tahap 4 — dasbor dan final touch

- [x] **H. Prediksi tanpa gulir (Q50, Q51, Q57):** baris atas barang dan nilai pemakaian, baris
  bawah perkiraan per barang; "Lihat semua ›" ke halaman "Prediksi · <kategori>".
- [x] **K. Stok (Q63):** daftar dengan bagian atas dan judul kolom tetap terlihat, baris lebih
  rapat; rincian barang memuat sisa stok, Tren, dan kartu saran dalam satu layar.
- [x] **K. Ringkasan Penjualan dan Produksi (Q64):** informasi utama tanpa gulir.
- [x] **K. Halaman lain (Q62, Q64):** rapi dan seimbang, boleh menggulir; Beranda satu kolom.
- [x] Tangkapan layar sebelum dan sesudah per halaman (Q55).

Catatan tahap 4 (diukur di Edge headless, 1536 × 730, tema terang):

| Halaman | Sebelum | Sesudah | Perubahan |
|---|---|---|---|
| Prediksi (Kopi Kita, Bu Ratmi) | 1186, 1250px | 730px | Susunan sketsa Ilham; kalimat peringatan sebaris judul; kartu tiga kolom, paling banyak 6; grafik lebih pendek; daftar perbandingan menggulir di kotaknya dengan ujung memudar |
| Prediksi · kategori, Prediksi satu barang | – | 730px | Halaman baru `?tampil=semua`; tampilan satu barang sudah muat |
| Stok | 730px (tabel menggulir di dalam) | 730px | Judul, kotak cari, tiga angka, dan Tambah Barang sebaris; baris tabel `py-2.5`: 7 baris terlihat, dulu 5,5 |
| Rincian barang | 1030px | 730px | Mulai 1280px tiga kolom: angka dan tombol, perkiraan dan Tren, saran distributor; tombol Pesan dan Koreksi berdampingan |
| Ringkasan Penjualan | 1341px | 1066px | Angka utama dan grafik di layar pertama; Terlaris selebar halaman dalam dua kolom bila tanpa daftar pembeli |
| Produksi | 1896px | 1415px | Kartu produk di layar pertama; riwayat masak dua kolom |
| Pesanan | 4400px | 991px | Tahap 1 (6 kartu per kelompok) |
| Beranda | 2663px | 2476px | Tahap 1; tetap satu kolom (Q62, Q64) |
| Akun | 1309px | 1102px | Kotak alat uji pindah ke bawah selebar halaman, tiga bagian berdampingan; kedua kolom menu sejajar |

Halaman yang tetap menggulir di layar acuan, dan alasannya:
- Beranda: tujuh bagian (promo, Perlu Tindakan, tugas, ringkasan penjualan, prediksi, pesanan
  berjalan, kuota kontrak); dua kolom tidak dipakai atas keputusan Q62/Q64.
- Distributor (katalog), Pesanan, Pemberitahuan: daftar panjang; bagian atasnya beku (Q52).
- Ringkasan Penjualan dan Produksi: informasi utamanya sudah di layar pertama; yang menggulir
  hanya rincian di bawahnya (Terlaris, riwayat masak).
- Lacak Pesanan: daftar kiriman di samping peta; peta dan keterangannya di layar pertama.
- Akun: daftar menu dan kotak alat uji purwarupa.
- Di 1280 × 720 Prediksi (771px) dan rincian barang (760px) masih menggulir sedikit; layar acuan
  Q50 adalah 1536 × 730.

## Tahap 5 — akhir

- [ ] DESIGN.md dan README: lonceng melayang, menu tarik-turun, bagian atas beku, layar acuan.
- [ ] Image backend hanya bila backend berubah.
