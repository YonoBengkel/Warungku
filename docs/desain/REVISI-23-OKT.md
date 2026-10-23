# Revisi 23 Oktober — cabang Rombak#4

Daftar kerja dari catatan revisi tim (`referensi/Revisi 23 Oct.docx`, di luar git), yang
diperjelas lewat tanya-jawab dengan Ilham pada 23 Oktober 2026. Keluhan di catatan itu
ditulis terhadap Rombak#3 (dipakai teman tim); semuanya dikerjakan di Rombak#4. Rombak#3
tidak disentuh. Setiap tahap dikomit dan di-push sendiri begitu lolos uji. Image backend
baru (0.10.0) dibangun sekali di akhir.

Tanda: [x] selesai, [~] sebagian, [ ] belum.

## Tahap 1 — yang paling terlihat

- [x] **Label metode.** Nama metodenya saja di atas halaman atau kartu ("LightGBM",
  "Thompson Sampling + fuzzy", "K-Prototypes"). Gelembung penjelasan 2–3 kalimat muncul
  saat kursor di atasnya, saat diketuk (HP), atau saat difokus. Tidak ada lagi tulisan
  "Mesin 1/2/3", tidak ada kalimat yang mengulang nama metode, tidak ada tombol di bawah.
  Di Prediksi, kartu saran di rincian barang, halaman Distributor, dan Pelanggan.
- [x] **Penjelasan saran distributor tanpa matematika.** Tetap: label "Sangat layak / Layak"
  dan satu kalimat alasan. Dibuang: persentase peluang, skor gabungan, kalimat "A dari B
  pesanan … berjalan mulus", nama rumus, kata "Mesin 2" (juga di halaman Distributor).
- [x] **Saran untuk semua barang.** Mesin 2 menghitung saran untuk semua barang, tidak hanya
  yang stoknya di bawah dua kali batas aman. Kartu saran pindah ke atas di rincian barang.
- [x] **Data demo distributor.** Untuk Sumber Tani Nusantara: pesanan masuk dari 4–5 UMKM di
  setiap tahap, kontrak di setiap status, sekitar 8 promo berjalan (5–6 miliknya dan 2–3
  dari distributor lain yang melayani Yogyakarta) yang juga mengisi Beranda Kopi Kita.
  Sembilan kiriman simulasi yang terlambat sejak awal Oktober ditandai selesai dan diganti
  kiriman bertanggal hari ini.

Catatan tahap 1:
- Jenis promo di basis data hanya cuci gudang, produk baru, dan keanggotaan; variasinya dibuat
  dari tiga jenis itu (potongan dan tanggal berakhir beragam), bukan jenis baru.
- Kiriman simulasi yang terlambat ternyata 85 (semua distributor), bukan hanya 9 milik Sumber
  Tani; semuanya ditandai sampai.
- Ringkasan per distributor di halaman Distributor tetap hanya merangkum barang yang perlu dibeli
  (stok di bawah dua kali batas aman), karena Mesin 2 kini menilai semua barang.
- Ditemukan saat menguji: tombol alat uji "Buka Portal Distributor" membuka data contoh di mode
  server; kini menyambung sesi distributor simulasi dulu. Jumlah ulasan kini bertitik ribuan.
- API menerima asal CORS tambahan lewat `WARUNGKU_ASAL_TAMBAHAN` (untuk frontend uji atau domain).

## Tahap 2 — tata letak

- [x] Komponen **Bagian** (kotak putih besar bersudut bulat) di Beranda, Dashboard
  distributor, rincian barang, dan Prediksi.
- [x] **Wadah promo** berwarna coral berisi kartu putih, tombol ‹ › di pojok.
- [x] **Slider:** geser per halaman (3 kartu di desktop, 1 di HP), titik penanda per halaman,
  panah kiri yang macet diperbaiki, bisa ditarik tetikus, putar otomatis 3 detik, animasi
  300 ms.
- [x] **Pemberitahuan kecil:** panel dari menu samping desktop di kedua portal; distributor
  mendapat menu dan halaman pemberitahuan baru, isinya diturunkan dari data yang dimuat.
  HP tetap halaman penuh.

Catatan tahap 2:
- Di HP, Bagian menjadi pita putih selebar layar tanpa sudut (pola aplikasi belanja di HP),
  supaya lebar isi tidak terpotong dua kali; mulai 640px ia kotak bersudut. Wadah promo coral
  mengikuti pola yang sama.
- Kartu promo kini putih untuk semua jenis; jenisnya tetap dikenali dari medali ikon dan
  lencana berwarna penuh, dan latar lembut jenisnya pindah ke lencana potongan. Pratinjau di
  halaman Promo distributor ikut putih, sama dengan yang dilihat pemilik usaha.
- Token `aksen` (coral) sudah masuk sekarang karena dibutuhkan wadah promo, beserta aturannya
  di DESIGN.md. Kuning dan ungu baru tetap di tahap 3.
- Slider di tablet berisi 2 kartu per halaman. Geseran jari juga berhenti per halaman, karena
  titik jangkar gulir hanya dipasang di kartu pertama tiap halaman.
- Isi pemberitahuan distributor: pesanan menunggu jawaban, kiriman lewat perkiraan tiba,
  pengajuan kontrak, permintaan berhenti kontrak (empat ini "perlu tindakan"), kontrak yang
  berakhir dalam 30 hari, dan promo yang berakhir dalam 7 hari. Lonceng HP distributor kini
  membuka halaman ini, bukan Pesanan.
- Di kartu Tren pemakaian (rincian barang), "perkiraan lightgbm, pita p10–p90" diganti
  LabelMetode, sejalan dengan keputusan label metode di tahap 1.
- Ditemukan, belum diubah (di luar revisi): kartu perkiraan menulis "Stok cukup untuk ±0 hari"
  bila perkiraan hari pertama sudah melebihi sisa stok.

## Tahap 3 — warna

- [ ] Ungu merek #4A148C (versi tema gelap divalidasi). Coral #FF7F50 dan kuning #FFCC00
  hanya untuk sorotan, tidak pernah teks di atas putih dan tidak pernah warna status;
  aturannya di DESIGN.md.
- [ ] Logo diganti warnanya (ungu menjadi #4A148C, panah tetap) di semua ukuran; perbandingan
  sebelum-sesudah ditunjukkan dulu.

## Tahap 4 — Lacak Pesanan

- [ ] `/pesanan/lacak` dan `/distributor-portal/lacak`: tampilan daftar dan peta
  (Leaflet + OpenStreetMap). Posisi kiriman disimulasikan ("perkiraan posisi").
- [ ] Kolom lat/lng distributor lewat migrasi; image backend menjalankan
  `alembic upgrade head` saat kontainer API menyala. Delapan distributor simulasi diberi titik
  gudang rekaan (variasi demo dan pembangkit dataset). Isian "Lokasi gudang" (peta yang bisa
  diklik) di Profil distributor; boleh kosong, kalau kosong dipakai titik pusat kota.
- [ ] Jasa kirim, pengantar, dan nomor resi tampil di sisi UMKM sejak barang dikirim; tombol
  "Periksa kabar terbaru" benar-benar memuat ulang.
- [ ] Pintu masuk: tombol di halaman Pesanan dan menu di navigasi samping desktop.

## Tahap 5 — Ringkasan Penjualan

- [ ] UMKM dari nota kasir; Bu Ratmi dari penjualan ke pembeli; distributor dari pesanan
  selesai. Tanpa laba kotor. Rentang awal 30 hari yang berakhir di data simulasi terakhir
  (5 Okt 2026) dengan keterangan; data demo tidak dihitung; nama di nota apa adanya.
- [ ] Kalimat lama "tidak ada omzet" di landing page dan Bantuan diubah.
- [ ] Pintu masuk: kartu di Beranda/Dashboard dan menu di navigasi samping desktop.

## Tahap 6 — Landing page

- [ ] Susunan "Technology Landing Page": bilah atas (logo, Beranda · Fitur · Untuk
  Distributor · Kontak, tombol Masuk), hero teks kiri dan foto kanan berpotongan lengkung,
  tiga blok fitur, satu blok distributor, kaki halaman. Foto dari `referensi/Home-Page`
  (keputusan Ilham, repo publik). Kontak: 08xxx-xxxx-xxxx.

## Akhir

- [ ] Image backend 0.10.0 (migrasi otomatis), README dan DESIGN.md diperbarui.
