# Backend Warungku

Tiga bagian yang sengaja dipisah:

| Bagian | Isi | Lingkungan |
| --- | --- | --- |
| `warungku/` | Model tabel (SQLModel), enum, koneksi | Python 3.14 |
| `api/` | Layanan baca-tulis basis data | Python 3.14 |
| `ml/` | Layanan model: Mesin 1 & Mesin 2 | **Python 3.12** |
| `dataset/` | Pembangkit dataset simulasi | Python 3.14 |
| `skrip/` | SQL pemeliharaan & pemeriksaan | psql |
| `uji/` | Uji otomatis | Python 3.14 |

Aturan yang memisahkan `api` dan `ml`: **layanan model menulis ke tabel, API
membaca tabel.** API tidak pernah memanggil model saat halaman dibuka. Kalau
layanan model mati, portal tetap terbuka dengan angka terakhir yang tersimpan,
dan kolom `tingkat_layanan` menyatakan apa adanya bahwa angkanya tidak segar.

## Mulai dari nol

```bash
# 1. basis data
docker compose up -d

# 2. lingkungan utama
python -m pip install -r requirements.txt
cp .env.example .env
python -m alembic upgrade head

# 3. isi dengan dataset simulasi (~5,8 juta baris, 5 juta di antaranya nota kasir)
#    Perhatian: ini MENGOSONGKAN lalu mengisi ulang. Keluaran model
#    (`prediksi`, `rekomendasi_skor`, `segmen_pelanggan`) ikut terhapus lewat
#    CASCADE, karena angka model yang menunjuk barang yang sudah tidak ada
#    memang harus pergi. Jalankan ulang ketiga mesin sesudahnya (langkah 7).
python -m dataset.buat_dataset

# 4. periksa datanya konsisten — keenamnya harus 0
docker exec -i warungku-db psql -U warungku -d warungku_dev < skrip/02_periksa_konsistensi.sql

# 5. uji otomatis
python -m pytest -q

# 6. API
python -m uvicorn api.utama:app --reload --port 8000

# 7. layanan model — lingkungan yang sama, tidak ada venv kedua
python -m uvicorn ml.layanan:app --port 8001
curl -X POST localhost:8001/mesin1/jalankan -H "Content-Type: application/json" -d "{}"
curl -X POST localhost:8001/mesin2/jalankan -H "Content-Type: application/json" -d "{}"
curl -X POST localhost:8001/mesin3/jalankan
```

Penjadwal menyala sendiri bersama layanan model: Mesin 1 jam 02.00 WIB, Mesin 2
dan 3 tiap empat jam. Rinciannya di [`ml/README.md`](ml/README.md).

Akun contoh memakai kata sandi `warungku123` — seluruhnya. Itu data simulasi,
bukan data orang.

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
- **Dockerfile `api` dan `ml`.** Hanya basis data yang di kontainer. Keduanya
  jalan sebagai dua perintah uvicorn. Ini sengaja: proyeknya didemokan di
  laptop, dan Dockerfile yang tidak pernah diuji lebih buruk daripada tidak ada.

**Belum dikerjakan:**

- **Aksi distributor.** Endpoint portal distributor baru bisa membaca — pesanan
  masuk, ringkasan segmen, anggota segmen. Menerima, menolak, dan menandai
  pengiriman belum ada.
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
[`laporan/`](../laporan/).
