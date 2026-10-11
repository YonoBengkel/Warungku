"""
Mesin 1 dengan Chronos-2 (Amazon), model pondasi deret waktu.

**Kenapa Chronos dan bukan MOIRAI.** Keduanya meramal tanpa dilatih pada data
kita, dan pada percobaan sebelumnya mutunya setara. Yang membedakan ada di
lisensi bobotnya:

    Salesforce/moirai-1.1-R-*   CC-BY-NC-4.0   -> non-komersial
    amazon/chronos-2            Apache-2.0     -> bebas, termasuk komersial

Keduanya bisa diunduh tanpa akun, jadi dari sisi "bisa dipakai sekarang"
sama saja. Bedanya baru terasa kalau Warungku suatu saat dijual: bobot MOIRAI
tidak boleh ikut, dan seluruh angka batas aman di aplikasi berasal dari situ.
Itu bukan hal yang enak ditemukan belakangan.

Keuntungan lain yang tidak kami duga: Chronos tidak memaku `scipy`, sedangkan
`uni2ts` memaku `scipy==1.11.4` yang tidak punya wheel untuk Python 3.14.
Dengan Chronos, seluruh proyek kembali ke satu lingkungan Python.

Yang perlu diketahui sebelum menaruh harapan:

* Bobot diunduh dari HuggingFace saat pertama dijalankan dan tersinggah di
  `~/.cache/huggingface`. Perlu internet sekali.
* Keluaran Chronos-2 adalah **kuantil langsung**, bukan cuplikan. Tidak perlu
  mencuplik lalu menghitung kuantil seperti MOIRAI, jadi tidak ada derau
  tambahan dari jumlah cuplikan yang terbatas.
"""

from __future__ import annotations

import numpy as np

from ..data import DeretBarang

TARAF = (0.1, 0.5, 0.9)

#: Panjang riwayat yang diberikan ke model. Chronos menerima konteks panjang,
#: tapi memberinya seluruh 400 hari memperlambat tanpa menambah apa pun: pola
#: yang menentukan permintaan harian ada di beberapa bulan terakhir.
PANJANG_KONTEKS = 200

_singgahan: dict[str, object] = {}


def _muat(nama: str = "amazon/chronos-2"):
    """
    Muat pipeline sekali saja, lalu singgah.

    Tanpa singgahan, uji ulang 910 deret x 3 titik asal memuat bobotnya 2.730
    kali — dan waktu muat jauh lebih besar daripada waktu inferensinya,
    sehingga angka kecepatan di laporan akan mengukur hal yang salah.
    """
    if nama in _singgahan:
        return _singgahan[nama]

    import torch
    from chronos import BaseChronosPipeline

    pipa = BaseChronosPipeline.from_pretrained(nama, device_map="cpu", torch_dtype=torch.float32)
    _singgahan[nama] = pipa
    return pipa


def _potong(deret: DeretBarang, akhir_latih: int) -> np.ndarray:
    return deret.terisi[max(0, akhir_latih - PANJANG_KONTEKS) : akhir_latih]


def _rapikan(kuantil: dict[float, np.ndarray]) -> dict[float, np.ndarray]:
    """Kuantil tidak boleh menyilang dan tidak boleh negatif."""
    t = sorted(kuantil)
    tumpuk = np.maximum.accumulate(np.vstack([kuantil[x] for x in t]), axis=0)
    return {x: np.maximum(tumpuk[i], 0.0) for i, x in enumerate(t)}


def ramal_banyak(
    tugas: list[tuple[DeretBarang, int]],
    cakrawala: int,
    nama: str = "amazon/chronos-2",
    kelompok: int = 32,
) -> list[dict[float, np.ndarray]]:
    """
    Ramal banyak jendela sekaligus.

    Ini jalur yang dipakai saat uji ulang dan saat layanan dijalankan harian.
    Memanggil model sekali per jendela membuat model pondasi tampak puluhan
    kali lebih lambat daripada sebenarnya: biayanya bukan pada hitungannya,
    melainkan pada memanggil model dengan kelompok berukuran satu.
    """
    import torch

    pipa = _muat(nama)
    hasil: list[dict[float, np.ndarray]] = []

    for i in range(0, len(tugas), kelompok):
        potong = tugas[i : i + kelompok]
        konteks = [torch.as_tensor(_potong(d, akhir), dtype=torch.float32) for d, akhir in potong]
        with torch.no_grad():
            kuantil, _rata = pipa.predict_quantiles(
                konteks,
                prediction_length=cakrawala,
                quantile_levels=list(TARAF),
            )
        # Chronos-2 mengembalikan DAFTAR tensor, satu per deret, masing-masing
        # berbentuk (peubah, cakrawala, taraf). Deret kita univariat, jadi
        # sumbu peubahnya selalu 1 dan diambil indeks 0.
        for q in kuantil:
            arr = np.asarray(q.numpy(), dtype=float)[0]
            hasil.append(_rapikan({t: arr[:, k] for k, t in enumerate(TARAF)}))

    return hasil


def ramal_chronos(
    deret: DeretBarang, akhir_latih: int, cakrawala: int, nama: str = "amazon/chronos-2"
) -> dict[float, np.ndarray]:
    """
    Satu ramalan, dikembalikan sebagai kuantil.

    Diberi deret `terisi`, bukan yang bersensor NaN — sama seperti garis dasar.
    Memberi NaN ke satu metode dan deret terisi ke metode lain akan membuat
    selisih hasilnya bercampur antara "model lebih baik" dan "cara mengisi
    bolongnya berbeda".
    """
    return ramal_banyak([(deret, akhir_latih)], cakrawala, nama, kelompok=1)[0]


def bungkus_chronos(nama: str = "amazon/chronos-2"):
    """Kembalikan fungsi bertanda tangan sama dengan metode garis dasar."""

    def f(deret: DeretBarang, akhir_latih: int, cakrawala: int):
        return ramal_chronos(deret, akhir_latih, cakrawala, nama)

    f.__name__ = "chronos_" + nama.rsplit("/", 1)[-1].replace("chronos-", "")
    return f
