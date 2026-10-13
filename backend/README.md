# Backend Turnify Flow

API baca-tulis dan lapisan basis data. Layanan model ada di [`../ml/`](../ml/),
pembangkit dataset di [`../data/`](../data/). Cara memasang dan menjalankan
seluruh proyek ada di [README akar](../README.md); semua perintah dijalankan dari
**akar repo**.

| Bagian | Isi |
| --- | --- |
| `api/` | Endpoint REST (FastAPI, port 8000): otentikasi, gudang, nota kasir, portal distributor |
| `warungku/` | Model tabel (SQLModel), enum, koneksi, pengaturan. Nama paket internal, belum diganti |
| `migrations/` | Migrasi Alembic; jalankan dengan `python -m alembic -c backend/alembic.ini upgrade head` |
| `skrip/` | SQL pemeliharaan dan pemeriksaan konsistensi |
| `uji/` | Uji API (otentikasi, nota kasir). Uji model ada di `../ml/uji/` |
| `.env` | Alamat basis data dan layanan model; salin dari `.env.example` |

Aturan yang memisahkan `api` dan `ml`: **layanan model menulis ke tabel, API
membaca tabel.** API tidak pernah memanggil model saat halaman dibuka. Kalau
layanan model mati, portal tetap terbuka dengan angka terakhir yang tersimpan,
dan kolom `tingkat_layanan` menyatakan apa adanya bahwa angkanya tidak segar.

`warungku/konfigurasi.py` memuat `backend/.env` dengan jalur pasti, jadi folder
kerja tidak berpengaruh. Variabel yang sudah diset di lingkungan tetap menang.

Akun contoh di dataset simulasi memakai kata sandi `warungku123`, seluruhnya.
Itu data simulasi, bukan data orang.

## Kenapa port 5433

PostgreSQL yang mungkin sudah berjalan di komputer anggota tim memakai 5432.
Memakai port yang sama berarti setiap orang harus mematikan Postgres-nya
sendiri dulu, atau — lebih buruk — menyangka sudah terhubung ke basis data
proyek padahal terhubung ke miliknya.

## Tiga aturan angka

Berlaku di seluruh tabel, dijaga oleh pembantu kolom di
[`warungku/model/dasar.py`](warungku/model/dasar.py):

1. **Uang adalah bilangan bulat rupiah** (`BIGINT`). Tidak ada sen di
   Indonesia, dan `FLOAT` untuk uang cepat atau lambat menghasilkan
   Rp 148.000,00000001 di layar pemilik warung.
2. **Jumlah barang adalah `NUMERIC(14,3)`**, bukan `FLOAT`. Stok bisa 3,4 kg,
   dan pembulatan biner akan membuat penjumlahan buku besar tidak pernah pas.
3. **Jumlah selalu dalam satuan dasar** (gram, ml, pcs). "kg" dan "liter" hanya
   lapisan tampilan; tidak pernah ada angka bersatuan tampil di kolom numerik.

## Invarian buku besar

```
stok barang == jumlah seluruh baris pergerakan barang itu
```

`barang.stok` adalah nilai berjalan — ia ada supaya layar tidak perlu menjumlah
ribuan baris tiap kali dibuka. Nilai berjalan hanya boleh ada kalau ada yang
menjaganya. Penjaganya ada di [`api/gudang.py`](api/gudang.py), dan yang
memeriksa penjaganya bekerja ada di
[`skrip/02_periksa_konsistensi.sql`](skrip/02_periksa_konsistensi.sql) dan
[`uji/test_struk.py`](uji/test_struk.py).

## Yang belum ada

Daftar ini ada supaya tidak ada yang menyangka bagian ini sudah selesai.

**Ditunda atas keputusan tim:**

- **Konektor POS sumber terbuka.** Kontraknya sudah ada — `transaksi`,
  `transaksi_baris`, kunci idempotensi, dan endpoint `POST /usaha/{id}/transaksi`
  yang teruji. Konektor ke POS tertentu belum dibuat, sesuai keputusan: kontrak
  dulu, konektor belakangan.
- **Resep berbilang bahan.** Struktur tabelnya ada (`pemetaan_menu_bahan` dengan
  kolom `takaran`), tetapi dataset mengisinya 1:1 sesuai keputusan.
- **`kendala` dan keranjang sisi server.**
- **OTP WhatsApp.** Kolom `nomor_hp` sudah siap; jalurnya belum dibangun. Yang
  dipakai sekarang email dan kata sandi.

**Belum dikerjakan:**

- **Penyegaran token.** Token berumur 12 jam dan tidak bisa diperpanjang; sesudah
  itu harus masuk lagi. Cukup untuk demo, merepotkan untuk pemakaian harian.
- **Data warung sungguhan.** Seluruh angka di laporan berasal dari simulasi yang
  kami rancang sendiri. Satu bulan data kasir nyata dari satu warung akan
  mengubah laporan dari "kerangkanya jalan" menjadi "modelnya terbukti", dan
  kerangkanya sudah siap menerimanya.

**Batas yang perlu diingat saat membaca angka:** pembangkit dataset menghasilkan
permintaan dengan bentuk yang hampir persis diasumsikan Holt-Winters, dan
kamilah yang membuat distributor termurah menjadi yang terburuk. Keduanya
menguntungkan kesimpulan yang kami laporkan, dan itu disebut terus terang di
[`docs/laporan/`](../docs/laporan/).
