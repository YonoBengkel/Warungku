# Layanan model

Tiga mesin, satu layanan (FastAPI, port 8001), satu lingkungan Python. Semua
perintah di bawah dijalankan dari **akar repo**; pemasangan lengkap ada di
[README akar](../README.md).

| Mesin | Model produksi | Berkas | Pembanding di laporan |
| --- | --- | --- | --- |
| 1 · ramalan kebutuhan | SARIMA(1,0,1)(0,1,1)₇ pada log1p unit, kalender sebagai peubah luar; cadangan ETS kalau gagal per barang | `mesin1/sarima.py` | ETS, Chronos-2, LightGBM, naif musiman, kuantil hari-pekan, MOIRAI |
| 2 · saran distributor | Beta-Bernoulli + Thompson sampling, lalu fuzzy Sugeno atas keandalan dan harga | `mesin2/beta.py`, `mesin2/fuzzy.py`, `mesin2/saran.py` | TOPSIS, BART, regresi logistik Bayesian, LinUCB, epsilon-greedy |
| 3 · profil pelanggan | K-Prototypes atas RFM (frequency dan monetary di-log1p), jenis usaha, kategori | `mesin3/segmentasi.py`, `mesin3/kprototypes.py` | Gower + aglomeratif, Gower + HDBSCAN |

Metode Mesin 1 dipilih lewat variabel `WARUNGKU_METODE_MESIN1` (bawaan `sarima`;
juga `holt_winters`, `chronos`, `moirai`, `naif_musiman`, `kuantil_hari_pekan`).

## Pasang

```bash
python -m pip install -r requirements.txt
python -m pip install -e . --no-deps
```

`.venv-ml` (Python 3.12, `ml/requirements-ml.txt`) hanya dibutuhkan untuk
menjalankan MOIRAI sebagai pembanding: `uni2ts` memaku `scipy==1.11.4` yang tidak
punya wheel untuk Python 3.14.

Bobot Chronos-2 diunduh saat pertama dipakai dan tersinggah di
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
python -m ml.mesin1.jalankan_turnamen --json ml/hasil/hasil_mesin1_turnamen.json   # turnamen gaya MarketCast
python -m ml.eksperimen.mesin1_cakupan                                            # cakupan p10–p90 SARIMA vs ETS
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
| `layanan.py` | FastAPI port 8001; memanggil model produksi dan menulis hasilnya ke tabel |
| `penjadwal.py` | APScheduler: Mesin 1 pukul 02.00 WIB, Mesin 2 dan 3 tiap empat jam |
| `data.py` | Pemuat D1 dan D2 dari basis data; satu-satunya tempat yang tahu bentuk tabel |
| `sumber/` | Satu pintu data untuk model: simulasi dan French Bakery dalam bentuk yang sama. Kontraknya di `sumber/README.md` |
| `metrik.py` | MAPE, WAPE, MASE, WQL, cakupan, AUC, Brier, NDCG@k, Precision@1, regret |
| `grafik.py` | Gambar laporan, dibuat dari berkas hasil, bukan angka ketik ulang |
| `mesin1/sarima.py` | **SARIMA, model produksi**: kuantil p10/p50/p90 dan kalender masa depan |
| `mesin1/dasar.py` | Naif musiman, kuantil hari-pekan, Holt-Winters (ETS), Croston |
| `mesin1/saringan.py`, `pencilan.py` | Saringan barang (ABC, Syntetos–Boylan, musiman) dan pencilan Mahalanobis |
| `mesin1/pekanan.py`, `omset.py` | Evaluasi MAPE pekanan per barang dan ramalan omset (SARIMAX, VAR) |
| `mesin1/turnamen.py`, `turnamen_omset.py` | Turnamen gaya MarketCast: kelompok barang, juara per kelompok |
| `mesin1/chronos.py`, `moirai.py` | Model fondasi sebagai pembanding (MOIRAI perlu `.venv-ml`) |
| `mesin2/beta.py` | **Beta-Bernoulli, penaksir produksi**: dua hitungan per distributor |
| `mesin2/fuzzy.py` | **Fuzzy Sugeno 3×3, lapis harga produksi**: keandalan dan rasio harga menjadi segmen |
| `mesin2/bandit.py` | Lapis keputusan: Thompson, LinUCB, epsilon-greedy, greedy |
| `mesin2/penaksir.py` | BART, logistik Bayesian, LightGBM bootstrap (pembanding) |
| `mesin2/simulasi.py`, `keadaan.py` | Simulasi regret berurutan 400 hari dan pemutar ulang keadaan distributor |
| `mesin2/saran.py` | Jalur produksi: menulis `rekomendasi_skor` |
| `mesin3/kprototypes.py` | K-Prototypes (Huang 1998), ditulis sendiri |
| `mesin3/segmentasi.py` | RFM → kelompok → nama → `segmen_pelanggan` |
| `eksperimen/` | Percobaan penyetelan Mesin 1, 2, 3 yang tidak mengubah kode produksi |
| `hasil/` | `hasil_*.json` dilacak git; log percobaan tidak |
| `uji/` | Uji otomatis model (`python -m pytest -q` dari akar repo) |

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
