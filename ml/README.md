# Layanan model

Tiga mesin, satu layanan, satu lingkungan Python.

## Pasang

```bash
# dari folder backend/ — sama dengan lingkungan API, tidak ada venv kedua
python -m pip install -r requirements.txt
```

Sejak Mesin 1 beralih dari MOIRAI ke **Chronos-2**, lingkungan terpisah tidak
lagi wajib. `uni2ts` (pembungkus MOIRAI) memaku `scipy==1.11.4` yang tidak punya
wheel untuk Python 3.14; Chronos tidak memaku scipy sama sekali.

`.venv-ml` kini **opsional**, hanya untuk menjalankan MOIRAI sebagai satu baris
pembanding di laporan — lihat `requirements-ml.txt`.

Bobot model diunduh saat pertama dijalankan dan tersinggah di
`~/.cache/huggingface`. Perlu internet sekali.

## Jalankan layanannya

```bash
python -m uvicorn ml.layanan:app --port 8001
```

| Endpoint | Guna |
| --- | --- |
| `POST /mesin1/jalankan` | Perkiraan permintaan, tulis ke `prediksi`. Memblokir. |
| `POST /mesin1/jadwalkan` | Sama, tapi di latar. |
| `POST /mesin2/jalankan` | Skor distributor, tulis ke `rekomendasi_skor`. Tanpa `usaha_id` = seluruh usaha dengan satu kali pelatihan. |
| `POST /mesin3/jalankan` | Segmentasi pelanggan, tulis ke `segmen_pelanggan`. |
| `GET /jadwal` | Apa yang dijadwalkan, kapan berikutnya, hasil terakhirnya. |
| `GET /sehat` | Keadaan basis data dan jumlah baris keluaran tiap mesin. |

Penjadwal hidup di dalam proses ini: Mesin 1 jam 02.00 WIB, Mesin 2 dan 3 tiap
empat jam. Matikan dengan `WARUNGKU_JADWAL=0` kalau dijadwalkan dari luar.

## Jalankan percobaan

```bash
# Mesin 1 — perkiraan permintaan
python -m ml.mesin1.jalankan --chronos --json ml/hasil/hasil_mesin1.json
.venv-ml/Scripts/python -m ml.mesin1.jalankan --moirai     # pembanding, opsional

# Mesin 2 — simulasi regret berurutan (percobaan utama)
python -m ml.mesin2.jalankan_simulasi --bart --json ml/hasil/hasil_simulasi_mesin2.json

# Mesin 2 — evaluasi potret sesaat (pelengkap)
python -m ml.mesin2.jalankan --bandit

# Mesin 3 — segmentasi
python -c "from ml.mesin3.segmentasi import jalankan; print(jalankan())"

# Gambar untuk laporan
python -m ml.grafik
```

## Isi folder

| Berkas | Isi |
| --- | --- |
| `metrik.py` | MASE, WQL, cakupan, AUC, Brier, NDCG@k, Precision@1, sesal |
| `data.py` | Pemuat D1 & D2. Satu-satunya tempat yang tahu bentuk tabel |
| `grafik.py` | Gambar laporan, dibuat dari berkas hasil — bukan angka ketik ulang |
| `penjadwal.py` | APScheduler: jadwal harian ketiga mesin |
| `mesin1/dasar.py` | Naif musiman, kuantil hari-pekan, Holt-Winters, Croston |
| `mesin1/chronos.py` | **Chronos-2** — model utama |
| `mesin1/moirai.py` | MOIRAI — pembanding, perlu `.venv-ml` |
| `mesin1/evaluasi.py` | Uji ulang bergulir |
| `mesin2/bandit.py` | Lapis keputusan: Thompson, LinUCB, ε-greedy, greedy |
| `mesin2/penaksir.py` | **BART**, logistik Bayesian, LightGBM bootstrap |
| `mesin2/simulasi.py` | Simulasi regret berurutan 400 hari |
| `mesin2/keadaan.py` | Pemutar ulang keadaan distributor |
| `mesin2/evaluasi.py` | Evaluasi potret sesaat: ramalan dan keputusan |
| `mesin2/saran.py` | Jalur produksi: menulis `rekomendasi_skor` |
| `mesin3/kprototypes.py` | K-Prototypes (Huang 1998), ditulis sendiri |
| `mesin3/segmentasi.py` | RFM → kelompok → nama → `segmen_pelanggan` |

## Rancangan percobaan Mesin 2

Dua sumbu yang **sengaja dipisah**, karena mencampurnya membuat kemenangan
tidak bisa dijelaskan:

```
Sumbu kebijakan   penaksir dipegang tetap (logistik Bayesian)
                  greedy | ε-greedy | Thompson | LinUCB

Sumbu penaksir    kebijakan dipegang tetap (Thompson)
                  BART | logistik Bayesian | LightGBM bootstrap
```

Kalau keduanya diubah bersamaan, "BART+Thompson menang" tidak bisa dipecah
menjadi "BART-nya yang bagus" atau "Thompson-nya yang bagus".

## Empat hal yang harus diketahui sebelum membaca angkanya

**1. Lisensi bobot menentukan pilihan model, bukan hanya akurasi.** MOIRAI
(CC-BY-NC-4.0) dan Chronos-2 (Apache-2.0) sama-sama bisa diunduh tanpa akun dan
mutunya setara. Bedanya baru terasa kalau Warungku dijual: bobot MOIRAI tidak
boleh ikut, dan seluruh angka batas aman berasal dari situ.

**2. Hari kehabisan stok adalah data hilang, bukan permintaan nol.** Saat stok
kosong, penjualan tercatat nol padahal permintaannya tidak nol. Kalau nol itu
dilatihkan, model menyimpulkan barang paling laris adalah barang yang paling
sering kosong, lalu menyarankan stok lebih sedikit — kebalikan dari yang benar.
`permintaan_harian.stok_habis` menandainya, dan `data.py` mengubahnya jadi NaN.

**3. Thompson sampling butuh posterior, bukan tempelan.** Versi sebelumnya
(TabPFN) mencuplik Beta di sekitar peluang titik dengan "bukti" dikarang dari
banyaknya pesanan. Itu heuristik yang menyamar sebagai Thompson sampling: ia
tidak tahu apa-apa tentang seberapa yakin modelnya sendiri. BART memberi
posterior sungguhan, jadi cuplikannya memang cuplikan posterior.

**4. BART meramal lewat pohonnya, bukan lewat `pm.set_data`.** Memakai
`pm.set_data` + `sample_posterior_predictive` berjalan tanpa galat dan
mengembalikan ramalan yang **sama untuk masukan apa pun** — kami sempat
memakainya dan baru sadar setelah memeriksa angkanya. Jalur yang benar ada di
`penaksir.py`; jangan diganti.

## Catatan pemasangan

**PyMC tanpa kompiler C.** Kalau `g++` tidak ada, PyTensor mundur ke backend
yang lebih lambat tapi tetap benar. Pesan peringatannya muncul tiap impor dan
bisa diabaikan.

**Memori saat simulasi.** BART dilatih ulang belasan kali dalam satu simulasi,
dan tiap proses pekerja PyMC memuat BLAS-nya sendiri. Tanpa pembatasan utas,
Windows berhenti dengan *"The paging file is too small for this operation"* —
pesan yang sama sekali tidak menyinggung BLAS. `penaksir.py` membatasi utas BLAS
ke satu sebelum numpy dimuat; jangan dihapus.
