"""
Garis dasar Mesin 1. Lawan yang harus dikalahkan MOIRAI.

Garis dasar ditulis lebih dulu, bukan sesudahnya. Kalau MOIRAI dipasang dulu
lalu garis dasarnya dibuat belakangan, selalu ada dorongan — sadar atau tidak —
untuk membuat garis dasarnya lemah. Dan sebagian besar yang ada di sini memang
sulit dikalahkan: kuantil per hari-pekan adalah metode yang bisa ditulis dalam
lima baris dan sering mengungguli model besar pada deret pendek dan berderau.

Semua metode mengembalikan bentuk yang sama: dict kuantil -> array sepanjang
cakrawala. Bukan satu angka. Yang dipakai aplikasi untuk menghitung batas aman
adalah p90, jadi sebaran itulah keluaran yang sebenarnya, bukan tambahan.
"""

from __future__ import annotations

import warnings

import numpy as np

from ..data import DeretBarang

TARAF = (0.1, 0.5, 0.9)
Ramalan = dict[float, np.ndarray]


def _hari_pekan(deret: DeretBarang, mulai: int, panjang: int) -> np.ndarray:
    """Hari dalam pekan untuk `panjang` hari sesudah indeks `mulai`."""
    import datetime as dt

    t0 = deret.tanggal[mulai - 1]
    return np.array([(t0 + dt.timedelta(days=i + 1)).weekday() for i in range(panjang)])


def _rapikan(r: Ramalan) -> Ramalan:
    """
    Pastikan kuantilnya tidak saling menyilang dan tidak negatif.

    Kuantil yang menyilang (p10 > p50) bisa muncul dari penaksiran terpisah dan
    tidak punya arti apa pun. Dibiarkan lewat, ia akan menghasilkan batas aman
    yang lebih kecil daripada perkiraan tengah, dan tidak ada yang akan curiga
    karena angkanya tetap tampak masuk akal di layar.
    """
    t = sorted(r)
    tumpuk = np.maximum.accumulate(np.vstack([r[x] for x in t]), axis=0)
    return {x: np.maximum(tumpuk[i], 0.0) for i, x in enumerate(t)}


# --------------------------------------------------------------------------
def naif_musiman(deret: DeretBarang, akhir_latih: int, cakrawala: int) -> Ramalan:
    """
    "Besok sama seperti hari yang sama pekan lalu."

    Inilah titik nolnya. MASE 1,0 berarti setara metode ini. Model apa pun yang
    tidak bisa mengalahkannya tidak layak dipasang, apa pun nama arsitekturnya.
    """
    v = deret.terisi[:akhir_latih]
    dasar = np.array([v[akhir_latih - 7 + (i % 7)] for i in range(cakrawala)], dtype=float)

    # Selang dari sebaran galat metode ini sendiri pada data latih. Dibuat
    # perkalian, bukan penambahan: ragam permintaan naik bersama rata-ratanya,
    # jadi selang bernilai tetap akan terlalu lebar untuk barang sepi dan
    # terlalu sempit untuk barang laris.
    rasio = _rasio_dalam_sampel(v, np.roll(v, 7), awal=7)
    return _rapikan({t: dasar * np.quantile(rasio, t) for t in TARAF})


def _rasio_dalam_sampel(asli: np.ndarray, pas: np.ndarray, awal: int = 0) -> np.ndarray:
    """Rasio asli/pas pada data latih, untuk menaksir lebar selang."""
    a, p = asli[awal:], pas[awal:]
    pilih = p > 1e-6
    if pilih.sum() < 10:
        return np.array([0.6, 1.0, 1.6])
    r = a[pilih] / p[pilih]
    return np.clip(r, 0.0, 5.0)


# --------------------------------------------------------------------------
def kuantil_hari_pekan(deret: DeretBarang, akhir_latih: int, cakrawala: int) -> Ramalan:
    """
    Kuantil empiris per hari dalam pekan, dihitung dari 12 pekan terakhir.

    Garis dasar paling berbahaya bagi model besar. Ia langsung menangkap dua
    hal yang paling menentukan di data penjualan harian — pola mingguan dan
    ragam yang tidak seragam — tanpa satu pun parameter yang perlu dilatih.
    """
    jendela = min(akhir_latih, 84)
    v = deret.nilai[akhir_latih - jendela : akhir_latih]
    hari_latih = np.array([t.weekday() for t in deret.tanggal[akhir_latih - jendela : akhir_latih]])
    hari_ramal = _hari_pekan(deret, akhir_latih, cakrawala)

    hasil: Ramalan = {t: np.zeros(cakrawala) for t in TARAF}
    semua = v[~np.isnan(v)]
    for h in range(7):
        pilih = (hari_latih == h) & ~np.isnan(v)
        sumber = v[pilih] if pilih.sum() >= 4 else semua
        if len(sumber) == 0:
            continue
        tempat = hari_ramal == h
        for t in TARAF:
            hasil[t][tempat] = float(np.quantile(sumber, t))
    return _rapikan(hasil)


# --------------------------------------------------------------------------
def holt_winters(deret: DeretBarang, akhir_latih: int, cakrawala: int) -> Ramalan:
    """
    Pemulusan eksponensial dengan musim mingguan tambahan.

    Butuh deret tanpa NaN, jadi dipakai versi `terisi`. Di sinilah sensor
    kehabisan stok mulai berpengaruh pada hasil: cara mengisi bolongnya ikut
    menentukan angkanya, dan itu memang bagian dari metodenya, bukan kecurangan.
    """
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    v = deret.terisi[:akhir_latih]
    if len(v) < 2 * 7 + 5 or np.allclose(v, v[0]):
        return naif_musiman(deret, akhir_latih, cakrawala)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            pas = ExponentialSmoothing(
                v, trend="add", seasonal="add", seasonal_periods=7,
                initialization_method="estimated",
            ).fit(optimized=True)
            dasar = np.asarray(pas.forecast(cakrawala), dtype=float)
            dalam = np.asarray(pas.fittedvalues, dtype=float)
        except Exception:
            # Optimasi Holt-Winters bisa gagal menyatu pada deret yang sangat
            # berderau. Dikembalikan ke naif musiman, dan kegagalannya tidak
            # disembunyikan: angkanya akan terlihat setara naif di laporan.
            return naif_musiman(deret, akhir_latih, cakrawala)

    dasar = np.maximum(dasar, 0.0)
    rasio = _rasio_dalam_sampel(v, dalam)
    return _rapikan({t: dasar * np.quantile(rasio, t) for t in TARAF})


# --------------------------------------------------------------------------
def croston(deret: DeretBarang, akhir_latih: int, cakrawala: int, alfa: float = 0.1) -> Ramalan:
    """
    Croston untuk permintaan terputus-putus — barang yang laku sesekali saja.

    Dimasukkan karena beberapa barang di rak UMKM memang begitu: sirup rasa
    tertentu, susu kental manis di kedai kopi. Pada deret seperti itu, metode
    yang merata-rata seluruh hari selalu meramal angka kecil setiap hari,
    padahal yang sebenarnya terjadi adalah nol selama sepuluh hari lalu
    melonjak. Croston memisahkan "seberapa besar sekali laku" dari "seberapa
    sering laku", lalu membaginya.
    """
    v = deret.terisi[:akhir_latih]
    bukan_nol = np.flatnonzero(v > 1e-9)
    if len(bukan_nol) < 3:
        return _rapikan({t: np.zeros(cakrawala) for t in TARAF})

    besar = float(v[bukan_nol[0]])
    jarak = float(bukan_nol[0] + 1)
    terakhir = bukan_nol[0]
    for i in bukan_nol[1:]:
        besar += alfa * (float(v[i]) - besar)
        jarak += alfa * (float(i - terakhir) - jarak)
        terakhir = int(i)

    laju = besar / max(jarak, 1e-6)
    dasar = np.full(cakrawala, laju, dtype=float)
    # Sebaran dari ukuran lonjakan yang tercatat, bukan dari laju rata-ratanya:
    # yang ditanya batas aman adalah "seberapa banyak kalau sampai laku",
    # bukan "berapa rata-rata per hari".
    ukuran = v[bukan_nol]
    return _rapikan(
        {
            0.1: dasar * 0.0,
            0.5: dasar,
            0.9: np.full(cakrawala, float(np.quantile(ukuran, 0.9))),
        }
    )


METODE = {
    "naif_musiman": naif_musiman,
    "kuantil_hari_pekan": kuantil_hari_pekan,
    "holt_winters": holt_winters,
    "croston": croston,
}
