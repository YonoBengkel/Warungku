"""
Mesin 1 dengan MOIRAI (Salesforce), model pondasi deret waktu.

Alasan memilihnya: MOIRAI meramal **tanpa dilatih** pada data kita. Itu cocok
dengan keadaan sebenarnya di lapangan — warung yang baru mendaftar hanya punya
riwayat beberapa pekan, dan melatih satu model per barang untuk 280 barang
berarti 280 model yang harus dipelihara, ditala, dan dijelaskan.

Yang perlu diketahui sebelum menaruh harapan:

* MOIRAI berjalan di lingkungan Python-nya sendiri (`.venv-ml`). `uni2ts`
  memaku `scipy==1.11.4` yang tidak punya wheel untuk Python 3.14, dan
  memaksakannya berarti mengkompilasi scipy dari sumber. Pemisahan lingkungan
  ini bukan kerapian — ia syarat supaya kodenya bisa jalan sama sekali, dan
  justru itu yang membuat rancangan dua layanan (`api` dan `ml`) terbukti
  perlu, bukan sekadar enak di diagram.
* Bobotnya diunduh dari HuggingFace saat pertama dijalankan (~100 MB untuk
  ukuran `small`). Perlu internet sekali; sesudahnya tersinggah di
  `~/.cache/huggingface`.
* Keluaran MOIRAI adalah **cuplikan**, bukan kuantil. Kuantil dihitung dari
  cuplikan itu. Jumlah cuplikan menentukan ketelitian p90: terlalu sedikit dan
  batas amannya ikut berderau dari satu kali jalan ke kali berikutnya.
"""

from __future__ import annotations

import numpy as np

from ..data import DeretBarang

TARAF = (0.1, 0.5, 0.9)

#: Panjang riwayat yang diberikan ke model. MOIRAI menerima konteks panjang,
#: tapi memberinya seluruh 400 hari membuat inferensinya lambat tanpa
#: menambah apa pun: pola yang menentukan permintaan harian ada di beberapa
#: bulan terakhir.
PANJANG_KONTEKS = 200

#: Cuplikan per ramalan. 100 cukup untuk p10/p50/p90; p99 akan butuh lebih.
CUPLIKAN = 100

_singgahan: dict[str, object] = {}

#: Tanggal awal palsu untuk indeks GluonTS. MOIRAI 1.1-R tidak memakai tanggal
#: kalender sebagai fitur — yang dipakai hanya frekuensinya (harian). Jadi
#: tanggal mana pun boleh, selama frekuensinya benar dan jaraknya tetap.
EPOCH = "2000-01-01"


def _muat(ukuran: str = "small", cakrawala: int = 30, kelompok: int = 16):
    """
    Muat MOIRAI sekali saja, lalu singgah.

    Tanpa singgahan, uji ulang 260 deret x 3 titik asal akan memuat bobotnya
    780 kali — dan waktu muat jauh lebih besar daripada waktu inferensinya,
    sehingga perbandingan kecepatan antar metode jadi tidak ada artinya.

    Dipakai `create_predictor()` dari GluonTS, bukan `model(...)` langsung.
    Memanggil modulnya langsung dengan `patch_size="auto"` masuk ke jalur
    pemilihan patch yang mengharapkan bentuk tensor berbeda dan gagal dengan
    pesan tentang ukuran tensor yang tidak cocok — jalur yang didokumentasikan
    adalah predictor, dan ia yang mengurus pemilihan patch itu sendiri.
    """
    kunci = "%s-%d-%d" % (ukuran, cakrawala, kelompok)
    if kunci in _singgahan:
        return _singgahan[kunci]

    import torch
    from uni2ts.model.moirai import MoiraiForecast, MoiraiModule

    modul = MoiraiModule.from_pretrained("Salesforce/moirai-1.1-R-%s" % ukuran)
    model = MoiraiForecast(
        module=modul,
        prediction_length=cakrawala,
        context_length=PANJANG_KONTEKS,
        patch_size="auto",
        num_samples=CUPLIKAN,
        target_dim=1,
        feat_dynamic_real_dim=0,
        past_feat_dynamic_real_dim=0,
    )
    torch.set_num_threads(max(1, torch.get_num_threads()))
    peramal = model.create_predictor(batch_size=kelompok)
    _singgahan[kunci] = peramal
    return peramal


def _potong(deret: DeretBarang, akhir_latih: int) -> np.ndarray:
    return deret.terisi[max(0, akhir_latih - PANJANG_KONTEKS) : akhir_latih]


def _kuantil(cuplikan: np.ndarray) -> dict[float, np.ndarray]:
    c = np.maximum(np.asarray(cuplikan, dtype=float), 0.0)  # permintaan tak negatif
    k = {t: np.quantile(c, t, axis=0) for t in TARAF}
    tumpuk = np.maximum.accumulate(np.vstack([k[t] for t in TARAF]), axis=0)
    return {t: tumpuk[i] for i, t in enumerate(TARAF)}


def ramal_banyak(
    tugas: list[tuple[DeretBarang, int]],
    cakrawala: int,
    ukuran: str = "small",
    kelompok: int = 16,
) -> list[dict[float, np.ndarray]]:
    """
    Ramal banyak jendela dalam satu kali jalan.

    Ini jalur yang dipakai saat uji ulang. Memanggil model sekali per jendela
    membuat MOIRAI tampak puluhan kali lebih lambat daripada sebenarnya:
    biayanya bukan pada hitungannya, tapi pada memanggil model dengan kelompok
    berukuran satu. Perbandingan kecepatan yang dilaporkan harus mengukur cara
    model itu memang akan dipakai — sekali sehari, untuk semua barang.
    """
    import pandas as pd

    peramal = _muat(ukuran, cakrawala, kelompok)
    bingkai = {}
    for i, (d, akhir) in enumerate(tugas):
        v = _potong(d, akhir)
        bingkai[str(i)] = pd.DataFrame(
            {"target": v}, index=pd.date_range(EPOCH, periods=len(v), freq="D")
        )

    from gluonts.dataset.pandas import PandasDataset

    ds = PandasDataset(bingkai, target="target")
    # Urutan keluaran predictor mengikuti urutan dataset; kuncinya tetap
    # dibaca dari item_id supaya kalau asumsi itu berubah, hasilnya tidak
    # tertukar diam-diam antar barang.
    hasil: dict[int, dict[float, np.ndarray]] = {}
    for f in peramal.predict(ds):
        hasil[int(f.item_id)] = _kuantil(f.samples)
    return [hasil[i] for i in range(len(tugas))]


def ramal_moirai(
    deret: DeretBarang, akhir_latih: int, cakrawala: int, ukuran: str = "small"
) -> dict[float, np.ndarray]:
    """
    Satu ramalan MOIRAI, dikembalikan sebagai kuantil.

    Diberi deret `terisi`, bukan yang bersensor NaN. MOIRAI sendiri bisa
    menangani NaN, tapi memberinya NaN sementara garis dasar diberi deret
    terisi akan membuat perbandingannya tidak setara — selisih hasilnya jadi
    bercampur antara "model lebih baik" dan "cara mengisi bolongnya berbeda".
    """
    return ramal_banyak([(deret, akhir_latih)], cakrawala, ukuran, kelompok=1)[0]


def bungkus_moirai(ukuran: str = "small"):
    """Kembalikan fungsi bertanda tangan sama dengan metode garis dasar."""

    def f(deret: DeretBarang, akhir_latih: int, cakrawala: int):
        return ramal_moirai(deret, akhir_latih, cakrawala, ukuran)

    f.__name__ = "moirai_%s" % ukuran
    return f
