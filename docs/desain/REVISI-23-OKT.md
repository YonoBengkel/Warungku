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

- [x] Ungu merek #4A148C (versi tema gelap divalidasi). Coral #FF7F50 dan kuning #FFCC00
  hanya untuk sorotan, tidak pernah teks di atas putih dan tidak pernah warna status;
  aturannya di DESIGN.md.
- [x] Logo diganti warnanya (ungu menjadi #4A148C, panah tetap) di semua ukuran; perbandingan
  sebelum-sesudah ditunjukkan dulu dan disetujui Ilham.

Catatan tahap 3:
- Tema gelap: merek #A26CE5 (rona 267° yang sama): 5,23:1 dengan teks gelap di atasnya,
  4,77:1 sebagai teks di kartu gelap. Ungu lembut #F3ECFB / tinta #3A0A73 (terang) dan
  #1D0F33 / #C4A3F2 (gelap).
- Logo diwarnai ulang secara raster: piksel ungu digeser ronanya ke 267°, saturasinya
  dinaikkan, dan kecerahannya dipetakan sehingga tepi halusnya tetap halus. Tulisan "Turnify
  Flow" yang lebih gelap ikut menggelap dengan perbandingan yang sama. Berkas yang diganti:
  `docs/aset/logo-turnify-flow.jpeg`, `docs/aset/logo-mark.png`, `frontend/public/logo-mark.png`,
  `apple-touch-icon.png`, `favicon.ico`.
- Ungu #4A148C hanya 1,4:1 di permukaan gelap, jadi ada versi ungu terang untuk tema gelap
  (`logo-mark-gelap.png`, disetujui Ilham bersama perbandingannya). `TandaMerek` memilih
  otomatis.
- Kuning belum dipakai di layar; pemakaian pertamanya di landing page (tahap 6). Bintang
  penilaian tetap jingga: kuning di atas putih hanya 1,5:1, terlalu pudar untuk membedakan
  bintang terisi di isian penilaian.
- Permintaan Ilham: "Stok cukup untuk ±0 hari" diganti "Stok tidak cukup" (kartu perkiraan,
  hitungan sederhana, dan rincian penawaran).

## Tahap 4 — Lacak Pesanan

- [x] `/pesanan/lacak` dan `/distributor-portal/lacak`: tampilan daftar dan peta
  (Leaflet + OpenStreetMap). Posisi kiriman disimulasikan ("perkiraan posisi").
- [x] Kolom lat/lng distributor lewat migrasi; image backend menjalankan
  `alembic upgrade head` saat kontainer API menyala. Delapan distributor simulasi diberi titik
  gudang rekaan (variasi demo dan pembangkit dataset). Isian "Lokasi gudang" (peta yang bisa
  diklik) di Profil distributor; boleh kosong, kalau kosong dipakai titik tengah kota.
- [x] Jasa kirim, pengantar, dan nomor resi tampil di sisi UMKM sejak barang dikirim; tombol
  "Periksa kabar terbaru" benar-benar memuat ulang.
- [x] Pintu masuk: tombol di halaman Pesanan dan menu di navigasi samping desktop.

Catatan tahap 4:
- Migrasi `5e0c7a3d9b21` menambah `distributor.lat` dan `distributor.lng` (boleh kosong). Dump di
  image basis data 0.2.0 sudah memuat `alembic_version` di revisi sebelumnya, jadi hanya migrasi
  ini yang dijalankan. Endpoint baru: GET `/distributor/{id}/profil` dan PUT
  `/distributor/{id}/lokasi` (hanya distributor itu sendiri; titik harus di wilayah Indonesia).
  Katalog pembeli kini membawa `lat` dan `lng` distributor.
- Image backend: `alembic` masuk `requirements-produksi.txt`, `alembic.ini` dan `migrations/` ikut
  disalin, dan CMD menjalankan `alembic upgrade head` sebelum uvicorn. Hanya kontainer API yang
  bermigrasi; layanan model memakai `command:` sendiri. Berlaku setelah image 0.10.0 dibangun di
  akhir; sampai itu, jalur `nyalakan.cmd` sudah bermigrasi sendiri.
- `siapkan.cmd` dan `nyalakan.cmd` kini memasang ulang paket frontend bila
  `frontend/package-lock.json` lebih baru daripada catatan pemasangan npm terakhir. Dulu
  `npm install` hanya jalan kalau `node_modules` belum ada, sehingga Leaflet tidak akan terpasang
  di laptop teman yang menarik cabang ini.
- Variasi demo menjalankan dua perbaikan setiap kali, juga saat variasinya masih segar: titik
  gudang rekaan (tidak menimpa titik yang diisi distributor sendiri) dan jasa kirim, pengantar,
  serta resi untuk 85 kiriman simulasi yang belum punya. Keduanya hanya menyentuh data simulasi
  (pesanan sebelum 6 Okt 2026), bukan pesanan yang dibuat lewat aplikasi; penanda "kiriman
  terlambat ditandai sampai" dari tahap 1 dipersempit dengan aturan yang sama.
- Posisi kiriman ditaruh di garis lurus gudang ke tempat usaha, sejauh bagian waktu antara
  berangkat (jejak "dikirim" pertama) dan perkiraan tiba, dijepit 5–95%. "Lewat perkiraan tiba"
  baru disebut sesudah hari perkiraan tibanya berganti.
- Peta butuh internet untuk ubin OpenStreetMap; tanpa internet peta menyebutnya dan daftar tetap
  lengkap. Di tema gelap ubinnya dibalik warnanya.
- Ditemukan dan diperbaiki: pembangkit dataset (`buat_dataset.py`) gagal mencetak ringkasan
  variasi sejak tahap 1 (KeyError untuk isian distributor); kini memakai `variasi_demo.ringkas`.
  Koordinat pemesan dari data kontrak (titik pengganti) menimpa koordinat dari pesanan di portal
  distributor; urutannya dibalik.
- Ditemukan di luar revisi, lalu diperbaiki: "Ubah info usaha" di Profil distributor dulu hanya
  tersimpan di peramban, padahal toast-nya berbunyi "Profil toko tersimpan". Kini PUT
  `/distributor/{id}/profil` menyimpan tentang toko, alamat gudang, nomor HP, jam operasional, dan
  minimum pesanan dengan aturan yang sama dengan formulirnya, dan portal memuatnya saat tersambung.
  Kategori dan area kirim ("Yang kamu layani") ikut disimpan lewat PUT `/distributor/{id}/layanan`,
  hanya dari daftar chip di formulir (Mesin 2 mencocokkan area kirim dengan kota usaha huruf demi
  huruf). Rekomendasi di Belanja langsung memakainya; skor Mesin 2 menyusul di putaran penjadwal
  berikutnya, dan toast-nya menyebut itu.

## Tahap 5 — Ringkasan Penjualan

- [x] UMKM dari nota kasir; Bu Ratmi dari penjualan ke pembeli; distributor dari pesanan
  selesai. Tanpa laba kotor. Rentang awal 30 hari yang berakhir di data simulasi terakhir
  (5 Okt 2026) dengan keterangan; data demo tidak dihitung; nama di nota apa adanya.
- [x] Kalimat lama "tidak ada omzet" di landing page dan Bantuan diubah.
- [x] Pintu masuk: kartu di Beranda/Dashboard dan menu di navigasi samping desktop.

Catatan tahap 5:
- Endpoint `GET /usaha/{id}/ringkasan-penjualan` dan `GET /distributor/{id}/ringkasan-penjualan`
  (`backend/api/penjualan.py`), dengan `dari` dan `sampai` opsional. Isinya total, jumlah
  transaksi, rata-rata, pembeli atau pelanggan berbeda, per hari (hari kosong ikut, bernilai 0),
  sepuluh terlaris, lima pembeli atau pelanggan teratas, rincian, dan pembanding periode
  sebelumnya yang sama panjang.
- Nota: nilai = jumlah × harga jual di struk; nota batal dan nota `DEMO-` tidak dihitung.
  UMKM produsen (jenis `produksi-makanan`) memakai kiriman ke pembeli usaha. Distributor:
  pesanan selesai, selesai-catatan, atau dikirim yang sudah ditandai sampai (sama dengan tab
  "Selesai" portalnya), menurut tanggal pesanan; pendapatan = nilai barang + ongkos kirim;
  pesanan variasi demo (`V`, `W`) tidak dihitung.
- Tanggal memakai `(waktu AT TIME ZONE 'UTC')::date`, sama dengan Mesin 1 dan halaman Produksi:
  data simulasi menyimpan jam setempat sebagai UTC. Dengan itu nota terakhir jatuh di 5 Okt.
- Rentang: pilihan 7, 30, dan 90 hari dihitung mundur dari tanggal data terakhir, ditambah
  pilihan tanggal sendiri. Di data contoh (tanpa masuk) halamannya menyebut bahwa ringkasan
  butuh data server, bukan mengarang angka; kartu di Beranda dan Dashboard tidak tampil.
- Angka per 30 hari sampai 5 Okt di basis data coba: Kopi Kita Rp 88,29 jt dari 2.265 nota,
  Bu Ratmi Rp 18,3 jt dari 25 kiriman ke 4 pembeli, Sumber Tani Rp 217,1 jt dari 168 pesanan
  oleh 54 pelanggan.
- Untung dan margin tetap tidak ditampilkan (harga pokok per menu tidak ada); kalimat di
  landing page dan Bantuan kini menyebut itu, bukan "tidak ada omzet".

## Tahap 6 — Landing page

- [ ] Susunan "Technology Landing Page": bilah atas (logo, Beranda · Fitur · Untuk
  Distributor · Kontak, tombol Masuk), hero teks kiri dan foto kanan berpotongan lengkung,
  tiga blok fitur, satu blok distributor, kaki halaman. Foto dari `referensi/Home-Page`
  (keputusan Ilham, repo publik). Kontak: 08xxx-xxxx-xxxx.

## Akhir

- [ ] Image backend 0.10.0 (migrasi otomatis), README dan DESIGN.md diperbarui.
