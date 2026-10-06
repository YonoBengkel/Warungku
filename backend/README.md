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

# 3. isi dengan dataset simulasi (~245.000 baris, sekitar satu menit)
#    Perhatian: ini MENGOSONGKAN lalu mengisi ulang. Keluaran model
#    (`prediksi`, `rekomendasi_skor`) ikut terhapus lewat CASCADE, karena
#    angka model yang menunjuk barang yang sudah tidak ada memang harus
#    pergi. Jalankan ulang layanan model sesudahnya (langkah 7).
python -m dataset.buat_dataset

# 4. periksa datanya konsisten — keempatnya harus 0
docker exec -i warungku-db psql -U warungku -d warungku_dev < skrip/02_periksa_konsistensi.sql

# 5. uji otomatis
python -m pytest uji -q

# 6. API
python -m uvicorn api.utama:app --reload --port 8000

# 7. isi keluaran model (butuh lingkungan .venv-ml; lihat ml/README.md)
.venv-ml/Scripts/python -m uvicorn ml.layanan:app --port 8001
curl -X POST localhost:8001/mesin1/jalankan -H "Content-Type: application/json" -d '{"metode":"holt_winters"}'
curl -X POST localhost:8001/mesin2/jalankan -H "Content-Type: application/json" -d '{"usaha_id":1}'
```

Lingkungan layanan model dipasang terpisah; lihat [`ml/README.md`](ml/README.md).

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

Daftar ini ada supaya tidak ada yang menyangka bagian ini sudah selesai:

- **Otentikasi.** Tidak ada login, tidak ada token, tidak ada pemeriksaan hak.
  Setiap endpoint menerima `usaha_id` dari URL dan mempercayainya. Jangan
  dipasang ke internet dalam keadaan ini.
- **Endpoint portal distributor.** Tabelnya lengkap, endpointnya belum.
- **Penjadwal.** `/mesin1/jadwalkan` dan `/mesin2/jalankan` ada, tapi tidak ada
  yang memanggilnya setiap hari. Sekarang harus dipanggil tangan.
- **Kalender nasional di basis data.** Masih di `dataset/pola.py`, jadi hanya
  Python yang bisa melihatnya. Lihat [`skrip/README.md`](skrip/README.md).
