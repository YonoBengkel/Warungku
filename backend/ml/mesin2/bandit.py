"""
Mesin 2 sebagai contextual bandit: lapis keputusan yang membungkus penaksir.

**Kenapa bandit dan bukan klasifikasi biasa.** Tiga sifat masalah ini tidak
bisa dinyatakan oleh pengklasifikasi statis:

1. **Umpan balik sebagian.** Kita hanya melihat hasil distributor yang
   benar-benar dipesan. Yang tidak dipesan tidak pernah memberi label. Itu
   definisi *bandit feedback*.
2. **Keputusan memengaruhi data besok.** Distributor yang tidak pernah dipilih
   tidak pernah punya riwayat, jadi skornya ditarik ke rata-rata, jadi tidak
   pernah dipilih. Lingkaran itu menutup diri, dan dataset yang terkumpul hanya
   berisi distributor yang kebetulan menang duluan.
3. **Metrik aslinya regret**, bukan akurasi: berapa yang hilang karena tidak
   memilih yang terbaik.

Berkas ini memuat **lapis keputusannya saja**. Penaksirnya bisa ditukar —
BART, regresi logistik Bayesian, LightGBM — dan itu memang tujuannya: laporan
bisa memisahkan "kebijakan mana yang menang" dari "penaksir mana yang menang".

    Kebijakan  ──┬── Thompson Sampling   (Chapelle & Li, 2011)
                 ├── LinUCB              (Li dkk., 2010)
                 ├── epsilon-greedy
                 └── Greedy murni        (pembanding: eksplorasi nol)
                        │ membungkus
    Penaksir   ──────── BART / regresi logistik Bayesian / LightGBM
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class Kebijakan(ABC):
    """
    Satu lapis keputusan. Mengubah peluang menjadi skor peringkat.

    `skor()` menerima peluang dari penaksir beserta **ketidakpastiannya**, dan
    mengembalikan angka untuk diurutkan. Yang membedakan satu kebijakan dari
    yang lain hanyalah bagaimana ketidakpastian itu dipakai.
    """

    nama: str
    #: True kalau keluarannya mengandung cuplikan acak, sehingga dua kali jalan
    #: memberi urutan berbeda. Laporan wajib menyebutkan ini — angka dari satu
    #: kali jalan tidak bisa dibandingkan langsung dengan kebijakan tanpa cuplikan.
    acak: bool = False

    @abstractmethod
    def skor(self, p: np.ndarray, sigma: np.ndarray, acak: np.random.Generator) -> np.ndarray:
        ...


class Greedy(Kebijakan):
    """
    Selalu pilih peluang tertinggi. Eksplorasi nol.

    Ada di daftar sebagai **pembanding yang harus dikalahkan**, bukan sebagai
    calon. Kalau Thompson tidak mengungguli ini pada simulasi berurutan, berarti
    eksplorasi tidak membayar dirinya sendiri di masalah kita, dan itu temuan
    yang sah untuk dilaporkan.
    """

    nama = "greedy"

    def skor(self, p, sigma, acak):
        return p


class EpsilonGreedy(Kebijakan):
    """
    Pilih yang terbaik, kecuali sesekali memilih acak.

    Eksplorasi paling sederhana yang ada. Kelemahannya terlihat jelas kalau
    dibandingkan dengan Thompson: ia menjelajah dengan buta — distributor yang
    sudah jelas buruk punya peluang dicoba sama besar dengan yang belum pernah
    dicoba sama sekali.
    """

    nama = "epsilon_greedy"
    acak = True

    def __init__(self, epsilon: float = 0.10) -> None:
        self.epsilon = epsilon
        self.nama = "epsilon_greedy_%g" % epsilon

    def skor(self, p, sigma, acak):
        if acak.random() < self.epsilon:
            return acak.random(len(p))
        return p


class ThompsonSampling(Kebijakan):
    """
    Cuplik dari sebaran posterior, lalu pilih yang tercuplik tertinggi.

    Inilah inti gagasannya: kandidat dipilih **sebanding dengan peluang ia
    benar-benar yang terbaik**. Distributor dengan 3 pesanan punya sebaran
    lebar, jadi sering tercuplik tinggi dan terpilih untuk dicoba; yang punya
    200 pesanan punya sebaran sempit, jadi skornya nyaris peluangnya sendiri.
    Eksplorasinya terarah, bukan buta.

    Dicuplik dari Beta yang dicocokkan ke (p, sigma), bukan dari Normal: peluang
    harus tinggal di antara 0 dan 1, dan Normal akan menghasilkan cuplikan
    negatif untuk distributor berpeluang rendah.
    """

    nama = "thompson"
    acak = True

    def __init__(self, ulang: int = 1) -> None:
        #: Jumlah cuplikan yang dirata-ratakan. 1 = Thompson murni, yang memang
        #: benar untuk dipakai sungguhan. Lebih dari 1 hanya untuk evaluasi,
        #: supaya metriknya tidak terlalu berderau — dan itu harus disebut,
        #: karena merata-ratakan cuplikan MENGURANGI eksplorasinya.
        self.ulang = ulang
        if ulang > 1:
            self.nama = "thompson_rata%d" % ulang

    def skor(self, p, sigma, acak):
        p = np.clip(p, 1e-4, 1 - 1e-4)
        # Beta(a, b) dengan rata-rata p dan ragam sigma^2. Dari hubungan
        # ragam Beta: a + b = p(1-p)/sigma^2 - 1.
        ragam = np.clip(sigma, 1e-4, 0.49) ** 2
        jumlah = np.clip(p * (1 - p) / ragam - 1.0, 0.1, 1e4)
        a, b = p * jumlah, (1 - p) * jumlah
        if self.ulang == 1:
            return acak.beta(a, b)
        return np.mean([acak.beta(a, b) for _ in range(self.ulang)], axis=0)


class LinUCB(Kebijakan):
    """
    Optimisme di hadapan ketidakpastian: skor = peluang + alfa x sebaran.

    Berbeda dari Thompson, ia **tidak acak** — dua kali jalan memberi urutan
    yang sama persis. Itu sifat yang berharga untuk dipakai sungguhan: pemilik
    warung yang menyegarkan halaman tidak melihat urutan berubah tanpa sebab.

    Harganya: alfa harus ditala, dan nilainya menentukan seberapa berani ia
    menjelajah. Thompson tidak punya tombol itu — ketidakpastiannya sendiri yang
    menentukan.
    """

    nama = "linucb"

    def __init__(self, alfa: float = 1.0) -> None:
        self.alfa = alfa
        self.nama = "linucb_a%g" % alfa

    def skor(self, p, sigma, acak):
        return p + self.alfa * sigma


KEBIJAKAN: tuple[Kebijakan, ...] = (
    Greedy(),
    EpsilonGreedy(0.10),
    ThompsonSampling(),
    LinUCB(1.0),
)


# --------------------------------------------------------------------------
class Penaksir(ABC):
    """
    Pembungkus penaksir peluang yang juga melaporkan ketidakpastiannya.

    Ini yang membedakan bandit dari klasifikasi: `peluang()` saja tidak cukup,
    lapis keputusan butuh tahu **seberapa yakin** angka itu. Pengklasifikasi
    biasa tidak menyediakannya, jadi pembungkus di sini yang mengadakannya —
    dan caranya harus jujur, bukan angka karangan yang kelihatan rapi.
    """

    nama: str

    @abstractmethod
    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        ...

    @abstractmethod
    def peluang_dan_sebaran(self, X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Kembalikan (peluang, simpangan baku peluang)."""

    def peluang(self, X: np.ndarray) -> np.ndarray:
        return self.peluang_dan_sebaran(X)[0]


class BanditLengkap:
    """
    Pasangan penaksir + kebijakan, dengan antarmuka yang sama seperti garis dasar.

    Dibuat terpisah supaya kerangka evaluasi yang sudah ada tidak perlu tahu
    bedanya, dan supaya tabel di laporan bisa memuat garis dasar dan bandit
    dalam satu kolom yang sama.
    """

    def __init__(self, penaksir: Penaksir, kebijakan: Kebijakan, benih: int = 20261006) -> None:
        self.penaksir = penaksir
        self.kebijakan = kebijakan
        self.acak = np.random.default_rng(benih)
        self.nama = "%s+%s" % (penaksir.nama, kebijakan.nama)
        self.per_keputusan = False

    def latih(self, X: np.ndarray, y: np.ndarray) -> None:
        self.penaksir.latih(X, y)

    def peluang(self, X: np.ndarray) -> np.ndarray:
        p, sigma = self.penaksir.peluang_dan_sebaran(X)
        return self.kebijakan.skor(p, sigma, self.acak)

    def peluang_murni(self, X: np.ndarray) -> np.ndarray:
        """
        Peluang tanpa lapis keputusan — ini yang ditampilkan ke pemilik warung.

        Skor Thompson tidak boleh dipakai sebagai angka yang ditampilkan: ia
        cuplikan, bukan taksiran. Layar yang menulis "peluang 91%" dari cuplikan
        Thompson akan menunjukkan angka berbeda tiap kali disegarkan.
        """
        return self.penaksir.peluang_dan_sebaran(X)[0]
