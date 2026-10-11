"""
Penaksir Beta-Bernoulli: keandalan tiap distributor dari hitungan sukses dan gagal.

Ini penaksir paling sederhana yang masih Bayesian sungguhan, dan bisa dihitung
tangan. Setiap distributor (dalam satu kondisi) punya satu distribusi Beta:

    keandalan ~ Beta(1 + sukses, 1 + gagal)

    rata-rata  = a / (a + b)
    sebaran    = akar( a·b / ((a + b)^2 · (a + b + 1)) )

Beta(1, 1) adalah prior seragam: sebelum ada pesanan, semua keandalan antara 0
dan 1 dianggap sama mungkin. Setiap pesanan menambah satu ke a atau ke b.
Itulah seluruh "pelatihannya" — penjumlahan.

**Kenapa cukup.** Percobaan sebelumnya menunjukkan informasi utama ada pada
identitas distributor: rerata reputasi saja menyamai LightGBM, dan BART tidak
lebih baik daripada regresi logistik. Penaksir per distributor menangkap tepat
informasi itu, dan tidak lebih.

**Konteks bisa dipisah, tapi bawaannya tidak.** Hitungan bisa dibelah per
kondisi: distributor x (musim hujan atau kemarau) x (satu kota atau luar kota),
sehingga delapan distributor menjadi 32 "lengan". Di simulasi regret, pemisahan
itu justru lebih buruk (regret 1.499 melawan 1.419 tanpa pemisahan): tiap
lengan jadi lebih jarang datanya, dan Thompson menghabiskan lebih banyak
pesanan untuk mencoba lengan yang belum yakin. Kepekaan hujan dan jarak di
simulasi terlalu kecil untuk membayar ongkos itu. Pilihan ini diambil dari
simulasi yang sama dengan yang dipakai untuk menilainya, dan laporan harus
menyebutkan itu.

Yang tidak tertangkap sama sekali: kepekaan terhadap ukuran pesanan.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from ..data import FITUR

I_MUSIM_HUJAN = FITUR.index("p_musim_hujan")
I_SEKOTA = FITUR.index("p_sekota")

Kunci = tuple[int, bool, bool]


def kunci_dari(distributor_id: int, x: np.ndarray, *, pisah_konteks: bool = False) -> Kunci:
    """Kunci lengan dari id distributor dan satu baris fitur."""
    if not pisah_konteks:
        return (int(distributor_id), False, False)
    return (int(distributor_id), bool(x[I_MUSIM_HUJAN] >= 0.5), bool(x[I_SEKOTA] >= 0.5))


class BetaBernoulli:
    """
    Sepasang hitungan (sukses, gagal) per lengan.

    Antarmukanya sama dengan penaksir lain (`latih`, `peluang_dan_sebaran`),
    ditambah dua hal yang hanya masuk akal untuk penaksir hitungan:

    * `butuh_kunci = True` — ia butuh tahu distributor mana, bukan hanya fitur.
    * `perbarui()` — satu pesanan menambah satu hitungan, tanpa melatih ulang.
      Mode `daring` memakai ini di simulasi; mode terjadwal memakai `latih()`
      pada jadwal yang sama dengan penaksir lain, supaya perbandingannya adil.
    """

    butuh_kunci = True

    def __init__(self, *, daring: bool = False, pisah_konteks: bool = False,
                 prior_a: float = 1.0, prior_b: float = 1.0) -> None:
        self.daring = daring
        self.pisah_konteks = pisah_konteks
        self.prior_a = prior_a
        self.prior_b = prior_b
        self.sukses: dict[Kunci, int] = defaultdict(int)
        self.gagal: dict[Kunci, int] = defaultdict(int)
        self.nama = "beta" + ("_daring" if daring else "") + ("_konteks" if pisah_konteks else "")

    # -- pelatihan ----------------------------------------------------------
    def latih(self, X: np.ndarray, y: np.ndarray, *, kunci: list[Kunci]) -> None:
        """Hitung ulang dari seluruh riwayat."""
        self.sukses = defaultdict(int)
        self.gagal = defaultdict(int)
        for k, hasil in zip(kunci, y):
            self.perbarui(k, int(hasil))

    def perbarui(self, kunci: Kunci, hasil: int) -> None:
        if hasil:
            self.sukses[kunci] += 1
        else:
            self.gagal[kunci] += 1

    # -- ramalan ------------------------------------------------------------
    def parameter(self, kunci: Kunci) -> tuple[float, float]:
        """(a, b) distribusi Beta untuk satu lengan."""
        return self.prior_a + self.sukses[kunci], self.prior_b + self.gagal[kunci]

    def peluang_dan_sebaran(self, X: np.ndarray, *, kunci: list[Kunci]) -> tuple[np.ndarray, np.ndarray]:
        ab = np.array([self.parameter(k) for k in kunci], dtype=float)
        a, b = ab[:, 0], ab[:, 1]
        n = a + b
        rata = a / n
        sebaran = np.sqrt(a * b / (n * n * (n + 1.0)))
        return rata, sebaran

    def cuplik(self, kunci: list[Kunci], acak: np.random.Generator) -> np.ndarray:
        """Satu cuplikan Thompson langsung dari Beta, tanpa perantara."""
        ab = np.array([self.parameter(k) for k in kunci], dtype=float)
        return acak.beta(ab[:, 0], ab[:, 1])
