# Skrip SQL

Dijalankan langsung ke Postgres, tanpa Python. Ada supaya aturan data bisa
diperiksa oleh siapa pun di tim — termasuk saat yang menulis skrip Python-nya
sudah tidak di sini.

```bash
# dari folder backend/
docker exec -i warungku-db psql -U warungku -d warungku_dev < skrip/02_periksa_konsistensi.sql
```

| Berkas | Isi |
| --- | --- |
| `01_bangun_permintaan_harian.sql` | Membangun ulang tabel turunan `permintaan_harian` dari buku besar `pergerakan`. Aman diulang. |
| `02_periksa_konsistensi.sql` | Empat pemeriksaan; semuanya **harus** mengembalikan 0. |

## Kenapa ada dua jalur yang menulis `permintaan_harian`

Pembangkit dataset Python mengisinya langsung, dan skrip `01` bisa
membangunnya ulang dari buku besar. Itu bukan duplikasi yang kelupaan
dibersihkan — itu alat ujinya. Kalau dua jalur yang saling bebas menghasilkan
angka yang sama, definisi "permintaan" memang satu. Kalau berbeda, salah satu
dari keduanya bohong, dan pemeriksaan nomor 1 akan menyebutkan berapa barisnya.

## Yang masih menggantung

**Kalender nasional belum ada di basis data.** Tanggal merah dan rentang
Ramadan masih tertulis di `dataset/pola.py`, jadi hanya Python yang bisa
melihatnya. Akibatnya skrip `01` tidak bisa membangun ulang kolom `hari_libur`
dan `ramadan` — ia membiarkan nilai yang sudah ada. Selama dataset dibangkitkan
dari Python, ini tidak jadi masalah. Begitu data sungguhan masuk dan tabel
turunannya dibangun ulang oleh penjadwal SQL, kalender itu perlu pindah ke
tabel referensi (`hari_libur_nasional`) supaya satu sumber kebenaran tetap satu.
