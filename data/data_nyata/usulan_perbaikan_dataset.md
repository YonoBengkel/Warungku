# Usulan perbaikan dataset

Untuk didiskusikan 13 Okt 2026. Ditulis sesi Warungku #1.2 (Data), 12 Okt 2026.

**Status: usulan.** Belum disetujui dan belum dikerjakan. Malam ini dataset
dibekukan karena sesi #1.1 dan #2 sedang menguji model di atasnya. Tidak ada kode
atau basis data yang diubah untuk menulis dokumen ini.

| # | Usulan | Mesin yang terdampak | Keputusan yang diminta |
| --- | --- | --- | --- |
| 1 | Distributor 8 → 20–30, sebagian masuk belakangan, mutunya berubah | Mesin 2 (utama), Mesin 3 (efek samping) | Setuju rancangan dan skenarionya? Kapan regenerasi? |
| 2 | Harga penawaran mengikuti harga pangan nyata Siskaperbapo (data MarketCast) | Mesin 2 | Pilih jalan keluar soal lokasi, rentang tanggal, dan izin data |
| 3 | Adaptor UCI Online Retail II untuk validasi Mesin 3 | Mesin 3 | Setujui usulan sheet baris 12? |

Usulan 1 dan 2 sama-sama mengubah pembangkit, jadi sebaiknya dikerjakan bersama
dalam **satu** regenerasi. Setiap regenerasi membuat hasil model sebelumnya tidak
sebanding lagi (lihat bagian "Urutan kerja").

---

## 1. Distributor 8 → 20–30, dengan pendatang baru dan perubahan mutu

### Masalahnya sekarang

Dengan 8 distributor, eksplorasi tidak terlihat nilainya. Di simulasi regret
terakhir, greedy (1.383) malah sedikit lebih baik daripada Thompson (1.420); lihat
sheet "Catatan Perubahan" baris 17. Penyebabnya ada di rancangan data, bukan di
metodenya:

- **Terlalu sedikit pilihan.** Distributor dibagi per kategori dan area kirim
  (`dataset/katalog.py`, `DISTRIBUTOR`). Satu barang di satu kota biasanya hanya
  punya 2–3 kandidat.
- **Reputasi dipakai bersama 70 UMKM.** Pelanggan per distributor 23–70
  (dihitung dari tabel `pesanan`). Dalam pekan pertama, setiap distributor sudah
  dicoba puluhan kali, jadi greedy sudah tahu cukup banyak.
- **Mutu tidak pernah berubah.** `KarakterDistributor` (`dataset/pola.py`)
  memberi peluang tepat waktu, jumlah sesuai, dan kondisi baik yang tetap
  sepanjang 400 hari. Kalau dunia tidak berubah, yang sudah dipelajari tidak
  pernah usang, dan eksplorasi lanjutan sia-sia.
- **Tidak ada pendatang baru.** Semua distributor sudah ada sejak hari pertama.
  Padahal masalah "coba yang baru atau tetap di yang lama" adalah inti
  eksplorasi.

### Rancangan yang diusulkan

- **Jumlah: 24 distributor** (di tengah rentang 20–30), dibangkitkan dengan
  fungsi seperti `_bangkitkan_umkm`, tidak ditulis tangan satu per satu. Targetnya
  4–6 kandidat per barang per kota.
- **Pendatang baru:** 16 ada sejak awal, 8 masuk bertahap di hari 60–300. Pendatang
  baru mulai tanpa ulasan, sehingga penghalusan Bayesian di `bangun_fitur_pesanan`
  (prior 4,2, bobot 8) benar-benar teruji.
- **Perubahan mutu (drift), tiga pola:**

  | Pola | Porsi | Contoh |
  | --- | --- | --- |
  | Stabil | ±60% | Seperti sekarang |
  | Turun mendadak | ±20% | Kurir utama keluar: peluang tepat waktu 0,92 → 0,65 di hari acak |
  | Membaik perlahan | ±20% | Pendatang baru yang mulai rapi: 0,70 → 0,90 dalam 120 hari |

- **Skenario yang dibangkitkan:** `stasioner` (24 distributor, tanpa drift) dan
  `berubah` (24 distributor, dengan drift dan pendatang). Skenario 8 distributor
  yang sekarang tetap disimpan sebagai pembanding.

### Supaya tidak curang

Laporan lama sudah mengakui bahwa kami sendiri yang membuat distributor termurah
menjadi yang terburuk. Usulan ini menambah rancangan yang lagi-lagi bisa
menguntungkan metode kita, jadi tiga pagar perlu disepakati dulu:

1. Parameter skenario (porsi pola, besar perubahan, hari masuk) **dicatat di
   sheet sebelum model dijalankan**, dan tidak diubah sesudah melihat hasil.
2. Skenario `stasioner` ikut dilaporkan. Kalau greedy menang di sana, itu temuan
   yang harus ditulis, bukan disembunyikan.
3. Kebijakan diskon atau jendela geser untuk Thompson (yang memang dirancang untuk
   drift) dibandingkan dengan Thompson biasa, supaya jelas bagian mana yang
   bekerja.

### Efek samping yang harus diputuskan

- **Mesin 3 menipis.** Sekarang ada 414 pasangan distributor–pelanggan, sekitar 52
  pelanggan per distributor. Dengan 24 distributor dan pola belanja yang sama
  (±6 distributor per UMKM), tiap distributor hanya punya ±17 pelanggan.
  K-Prototypes dengan 3–4 segmen di atas 17 titik rapuh. Pilihannya:
  (a) segmentasi Mesin 3 dihitung hanya untuk distributor dengan ≥ 30 pelanggan,
  (b) UMKM dinaikkan ke ±150 (volume nota naik dua kali lipat, regenerasi lebih
  lama), atau (c) terima saja, karena Mesin 3 sekarang fitur pendukung dan
  metodenya divalidasi di Online Retail II (usulan 3). Saya menyarankan (a) + (c).
- **Volume.** Baris pesanan dan counterfactual naik sedikit. Volume nota tidak
  berubah, karena nota bergantung pada UMKM, bukan distributor.
- **Kontrak data tidak berubah.** `fitur_pesanan` dan `d2_counterfactual.csv` tetap
  berkolom sama. Kolom baru opsional: penanda skenario.

---

## 2. Harga penawaran digerakkan harga pangan nyata (Siskaperbapo via MarketCast)

### Data yang tersedia (diperiksa 12 Okt 2026)

Repo: https://github.com/kadeksavitady/MarketCast, folder `data/processed/`.

- `data_preprocessed.csv` (2,2 MB): kolom `tanggal, komoditas, harga_per_kg`,
  harga harian, **2021-05-07 sampai 2026-05-07**, 33 komoditas.
- `cluster_features.csv`: ringkasan per komoditas (koefisien variasi, rata-rata,
  kemiringan tren, klaster).
- Asal data: scraper `src/data/historical_scraper.py` mengambil tabel harga dari
  `siskaperbapo.jatimprov.go.id`, area **Kota Surabaya**.
- **Repo tidak punya berkas lisensi.**

### Pemetaan ke katalog Warungku

Sepuluh dari 30 barang katalog punya padanan:

| Barang Warungku | Komoditas MarketCast |
| --- | --- |
| Beras | Beras Medium |
| Gula Pasir | Gula Kristal Putih |
| Minyak Goreng | Minyak Goreng Kemasan Sederhana |
| Tepung Terigu | Terigu Protein Sedang (Kemasan) |
| Telur Ayam | Telur Ayam Ras |
| Ayam Potong | Daging Ayam Ras |
| Daging Sapi | Daging Sapi Paha Belakang |
| Bawang Merah | Bawang Merah |
| Cabai Merah | Cabe Merah Besar |
| Susu Kental Manis | Susu Kental Manis Merk Bendera |

Barang tanpa padanan (kopi, teh, susu UHT, kemasan, es batu, galon, dan lainnya)
tetap memakai harga sintetis: jalan acak dengan kenaikan sekitar laju inflasi.

### Cara memakainya

Yang dipakai **gerak relatifnya**, bukan angka rupiahnya:

```
harga_penawaran(d, p, t) = harga_acuan(p) × indeks_harga(d) × I_p(t)
I_p(t) = harga komoditas p minggu itu / rata-rata harga p di jendela simulasi
```

- Diperbarui **mingguan**, karena distributor memperbarui daftar harga per pekan,
  bukan per hari.
- Harga jual di nota tetap lengket (harga menu jarang berubah). Margin warung
  menyempit saat harga bahan melonjak, dan itu memang kenyataan yang ingin
  diperlihatkan.
- Mesin 2 mendapat fitur `p_rasio_harga` yang benar-benar bergerak, dan
  counterfactual memakai harga pada tanggal keputusan.
- Permintaan (Mesin 1) **tidak** diubah. Elastisitas harga di sisi permintaan
  adalah usulan terpisah kalau nanti dibutuhkan.

### Tiga masalah yang perlu diputuskan

1. **Lokasi.** Harganya harga Surabaya, sedangkan UMKM simulasi ada di DIY. Karena
   yang dipakai hanya gerak relatif, asumsinya adalah lonjakan harga pangan di
   Jawa bergerak bersama. Asumsi itu masuk akal, tapi tetap harus ditulis di
   laporan. Alternatif yang mencakup DIY adalah PIHPS Nasional (Bank Indonesia)
   atau Panel Harga Badan Pangan Nasional; ketersediaan dan syarat pakainya
   **belum saya periksa**.
2. **Rentang tanggal.** Data berhenti 2026-05-07, sedangkan simulasi berjalan
   2025-09-01 sampai 2026-10-05. Sebanyak 151 hari terakhir tidak tertutup data.
   Pilihannya: (a) minta Kadek memperbarui data sampai Oktober 2026 (disarankan),
   (b) geser jendela simulasi supaya berakhir 2026-05-07. Kalender SKB 2025–2027
   sudah ada, jadi Lebaran tetap benar, tapi demo aplikasi tidak lagi berakhir
   "hari ini". (c) Membekukan harga terakhir **tidak** disarankan, karena
   menciptakan lima bulan harga datar yang palsu.
3. **Izin.** Tanpa berkas lisensi, hak cipta olahan datanya ada di pemilik repo.
   Data mentahnya informasi publik pemerintah, tapi tetap minta izin Kadek dan
   cantumkan sumbernya. Sama seperti French Bakery, CSV-nya cukup disimpan di
   `data_nyata/` tanpa dilacak git.

---

## 3. Rencana adaptor UCI Online Retail II (Mesin 3)

**Hanya rencana.** Usulan ini masih berstatus Diusulkan di sheet baris 12.

### Datanya

- UCI Machine Learning Repository, dataset "Online Retail II": transaksi pengecer
  daring Inggris, Desember 2009 sampai Desember 2011, 1.067.371 baris, lisensi
  CC BY 4.0.
- Kolom: `Invoice, StockCode, Description, Quantity, InvoiceDate, Price,
  Customer ID, Country`. Nomor nota berawalan `C` adalah pembatalan.
- Banyak pelanggannya pedagang grosir, jadi hubungannya mirip distributor dengan
  UMKM.
- Disebar sebagai berkas Excel (setahu saya dua lembar, per tahun; dipastikan saat
  mengunduh). Dibaca sekali lalu disimpan sebagai CSV atau Parquet. Berkas
  datanya tidak dilacak git; aturan `.gitignore` perlu ditambah `*.xlsx`.

### Pembersihan

Mengikuti cara French Bakery: setiap keputusan ditulis dengan alasannya, dan
setiap baris yang dibuang dihitung dan dilaporkan.

- Baris tanpa `Customer ID` dibuang (sesuai kontrak), dan jumlahnya dilaporkan.
- Pembatalan mengurangi `monetary`, tapi tidak dihitung sebagai `frequency`.
- Kode non-barang (ongkos kirim, biaya bank, penyesuaian manual) dan harga ≤ 0
  dibuang.
- Baris kembar persis dibuang.
- Pesanan raksasa yang langsung dibatalkan saling meniadakan lewat aturan
  pembatalan, bukan dibuang manual.

### Pemetaan ke kontrak `rfm` (`KOLOM_RFM`)

| Kolom | Isi |
| --- | --- |
| `distributor_id` | 1 (satu pengecer) |
| `pelanggan_id` | `Customer ID` |
| `recency` | Hari sejak nota terakhir sampai tanggal acuan (sehari sesudah nota terakhir di data) |
| `frequency` | Banyaknya nota tidak batal |
| `monetary` | Jumlah bersih (Quantity × Price), dalam poundsterling |
| `lama_berlangganan` | Hari sejak nota pertama |
| `jenis_usaha` | **Tidak ada di data.** Usul: grosir/eceran dari median jumlah per baris, atau negara (Inggris/Eropa/lainnya). Perlu diputuskan |
| `kategori_utama` | **Tidak ada di data.** Usul: konstan "lainnya" dan dibuang sebelum K-Prototypes, seperti kolom kalender konstan di SARIMAX |

### Validasi yang diusulkan

Siluet saja tidak membuktikan segmen itu berguna. Diusulkan **validasi waktu**:
segmen dihitung dari data s.d. Desember 2010, lalu diuji apakah segmen yang
berbeda memang berperilaku berbeda di 2011 (peluang belanja lagi, nilai belanja).
Segmen yang tidak meramalkan apa pun berarti tidak berguna, berapa pun skor
siluetnya.

### Berkas dan uji

- `ml/sumber/online_retail.py`, didaftarkan di `TERSEDIA` (sekarang
  `muat` menolaknya dengan NotImplementedError).
- `data/data_nyata/online_retail_ii/README.md`: asal, lisensi, sidik SHA-256,
  dan keanehan data.
- Uji dengan CSV buatan kecil, seperti `uji/test_sumber.py` untuk French Bakery.
- Perkiraan setengah hari kerja, di luar waktu unduh.

---

## Urutan kerja yang disarankan

1. Putuskan usulan 3 lebih dulu. Ia tidak menyentuh pembangkit, bisa dikerjakan
   kapan saja, dan tidak membatalkan hasil siapa pun.
2. Putuskan usulan 1 dan 2 bersama, lalu catat parameternya di sheet **sebelum**
   pembangkit diubah.
3. Kerjakan pembangkit dan uji di basis data coba (`warungku_coba`). Bandingkan
   dengan skenario 8 distributor yang sekarang.
4. Satu kali regenerasi `warungku_dev`, dijadwalkan bersama sesi #1.1 dan #2.
   Hasil **ketiga** mesin sesudahnya harus diukur ulang. Mesin 1 juga ikut
   berubah, walau rumus permintaannya tidak disentuh. Ada dua sebab:
   - `simulasi()` memakai satu generator acak (`self.acak`) untuk permintaan,
     pemilihan distributor, dan hasil pesanan secara bergantian. Distributor
     yang lebih banyak menggeser seluruh tarikan permintaan sesudahnya.
   - Hari kehabisan stok, yaitu sensor di D1, bergantung pada keterlambatan
     kiriman, dan itu justru yang diubah usulan 1.

   Saran: sekalian pisahkan generator permintaan dari generator pesanan, seperti
   yang sudah dilakukan untuk nota. Regenerasi kali ini tetap mengubah D1, tapi
   perubahan pesanan berikutnya tidak lagi menggeser permintaan.
