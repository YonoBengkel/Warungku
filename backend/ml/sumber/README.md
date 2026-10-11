# `ml/sumber/` — satu pintu untuk semua sumber data model

```python
from ml import sumber

deret = sumber.muat("simulasi", bentuk="deret")          # list[DeretBarang]
omset = sumber.muat("french_bakery", bentuk="omset")     # DataFrame
rfm   = sumber.muat("simulasi", bentuk="rfm")            # DataFrame
```

Kontrak ini disepakati sesi Data (Warungku #1.2) dan sesi Model (Warungku #1.1)
pada 10 Okt 2026. Mengubahnya berarti mengabari sesi yang lain dulu, lalu
mencatat perubahannya di sheet "Model Warungku", tab Catatan Perubahan.

## Kenapa ada folder ini

Data simulasi (70 UMKM, Postgres) menjalankan aplikasi. Data nyata hanya untuk
**validasi metode**: tiap dataset dilatih dan diuji di dirinya sendiri, dan
tidak ada parameter atau model yang dipindah ke Warungku. Supaya kode model
sama persis untuk kedua jenis data, perbedaan bentuk tabelnya dihabisi di sini.
Skema basis data, API, dan antarmuka tidak berubah.

Kode model tidak membaca tabel atau berkas sendiri. Kalau tiap percobaan punya
cara mengambil data sendiri, beda hasil antar model tercampur dengan beda cara
mengambil datanya.

## Sumber dan bentuk yang tersedia

| | `deret` | `omset` | `rfm` | `pesanan`, `counterfactual` |
| --- | --- | --- | --- | --- |
| `simulasi` | ya | ya | ya | ya |
| `french_bakery` | ya | ya | tidak (tidak ada data pelanggan) | tidak (Mesin 2 hanya di simulasi) |
| `online_retail` | belum: usulannya masih Diusulkan | | | |

Bentuk yang tidak tersedia ditolak dengan pesan yang menyebut alasannya.

## Bentuk `deret` — Mesin 1 per barang

`list[DeretBarang]` dari [`ml/data.py`](../data.py), bentuk yang sama untuk
semua sumber. Satu deret per barang, tanggal lengkap tanpa bolong.

- `nilai` NaN berarti **tidak tahu**, bukan nol: hari stok habis (simulasi,
  sensor permintaan) atau hari toko tutup (French Bakery).
- `harga_satuan` (ditambah 10 Okt 2026, atas permintaan sesi Model untuk
  saringan ABC): harga per satuan dasar, supaya barang bersatuan gram, ml, dan
  pcs bisa ditimbang bersama. Simulasi: harga beli terakhir dibagi isi kemasan.
  French Bakery: median harga jual artikel (tidak ada harga beli); dua artikel
  yang harganya selalu nol berisi None.
- French Bakery: satu deret per artikel (149), panjang 637 hari. Hari toko buka
  tapi artikel tidak terjual = 0. `stok_habis` selalu False karena tidak ada
  data stok. `barang_id` = urutan abjad nama artikel, mulai 1. Opsi
  `min_hari_laku` membuang artikel yang terjual di kurang dari sekian hari
  (bawaan 0: semua ikut, karena penyaringan barang bagian metode di sisi model).

## Bentuk `omset` — Mesin 1 multivariat

DataFrame, satu baris per entitas per hari, tanggal lengkap. Kolomnya tepat
berurutan:

| Kolom | Tipe | Isi |
| --- | --- | --- |
| `entitas_id` | int | Simulasi: `usaha_id`. French Bakery: 1 |
| `tanggal` | datetime64 | |
| `omset` | float | Uang yang benar-benar masuk (rupiah / euro) |
| `jumlah_barang` | float | Volume barang, lihat catatan di bawah |
| `jumlah_nota` | float | Banyaknya nota, pendekatan jumlah pembeli |
| `libur` | bool | Hari libur nasional negara sumbernya |
| `pekan_gajian` | bool | Simulasi saja; French Bakery False seluruhnya |
| `ramadan` | bool | Simulasi saja; French Bakery False seluruhnya |
| `lebaran` | bool | Dua hari Idulfitri, saat hampir semua warung tutup (simulasi: definisi yang sama dengan pembangkit, `dataset/kalender.LEBARAN`). Lonjakan tujuh hari menjelangnya ada di dalam `ramadan`. French Bakery False seluruhnya |
| `data_hilang` | bool | Toko tutup / tanpa catatan. Angka di baris ini NaN |
| `stok_habis_parsial` | float | Banyaknya barang yang kehabisan stok hari itu. French Bakery: NaN |

Aturannya, ditegakkan `periksa_omset` setiap kali `muat` dipanggil:

- **Stok habis tidak membuat omset hilang.** Omset adalah uang yang benar-benar
  masuk. `data_hilang` hanya untuk hari toko tutup atau tanpa catatan.
- Baris `data_hilang=True` berisi NaN di `omset`, `jumlah_barang`, `jumlah_nota`;
  baris lain tidak boleh NaN dan tidak boleh negatif.
- `jumlah_barang` dan `jumlah_nota` **endogen**: tidak diketahui ke depan, jadi
  hanya bisa diramal bersama omset (VAR/MARIMA), bukan jadi exog SARIMAX. Exog
  yang sah hanya kalender.
- **Buang kolom kalender yang konstan sebelum dipakai sebagai exog.** Untuk
  French Bakery, `pekan_gajian`, `ramadan`, dan `lebaran` False seluruhnya;
  kolom konstan membuat matriks exog SARIMAX singular.

`jumlah_barang` artinya berbeda per sumber, karena hanya ini yang bermakna di
masing-masing (tiap dataset diuji di dirinya sendiri, jadi tidak pernah
dibandingkan lintas sumber):

| Sumber | `jumlah_barang` | `jumlah_nota` |
| --- | --- | --- |
| `simulasi` | Banyaknya baris nota. Satuan dasar barang berbeda-beda (gram, ml, pcs), jadi jumlahnya tidak bisa dijumlah | Banyaknya nota tidak batal |
| `french_bakery` | Potong bersih: Quantity dijumlah, pengembalian mengurangi | Nota dengan jumlah bersih positif. 765 nota yang isinya hanya pengembalian tidak dihitung |

## Bentuk `rfm` — Mesin 3

DataFrame, satu baris per pasangan distributor–pelanggan:
`distributor_id, pelanggan_id, recency, frequency, monetary, lama_berlangganan,
jenis_usaha, kategori_utama`. Di simulasi `pelanggan_id = usaha_id`, dihitung
oleh `muat_rfm` Mesin 3; `attrs["tanggal_acuan"]` ikut dibawa.

## Bentuk `pesanan` dan `counterfactual` — Mesin 2

Simulasi saja, meneruskan `muat_fitur_pesanan()` dan `muat_counterfactual()`
dari `ml/data.py`. Kurva regret butuh matriks counterfactual, dan itu tidak
pernah ada di data nyata.

## Sumber simulasi: dari mana omset datang

Omset dan jumlah nota dihitung dari nota kasir (`transaksi`, `transaksi_baris`),
yang sejak 10 Okt 2026 dibangkitkan untuk seluruh 400 hari lengkap dengan harga
jual. Asumsi harga jual, belanja per nota, dan jam ramai ada di
[`dataset/nota.py`](../../dataset/nota.py). Nota hanya merinci penjualan di buku
besar, tidak mengubahnya: pemeriksaan nomor 5 di
`skrip/02_periksa_konsistensi.sql` membuktikannya.

Batas yang perlu ditulis di laporan: pemetaan menu masih 1:1, jadi harga jual
adalah harga per satuan dasar bahan, dan omset simulasi = nilai jual bahan yang
terpakai. Harga jual tetap sepanjang 400 hari.

## Sumber French Bakery

Berkas, lisensi, dan keanehan datanya: [`data_nyata/french_bakery/README.md`](../../data_nyata/french_bakery/README.md).
Berkas CSV tidak dilacak git; kalau belum ada, `muat` memberi tahu dari mana
mengunduhnya. Berkas yang sidik SHA-256-nya berbeda dari yang tercatat tetap
dibaca, dengan peringatan bahwa hasilnya tidak sebanding dengan angka yang
sudah dilaporkan.

## Uji

```bash
python -m pytest uji/test_sumber.py -q
```

Uji French Bakery memakai CSV buatan kecil, jadi jalan tanpa data aslinya. Uji
`omset` simulasi butuh Postgres yang sudah diisi pembangkit, dan dilewati kalau
basis data tidak tersedia.
