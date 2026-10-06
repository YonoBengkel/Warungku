# Layanan model

Dua mesin, satu layanan, lingkungan Python sendiri.

## Pasang

```bash
# dari folder backend/
py -3.12 -m venv .venv-ml
.venv-ml/Scripts/python -m pip install -r requirements-ml.txt
```

**Kenapa Python 3.12 dan bukan 3.14.** `uni2ts` (pembungkus MOIRAI) memaku
`scipy==1.11.4`, dan scipy versi itu tidak punya wheel untuk Python 3.14 — pip
mencoba mengkompilasinya dari sumber dan berhenti di `Compiler cython cannot
compile programs`. Pemisahan lingkungan ini bukan kerapian; ia syarat supaya
kodenya jalan sama sekali. Dan justru inilah yang membuat rancangan dua
layanan (`api` dan `ml`) terbukti perlu, bukan sekadar enak digambar.

Bobot model diunduh saat pertama dijalankan (~100 MB untuk MOIRAI `small`,
~250 MB untuk TabPFN) dan tersinggah di `~/.cache/huggingface`.

## Jalankan perbandingan

```bash
# Mesin 1 — perkiraan permintaan
.venv-ml/Scripts/python -m ml.mesin1.jalankan                      # garis dasar saja
.venv-ml/Scripts/python -m ml.mesin1.jalankan --moirai             # ikut MOIRAI small
.venv-ml/Scripts/python -m ml.mesin1.jalankan --moirai --ukuran base

# Mesin 2 — saran distributor
TABPFN_ALLOW_CPU_LARGE_DATASET=1 \
  .venv-ml/Scripts/python -m ml.mesin2.jalankan --tabpfn
```

## Jalankan layanannya

```bash
.venv-ml/Scripts/python -m uvicorn ml.layanan:app --port 8001
```

| Endpoint | Guna |
| --- | --- |
| `POST /mesin1/jalankan` | Jalankan Mesin 1, tulis ke `prediksi`. Memblokir. |
| `POST /mesin1/jadwalkan` | Sama, tapi di latar. Jalur penjadwal harian. |
| `POST /mesin2/jalankan` | Nilai kandidat distributor, tulis ke `rekomendasi_skor`. |
| `GET /sehat` | Keadaan layanan + kapan perkiraan terakhir dibuat. |

## Isi folder

| Berkas | Isi |
| --- | --- |
| `metrik.py` | MASE, WQL, cakupan, AUC, Brier, NDCG@k, Precision@1, sesal |
| `data.py` | Pemuat D1 & D2. Satu-satunya tempat yang tahu bentuk tabel |
| `mesin1/dasar.py` | Naif musiman, kuantil hari-pekan, Holt-Winters, Croston |
| `mesin1/moirai.py` | MOIRAI lewat predictor GluonTS, berkelompok |
| `mesin1/evaluasi.py` | Uji ulang bergulir |
| `mesin2/dasar.py` | Termurah, TOPSIS, rerata sejarah, regresi logistik, LightGBM |
| `mesin2/tabpfn_mesin.py` | TabPFN + pencuplikan Thompson |
| `mesin2/keadaan.py` | Pemutar ulang keadaan distributor (perakit fitur kandidat) |
| `mesin2/evaluasi.py` | Evaluasi dua lapis: ramalan dan keputusan |
| `mesin2/saran.py` | Mesin 2 saat dipakai sungguhan: menulis `rekomendasi_skor` |

## Dua hal yang harus diketahui sebelum membaca angkanya

**1. TabPFN tidak "zero-shot".** Catatan di `Chat#3.txt` menyebut TabPFN bekerja
tanpa data berlabel. Itu tidak benar. Ia melakukan *in-context learning*: tidak
ada tahap pelatihan, tidak ada gradien, tidak ada hiperparameter untuk ditala —
tapi ia **wajib diberi tabel contoh berlabel pada setiap inferensi**. Akibatnya:
tidak ada berkas model yang bisa dipasang, ada batas ukuran tabel, dan masalah
awal-dingin tidak hilang. Rinciannya di `mesin2/tabpfn_mesin.py`.

**2. Hari kehabisan stok adalah data hilang, bukan permintaan nol.** Saat stok
kosong, penjualan tercatat nol padahal permintaannya tidak nol. Kalau nol itu
dilatihkan, model menyimpulkan barang paling laris adalah barang yang paling
sering kosong, lalu menyarankan stok lebih sedikit — persis kebalikan dari yang
benar. Kolom `permintaan_harian.stok_habis` menandainya, dan `data.py` mengubah
hari itu menjadi NaN sebelum sampai ke model mana pun.
