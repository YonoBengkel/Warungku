"""
Peramalan omset per entitas (UMKM atau toko), univariat dan multivariat.

Ramalan ini berbeda tujuan dari ramalan unit per barang. Unit per barang
dipakai untuk batas aman; omset memberi gambaran bisnis kepada pemilik
(saran dosen). Bedanya juga di sasarannya: omset adalah uang yang benar-benar
masuk, jadi hari stok habis tetap dihitung apa adanya — hanya hari tanpa
catatan atau toko tutup (`data_hilang`) yang dianggap kosong.

Lima metode, dari yang paling sederhana:

| Metode        | Peubah                                   | Parameter yang bisa dibaca |
|---------------|------------------------------------------|----------------------------|
| naif musiman  | omset pekan lalu                         | tidak ada                  |
| ETS           | omset                                    | alfa, beta, gamma          |
| SARIMAX       | omset + kalender sebagai peubah luar     | koefisien AR, MA, kalender |
| VAR           | omset, jumlah barang, jumlah nota bersama | matriks koefisien per lag |
| Chronos-2     | omset (pembanding, tanpa dilatih)        | tidak ada                  |

**Kenapa jumlah barang dan jumlah nota tidak menjadi peubah luar SARIMAX.**
SARIMAX butuh nilai peubah luar untuk hari-hari yang diramal, dan jumlah nota
besok belum diketahui hari ini. Peubah luar yang sah hanya yang sudah pasti
di masa depan: kalender. Jumlah barang dan nota masuk lewat VAR, yang
meramalkan ketiganya bersama — bentuk sederhana dari MARIMA yang disebut dosen.

Semua model dilatih pada logaritma omset, karena ragam omset naik bersama
levelnya. Hasilnya dikembalikan ke skala rupiah sebelum dinilai.
"""

from __future__ import annotations

import time
import warnings
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from .. import metrik

CAKRAWALA = 7
JUMLAH_ASAL = 8
MIN_LATIH = 120
EXOG = ("libur", "pekan_gajian", "ramadan", "lebaran")


def _isi(v: np.ndarray, tanggal: pd.Series) -> np.ndarray:
    """Isi hari kosong dengan median hari yang sama dalam pekan."""
    v = np.asarray(v, dtype=float).copy()
    kosong = ~np.isfinite(v)
    if not kosong.any():
        return v
    hari = pd.to_datetime(tanggal).dt.weekday.to_numpy()
    for h in range(7):
        pilih = hari == h
        isi = np.nanmedian(v[pilih & ~kosong]) if (pilih & ~kosong).any() else np.nanmedian(v)
        v[pilih & kosong] = isi
    return v


def _exog(g: pd.DataFrame) -> np.ndarray | None:
    """Kolom kalender yang tidak konstan. Kolom konstan membuat matriks singular."""
    kolom = [k for k in EXOG if k in g and g[k].astype(bool).nunique() > 1]
    if not kolom:
        return None
    return g[kolom].astype(float).to_numpy()


# --------------------------------------------------------------------------
def naif(g: pd.DataFrame, akhir: int, h: int) -> np.ndarray:
    v = _isi(g["omset"].to_numpy(), g["tanggal"])
    return np.array([v[akhir - 7 + (i % 7)] for i in range(h)])


def ets(g: pd.DataFrame, akhir: int, h: int) -> np.ndarray:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    v = np.log1p(_isi(g["omset"].to_numpy(), g["tanggal"])[:akhir])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pas = ExponentialSmoothing(
            v, trend="add", damped_trend=True, seasonal="add", seasonal_periods=7,
            initialization_method="estimated",
        ).fit(optimized=True)
    return np.expm1(np.asarray(pas.forecast(h)))


def sarimax(g: pd.DataFrame, akhir: int, h: int) -> np.ndarray:
    """
    SARIMAX(1,0,1)(0,1,1)7 dengan kalender sebagai peubah luar.

    Ordenya DITETAPKAN, tidak dicari per entitas. Pencarian orde otomatis
    memberi model berbeda untuk tiap UMKM, dan "kenapa warung A memakai orde
    (2,1,0) tapi warung B (1,0,2)?" adalah pertanyaan yang tidak punya jawaban
    yang memuaskan di depan penguji. Selisih musiman lag 7 menangkap pola
    mingguan; satu suku AR dan satu MA menangkap sisa ketergantungan harian.

    Hari pencilan dan data hilang dibiarkan NaN: model ruang-keadaan
    statsmodels menanganinya sebagai pengamatan yang hilang, bukan nol.
    """
    from statsmodels.tsa.statespace.sarimax import SARIMAX

    y = np.log1p(g["omset"].to_numpy(dtype=float))
    if "pencilan" in g:
        y = np.where(g["pencilan"].to_numpy(dtype=bool), np.nan, y)
    ex = _exog(g)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pas = SARIMAX(
            y[:akhir], exog=None if ex is None else ex[:akhir],
            order=(1, 0, 1), seasonal_order=(0, 1, 1, 7),
        ).fit(disp=False, maxiter=200)
        f = pas.forecast(h, exog=None if ex is None else ex[akhir : akhir + h])
    return np.expm1(np.asarray(f))


def var(g: pd.DataFrame, akhir: int, h: int, maks_lag: int = 7) -> np.ndarray:
    """
    VAR atas selisih musiman (lag 7) dari log omset, log jumlah barang, dan
    log jumlah nota. Orde lag dipilih dengan AIC sampai tujuh hari.

    Selisih musiman membuat ketiga deret kira-kira stasioner, syarat VAR.
    Ramalan dikembalikan dengan menjumlahkan selisih ke nilai pekan lalu:
    y[T+i] = y[T+i-7] + d[T+i].
    """
    from statsmodels.tsa.api import VAR

    kolom = ("omset", "jumlah_barang", "jumlah_nota")
    Y = np.column_stack([np.log1p(_isi(g[k].to_numpy(), g["tanggal"])) for k in kolom])[:akhir]
    D = Y[7:] - Y[:-7]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pas = VAR(D).fit(maxlags=maks_lag, ic="aic")
        lag = max(pas.k_ar, 1)
        d_ramal = pas.forecast(D[-lag:], h) if pas.k_ar > 0 else np.zeros((h, len(kolom)))
    y = list(Y[:, 0])
    for i in range(h):
        y.append(y[-7] + d_ramal[i, 0])
    return np.expm1(np.asarray(y[-h:]))


def chronos(g: pd.DataFrame, akhir: int, h: int) -> np.ndarray:
    from ..data import DeretBarang
    from .chronos import ramal_banyak

    v = _isi(g["omset"].to_numpy(), g["tanggal"])
    z = np.zeros(len(v), dtype=bool)
    d = DeretBarang(0, 0, "omset", pd.to_datetime(g["tanggal"]).dt.date.to_numpy(), v, z, z, z, z)
    return ramal_banyak([(d, akhir)], h)[0][0.5]


METODE = {"naif_musiman": naif, "ets": ets, "sarimax": sarimax, "var": var, "chronos_2": chronos}


# --------------------------------------------------------------------------
@dataclass
class HasilOmset:
    nama: str
    mape_pekanan: float
    wape_pekanan: float
    mape_harian: float
    kategori: str
    entitas_lolos_5: int
    entitas: int
    n_pekan: int
    gagal: int
    detik: float

    def baris(self) -> str:
        return "%-14s MAPE pekanan %5.1f%% (%s) | WAPE %5.1f%% | harian %5.1f%% | entitas <=5%%: %d/%d | n=%d gagal=%d | %6.1fs" % (
            self.nama, self.mape_pekanan, self.kategori, self.wape_pekanan, self.mape_harian,
            self.entitas_lolos_5, self.entitas, self.n_pekan, self.gagal, self.detik,
        )


def evaluasi(nama: str, fungsi, omset: pd.DataFrame, *, jumlah_asal: int = JUMLAH_ASAL) -> HasilOmset:
    """
    Uji ulang bergulir pekanan per entitas.

    Pekan yang berisi hari `data_hilang` (toko tutup) dikeluarkan: jumlah
    sebenarnya pekan itu kurang satu hari, sedangkan ramalannya tujuh hari.
    """
    mulai = time.perf_counter()
    a_all, f_all, harian = [], [], []
    per_entitas: dict[int, list[float]] = {}
    gagal = 0
    for eid, g in omset.groupby("entitas_id", sort=True):
        g = g.sort_values("tanggal").reset_index(drop=True)
        n = len(g)
        for k in range(jumlah_asal):
            akhir = n - CAKRAWALA * (k + 1)
            if akhir < MIN_LATIH:
                continue
            uji = g.iloc[akhir : akhir + CAKRAWALA]
            if uji["data_hilang"].astype(bool).any():
                continue
            asli = uji["omset"].to_numpy(dtype=float)
            try:
                f = np.asarray(fungsi(g, akhir, CAKRAWALA), dtype=float)
                if not np.isfinite(f).all():
                    raise ValueError("ramalan tidak hingga")
            except Exception:
                gagal += 1
                continue
            a_all.append(asli.sum())
            f_all.append(f.sum())
            per_entitas.setdefault(int(eid), []).append(abs(asli.sum() - f.sum()) / asli.sum() * 100)
            sah = asli > 0
            harian.extend(np.abs(asli[sah] - f[sah]) / asli[sah] * 100)

    mp = metrik.mape(np.array(a_all), np.array(f_all))
    return HasilOmset(
        nama=nama,
        mape_pekanan=mp,
        wape_pekanan=metrik.wape(np.array(a_all), np.array(f_all)),
        mape_harian=float(np.mean(harian)) if harian else float("nan"),
        kategori=metrik.kategori_lewis(mp),
        entitas_lolos_5=sum(1 for v in per_entitas.values() if np.mean(v) <= 5.0),
        entitas=len(per_entitas),
        n_pekan=len(a_all),
        gagal=gagal,
        detik=time.perf_counter() - mulai,
    )


def ke_kamus(h: HasilOmset) -> dict:
    return asdict(h)
