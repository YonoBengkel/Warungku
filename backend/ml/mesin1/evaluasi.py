"""
Uji ulang bergulir (rolling-origin backtest) untuk Mesin 1.

Satu pembelahan latih/uji tidak cukup untuk menyimpulkan apa pun. Dengan 260
deret dan satu jendela uji, selisih antar model bisa seluruhnya berasal dari
kebetulan: jendela itu kena Ramadan, atau kena pekan yang luar biasa sepi.
Jadi titik asalnya digeser beberapa kali, dan yang dilaporkan adalah rata-rata
beserta sebarannya antar titik asal.

Aturan yang dijaga berkas ini: **pada setiap titik asal, model hanya melihat
data sebelum titik itu.** Tidak ada penalaan parameter yang memakai data
sesudahnya, tidak ada penskalaan yang dihitung dari seluruh deret. Pelanggaran
seperti itu adalah penyebab paling umum angka bagus yang tidak bisa diulang.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from .. import metrik
from ..data import CAKRAWALA, DeretBarang

TARAF = (0.1, 0.5, 0.9)


@dataclass
class HasilSatuDeret:
    barang_id: int
    titik_asal: int
    mase: float
    wql: float
    cakupan: float


@dataclass
class Ringkasan:
    nama: str
    mase: float
    wql: float
    cakupan: float
    mase_per_asal: list[float] = field(default_factory=list)
    detik: float = 0.0
    n: int = 0
    gagal: int = 0

    def baris(self) -> str:
        sebar = (
            "±%.3f" % float(np.std(self.mase_per_asal)) if len(self.mase_per_asal) > 1 else "     "
        )
        return "%-22s MASE %6.3f %s   WQL %6.4f   cakupan %5.1f%%   n=%5d  %6.1fs%s" % (
            self.nama, self.mase, sebar, self.wql, 100 * self.cakupan,
            self.n, self.detik, "  gagal=%d" % self.gagal if self.gagal else "",
        )


def titik_asal(panjang: int, cakrawala: int, jumlah: int, jarak: int | None = None) -> list[int]:
    """
    Indeks akhir-latih untuk setiap titik asal, dari yang paling lama.

    Titik asal terakhir dipilih supaya jendela ramalannya tepat berhenti di
    hari terakhir data. Dengan begitu jendela uji yang paling diperhatikan
    adalah yang paling baru — keadaan yang akan dihadapi model saat dipakai.
    """
    jarak = jarak if jarak is not None else cakrawala
    akhir = panjang - cakrawala
    asal = [akhir - i * jarak for i in range(jumlah)]
    return sorted(a for a in asal if a > 0)


def _tugas(
    deret: list[DeretBarang], cakrawala: int, jumlah_asal: int, min_latih: int
) -> list[tuple[DeretBarang, int]]:
    """Daftar (deret, akhir_latih) yang layak dinilai, urutannya tetap."""
    hasil = []
    for d in deret:
        for akhir in titik_asal(len(d), cakrawala, jumlah_asal):
            if akhir < min_latih:
                continue
            asli = d.nilai[akhir : akhir + cakrawala]
            if (~np.isnan(asli)).sum() < cakrawala // 2:
                continue
            if not np.isfinite(metrik.galat_naif_musiman(d.terisi[:akhir])):
                continue
            hasil.append((d, akhir))
    return hasil


def uji_ulang(
    deret: list[DeretBarang],
    metode,
    nama: str,
    *,
    cakrawala: int = CAKRAWALA,
    jumlah_asal: int = 3,
    min_latih: int = 120,
    metode_banyak=None,
) -> Ringkasan:
    """
    Jalankan satu metode pada seluruh deret, di semua titik asal.

    `metode_banyak` untuk metode yang jauh lebih cepat kalau dipanggil
    berkelompok (MOIRAI). Diberikan, seluruh ramalan dihitung sekali di awal;
    kalau tidak, dipanggil satu per satu. Keduanya WAJIB memberi hasil yang
    sama — bedanya cuma cara memanggil, dan `--banding-jalur` di `jalankan.py`
    memeriksa itu.

    Deret yang gagal diramal **dihitung dan dilaporkan**, tidak dibuang diam-
    diam. Metode yang hanya berhasil pada 40% deret bisa terlihat paling akurat
    kalau yang 60% itu menghilang dari rata-rata.
    """
    mulai = time.perf_counter()
    satuan: list[HasilSatuDeret] = []
    gagal = 0

    daftar = _tugas(deret, cakrawala, jumlah_asal, min_latih)
    sebelumnya: list | None = None
    if metode_banyak is not None and daftar:
        sebelumnya = metode_banyak(daftar, cakrawala)

    for i, (d, akhir) in enumerate(daftar):
        asli = d.nilai[akhir : akhir + cakrawala]
        # Hari kehabisan stok dibuang dari penilaian, bukan dianggap nol.
        # Menilai ramalan terhadap nol yang bukan permintaan nol akan memberi
        # nilai terbaik kepada model yang paling sering meramal terlalu rendah.
        sah = ~np.isnan(asli)

        if sebelumnya is not None:
            r = sebelumnya[i]
        else:
            try:
                r = metode(d, akhir, cakrawala)
            except Exception:
                gagal += 1
                continue

        # Kelayakan deret (cukup hari sah, penyebut MASE terdefinisi) sudah
        # disaring di `_tugas`, supaya jalur satuan dan jalur berkelompok
        # menilai jendela yang sama persis.
        penyebut = metrik.galat_naif_musiman(d.terisi[:akhir])
        satuan.append(
            HasilSatuDeret(
                barang_id=d.barang_id,
                titik_asal=akhir,
                mase=metrik.mase(asli[sah], r[0.5][sah], penyebut),
                wql=metrik.wql(asli[sah], {t: r[t][sah] for t in TARAF}),
                cakupan=metrik.cakupan(asli[sah], r[0.1][sah], r[0.9][sah]),
            )
        )

    if not satuan:
        return Ringkasan(nama, float("nan"), float("nan"), float("nan"), detik=0.0, gagal=gagal)

    def rata(ambil) -> float:
        v = np.array([ambil(s) for s in satuan], dtype=float)
        return float(np.nanmean(v))

    per_asal: dict[int, list[float]] = {}
    for s in satuan:
        per_asal.setdefault(s.titik_asal, []).append(s.mase)

    return Ringkasan(
        nama=nama,
        mase=rata(lambda s: s.mase),
        wql=rata(lambda s: s.wql),
        cakupan=rata(lambda s: s.cakupan),
        mase_per_asal=[float(np.nanmean(v)) for v in per_asal.values()],
        detik=time.perf_counter() - mulai,
        n=len(satuan),
        gagal=gagal,
    )
