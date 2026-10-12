# French Bakery Daily Sales

Data penjualan nyata satu toko roti di Prancis. Dipakai untuk **validasi metode
Mesin 1** (peramalan, MAPE, pencilan Mahalanobis, saringan barang), bukan sebagai
data aplikasi. Data aplikasi tetap dataset simulasi 70 UMKM di Postgres.

Setiap dataset dilatih dan diuji di dirinya sendiri. Parameter atau model hasil
data ini tidak pernah dipindah ke Warungku.

## Sumber dan lisensi

- Sumber: Kaggle, `matthieugimbert/french-bakery-daily-sales`
  (https://www.kaggle.com/datasets/matthieugimbert/french-bakery-daily-sales)
- Lisensi: "Data files © Original Authors". **Bukan lisensi terbuka.**
- Berkas `Bakery sales.csv` sengaja tidak dilacak git (lihat `.gitignore` di akar repo).
  Yang dilacak hanya README ini. Anggota tim yang butuh datanya mengunduh sendiri
  dari tautan di atas dan menaruhnya di folder ini dengan nama yang sama.
- Diterima dari Ilham pada 2026-10-10. SHA-256:
  `af5eede55b6eb2efb6bebb0e6dd1a51568c7eb73554d2f8ad2563081025681b2`

## Isi

| | |
| --- | --- |
| Baris | 234.005 |
| Rentang | 2021-01-02 sampai 2022-09-30 |
| Hari yang ada datanya | 600 dari 637 hari kalender |
| Nota unik | 136.451 |
| Jenis barang (`article`) | 149 |

| Kolom | Isi | Catatan |
| --- | --- | --- |
| (tanpa nama) | Indeks bawaan berkas asal | Tidak dipakai |
| `date` | Tanggal, `YYYY-MM-DD` | |
| `time` | Jam, `HH:MM` | |
| `ticket_number` | Nomor nota | Tertulis sebagai pecahan (`150040.0`); dibaca sebagai bilangan bulat |
| `article` | Nama barang | Huruf kapital, bahasa Prancis |
| `Quantity` | Jumlah | Ada nilai negatif, lihat di bawah |
| `unit_price` | Harga satuan | Teks berformat Eropa: `"0,90 €"`. Harus dibersihkan sebelum dihitung |

## Yang perlu diperhatikan sebelum dipakai

- **1.295 baris berjumlah negatif.** Kemungkinan retur atau pembatalan. Untuk
  menghitung permintaan, baris ini dijumlahkan dengan baris positif pada hari dan
  barang yang sama, bukan dibuang. Kalau dibuang, penjualan terlihat lebih tinggi
  daripada yang sebenarnya. Sesudah dijumlahkan, tidak ada barang-hari yang
  bersih negatif. 765 nota isinya hanya pengembalian; nota itu tidak dihitung
  sebagai pembeli.
- **37 hari tanpa data.** Hari tanpa satu nota pun kemungkinan hari toko tutup,
  bukan hari tanpa pembeli. 29 di antaranya hari Rabu (terutama Jan–Apr 2021
  dan Nov 2021–Feb 2022, tampaknya hari libur mingguan toko). Delapan sisanya:
  17, 18, dan 20 Mei 2021 (bersama Rabu 19 Mei, tampaknya libur sepekan),
  6–7 Desember 2021, 1 Januari 2022, 1 September dan 19 September 2022. Hari itu diperlakukan sebagai data hilang (NaN),
  dengan alasan yang sama seperti `stok_habis` di dataset simulasi. Kalau diisi
  nol, model akan belajar bahwa ada hari-hari tanpa permintaan sama sekali.
- **Tidak ada data stok.** Hari stok habis tidak bisa dibedakan dari hari tanpa
  pembeli. Ini batasan yang harus ditulis di laporan.
- **Tidak ada data pelanggan.** Jumlah nota per hari dipakai sebagai pendekatan
  jumlah pelanggan.
- **Kalender Prancis**, bukan Indonesia. Penanda gajian dan Ramadan tidak berlaku.
- **78 artikel pernah berganti harga.** Omset dihitung dari harga per baris,
  bukan harga tetap per artikel.

## Cara memakainya

Jangan membaca CSV ini langsung dari kode model. Pakai adaptornya, yang sudah
menerapkan semua keputusan di atas:

```python
from ml import sumber
deret = sumber.muat("french_bakery", bentuk="deret")
omset = sumber.muat("french_bakery", bentuk="omset")
```

Kontraknya di [`ml/sumber/README.md`](../../../ml/sumber/README.md).
