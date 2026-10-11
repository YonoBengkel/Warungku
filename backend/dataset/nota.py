"""
Nota kasir untuk seluruh 400 hari, lengkap dengan harga jual.

Buku besar (`pergerakan`) mencatat penjualan sekali per barang per hari: itu
ringkasan sinkron harian dari kasir. Nota adalah rinciannya, yaitu siapa membeli
apa, kapan, dan dengan harga berapa. Dari nota lahir dua deret yang tidak bisa
dibaca dari buku besar:

* **omset harian** = jumlah dari (jumlah x harga jual) seluruh baris nota, dan
* **jumlah nota harian**, pendekatan jumlah pelanggan.

Tiga aturan:

1. **Nota tidak mengubah penjualan.** Jumlah semua baris nota untuk satu barang
   pada satu hari sama persis dengan baris `pergerakan`-nya. Nota hanya membagi
   penjualan yang sudah ada ke para pembeli, tidak menambah atau mengurangi.
   Diperiksa di `periksa_turunan` dan `skrip/02_periksa_konsistensi.sql`.
2. **Generator acaknya sendiri.** Nota dibangkitkan sesudah simulasi, dengan
   generator yang diturunkan dari benih yang sama tapi terpisah. Menambah nota
   tidak menggeser satu angka pun di D1 dan D2, jadi hasil model yang sudah
   diukur tetap berlaku.
3. **Jumlah nota mengikuti uang, tapi bukan salinannya.** Banyaknya pembeli hari
   itu ditarik dari omset dibagi belanja rata-rata per nota, dengan derau pada
   belanja harian. Keduanya berkorelasi seperti di warung sungguhan. Kalau
   identik, `jumlah_nota` tidak membawa informasi apa pun di model multivariat.

Harga jual hanya ada di nota. `barang` sengaja tidak punya kolom harga jual
(lihat `TransaksiBaris`).

Batas yang perlu diingat saat membaca angkanya:

* Pemetaan menu masih 1:1, jadi "menu" di nota adalah bahannya sendiri (Biji
  Kopi Arabika, 36 gram), dan harga jual adalah harga per satuan dasar bahan.
  Omset karenanya = nilai jual bahan yang terpakai.
* Harga jual tetap sepanjang 400 hari. Tidak ada kenaikan harga.
* Pengali harga, belanja per nota, dan jam ramai di bawah adalah **asumsi**,
  bukan hasil pengukuran.
"""

from __future__ import annotations

import csv
import io
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

import numpy as np

# --------------------------------------------------------------------------
# Asumsi per jenis usaha
# --------------------------------------------------------------------------
#: Pengali harga beli -> harga jual. Dari porsi bahan baku dalam harga jual
#: yang lazim: kedai kopi sekitar sepertiga, warung makan sekitar separuh,
#: kelontong menjual kembali dengan untung tipis.
MARKUP: dict[str, float] = {
    "kedai-kopi": 3.0,
    "kedai-minuman": 2.8,
    "warung-makan": 1.9,
    "roti-kue": 2.4,
    "warung-kelontong": 1.15,
}

#: Belanja rata-rata per nota, rupiah.
BELANJA_PER_NOTA: dict[str, int] = {
    "kedai-kopi": 38_000,
    "kedai-minuman": 22_000,
    "warung-makan": 28_000,
    "roti-kue": 45_000,
    "warung-kelontong": 35_000,
}

#: Rata-rata baris tambahan per nota, di atas satu baris yang pasti ada.
TAMBAHAN_BARIS: dict[str, float] = {
    "kedai-kopi": 0.4,
    "kedai-minuman": 0.3,
    "warung-makan": 0.6,
    "roti-kue": 0.7,
    "warung-kelontong": 1.0,
}

#: Jam ramai sebagai campuran normal: (jam puncak, simpangan dalam jam, bobot).
JAM_RAMAI: dict[str, tuple[tuple[float, float, float], ...]] = {
    "kedai-kopi": ((8.5, 1.2, 0.45), (15.5, 1.8, 0.55)),
    "kedai-minuman": ((12.5, 1.5, 0.45), (16.5, 1.8, 0.55)),
    "warung-makan": ((12.0, 1.0, 0.55), (18.5, 1.0, 0.45)),
    "roti-kue": ((7.8, 1.0, 0.50), (16.0, 1.8, 0.50)),
    "warung-kelontong": ((9.0, 2.5, 0.50), (17.0, 2.0, 0.50)),
}

#: Jam buka, dalam menit sejak tengah malam. Nota terakhir sebelum 20.30,
#: karena baris buku besar harian ditulis 20.30. Waktu baris buku besar harus
#: mengikuti urutan penerapannya.
BUKA = 7 * 60
TUTUP = 20 * 60 + 29

#: Simpangan log belanja per nota dari hari ke hari.
DERAU_BELANJA = 0.10
#: Sebaran rata-rata belanja antar warung sejenis (+-15%).
SEBARAN_WARUNG = 0.15
#: Sebaran harga jual antar barang dalam satu warung (+-10%).
SEBARAN_BARANG = 0.10
#: Konsentrasi Dirichlet saat membagi penjualan sehari ke para pembeli. Makin
#: kecil, makin timpang jumlah per nota.
KONSENTRASI = 2.0

KASIR = "Kasir 1"
SUMBER = "pos"


@dataclass
class Nota:
    """
    Nota dalam bentuk ringkas (larik numpy, bukan dict).

    Sekitar dua juta nota dan tiga juta baris tidak muat sebagai dict di memori
    laptop: setiap dict makan ratusan byte. Larik ini ditulis ke Postgres lewat
    COPY oleh `salin`, tanpa pernah menjadi dict.
    """

    #: Per nota. Id transaksi = indeks + 1.
    usaha_id: np.ndarray
    tanggal: np.ndarray  # ordinal `date.toordinal()`
    urut: np.ndarray  # 1..n dalam satu usaha dan satu hari, urut waktu
    menit: np.ndarray  # menit sejak tengah malam
    #: Per baris nota.
    baris_nota: np.ndarray  # indeks nota (0-based)
    baris_barang: np.ndarray  # barang_id
    baris_jumlah: np.ndarray  # seperseribu satuan dasar, bilangan bulat
    baris_harga: np.ndarray  # rupiah per satuan dasar

    @property
    def n_nota(self) -> int:
        return int(self.usaha_id.size)

    @property
    def n_baris(self) -> int:
        return int(self.baris_nota.size)

    def ringkasan_harian(self) -> list[dict]:
        """Omset, jumlah nota, dan jumlah baris per usaha per hari."""
        nilai = self.baris_jumlah * self.baris_harga  # rupiah x 1000
        omset: dict[tuple[int, int], int] = defaultdict(int)
        n_baris: dict[tuple[int, int], int] = defaultdict(int)
        kunci_baris = zip(
            self.usaha_id[self.baris_nota].tolist(),
            self.tanggal[self.baris_nota].tolist(),
            nilai.tolist(),
        )
        for u, t, v in kunci_baris:
            omset[(u, t)] += v
            n_baris[(u, t)] += 1
        n_nota: dict[tuple[int, int], int] = defaultdict(int)
        for u, t in zip(self.usaha_id.tolist(), self.tanggal.tolist()):
            n_nota[(u, t)] += 1
        return [
            {
                "usaha_id": u,
                "tanggal": date.fromordinal(t),
                "omset": round(omset[(u, t)] / 1000),
                "jumlah_nota": n_nota[(u, t)],
                "jumlah_baris": n_baris[(u, t)],
            }
            for u, t in sorted(n_nota, key=lambda k: (k[0], k[1]))
        ]


def harga_jual(
    barang: list[dict], jenis_usaha: dict[int, str], harga_beli_satuan: dict[int, float],
    acak: np.random.Generator,
) -> dict[int, int]:
    """
    Harga jual per satuan dasar, rupiah bulat, tetap sepanjang simulasi.

    Uang selalu bilangan bulat rupiah (aturan angka di README). Untuk bahan yang
    murah per satuan dasar (es batu sekitar Rp2 per gram), pembulatan ini
    menggeser margin beberapa persen. Itu tidak masalah, karena omset tetap
    dihitung dari harga yang tertulis di nota.
    """
    faktor_warung: dict[int, float] = {}
    hasil: dict[int, int] = {}
    for b in barang:
        u = b["usaha_id"]
        if u not in faktor_warung:
            faktor_warung[u] = float(acak.uniform(1 - SEBARAN_WARUNG, 1 + SEBARAN_WARUNG))
        f_barang = float(acak.uniform(1 - SEBARAN_BARANG, 1 + SEBARAN_BARANG))
        harga = harga_beli_satuan[b["id"]] * MARKUP[jenis_usaha[u]] * faktor_warung[u] * f_barang
        hasil[b["id"]] = max(1, round(harga))
    return hasil


def _bagi(jumlah_milli: int, k: int, acak: np.random.Generator) -> tuple[np.ndarray, int]:
    """
    Membagi penjualan sehari satu barang ke `k` pembeli.

    Kalau jumlahnya bilangan bulat dalam satuan dasar (biasanya begitu: gram,
    ml, dan pcs dari sebaran Poisson), dibagi per satuan utuh supaya tidak ada
    nota berisi 17,384 gram. Kalau pecahan (hari stok habis, sisa stok pecahan),
    dibagi per seperseribu. Setiap bagian minimal satu satuan, jadi `k` bisa
    turun bila penjualannya lebih kecil dari banyaknya pembeli.
    """
    satuan = 1000 if jumlah_milli % 1000 == 0 else 1
    m = jumlah_milli // satuan
    k = min(k, m)
    bobot = acak.dirichlet(np.full(k, KONSENTRASI))
    bagian = 1 + acak.multinomial(m - k, bobot)
    return bagian.astype(np.int64) * satuan, k


def _menit(jenis: str, n: int, acak: np.random.Generator) -> np.ndarray:
    puncak = JAM_RAMAI[jenis]
    bobot = np.array([p[2] for p in puncak])
    pilih = acak.choice(len(puncak), size=n, p=bobot / bobot.sum())
    jam = np.array([p[0] for p in puncak])[pilih]
    simpang = np.array([p[1] for p in puncak])[pilih]
    menit = np.rint((jam + acak.normal(0.0, 1.0, n) * simpang) * 60)
    return np.sort(np.clip(menit, BUKA, TUTUP).astype(np.int16))


def bangkitkan(
    terjual: list[tuple[int, int, date, float]],
    jenis_usaha: dict[int, str],
    harga: dict[int, int],
    acak: np.random.Generator,
) -> Nota:
    """
    terjual: (usaha_id, barang_id, tanggal, jumlah) dari baris `pergerakan`
    jenis terjual, jumlah positif dalam satuan dasar, persis seperti tertulis
    di buku besar (tiga desimal).
    """
    per_hari: dict[tuple[int, int], list[tuple[int, int]]] = defaultdict(list)
    for usaha_id, barang_id, t, jumlah in terjual:
        q = round(jumlah * 1000)
        if q > 0:
            per_hari[(t.toordinal(), usaha_id)].append((barang_id, q))

    belanja_warung = {
        u: BELANJA_PER_NOTA[j] * float(acak.uniform(1 - SEBARAN_WARUNG, 1 + SEBARAN_WARUNG))
        for u, j in sorted(jenis_usaha.items())
    }

    n_usaha, n_tgl, n_urut, n_menit = [], [], [], []
    b_nota, b_barang, b_jumlah, b_harga = [], [], [], []
    offset = 0

    for (t, u), isi in sorted(per_hari.items()):
        isi.sort()
        jenis = jenis_usaha[u]
        bid = np.array([x[0] for x in isi], dtype=np.int64)
        q = np.array([x[1] for x in isi], dtype=np.int64)
        hrg = np.array([harga[x] for x in bid.tolist()], dtype=np.int64)
        nilai = q * hrg / 1000.0
        omset = float(nilai.sum())
        K = bid.size

        # Banyaknya pembeli: omset dibagi belanja rata-rata hari itu.
        belanja = belanja_warung[u] * math.exp(
            acak.normal(0.0, DERAU_BELANJA) - DERAU_BELANJA**2 / 2
        )
        n = max(1, int(acak.poisson(omset / belanja)))

        # Tiap nota memilih beberapa barang berbeda, peluangnya sebanding
        # dengan nilai jual barang itu hari ini (trik Gumbel top-k).
        L = np.minimum(1 + acak.poisson(TAMBAHAN_BARIS[jenis], n), K)
        kunci = np.log(nilai / omset)[None, :] + acak.gumbel(size=(n, K))
        peringkat = np.argsort(np.argsort(-kunci, axis=1), axis=1)
        isi_nota = peringkat < L[:, None]

        baris_r, baris_b, baris_q = [], [], []
        for j in range(K):
            pembeli = np.flatnonzero(isi_nota[:, j])
            if pembeli.size == 0:
                # Barang yang terjual tapi tidak terpilih nota mana pun tetap
                # harus masuk nota: penjualannya ada di buku besar.
                pembeli = np.array([int(acak.integers(n))])
            jumlah, k = _bagi(int(q[j]), pembeli.size, acak)
            if k < pembeli.size:
                pembeli = np.sort(acak.choice(pembeli, size=k, replace=False))
            baris_r.append(pembeli)
            baris_b.append(np.full(k, bid[j]))
            baris_q.append(jumlah)

        r = np.concatenate(baris_r)
        # Nota yang kehilangan seluruh barisnya (karena penjualannya terlalu
        # kecil untuk dibagi) dibuang, lalu nomornya dirapatkan.
        punya = np.bincount(r, minlength=n) > 0
        baru = np.cumsum(punya) - 1
        n = int(punya.sum())
        r = baru[r]

        urutan = np.lexsort((np.concatenate(baris_b), r))
        b_nota.append(r[urutan] + offset)
        b_barang.append(np.concatenate(baris_b)[urutan])
        b_jumlah.append(np.concatenate(baris_q)[urutan])
        b_harga.append(np.array([harga[x] for x in np.concatenate(baris_b)[urutan].tolist()], dtype=np.int64))

        n_usaha.append(np.full(n, u, dtype=np.int32))
        n_tgl.append(np.full(n, t, dtype=np.int32))
        n_urut.append(np.arange(1, n + 1, dtype=np.int16))
        n_menit.append(_menit(jenis, n, acak))
        offset += n

    def gabung(bagian: list[np.ndarray], tipe) -> np.ndarray:
        return np.concatenate(bagian).astype(tipe) if bagian else np.zeros(0, dtype=tipe)

    return Nota(
        usaha_id=gabung(n_usaha, np.int32),
        tanggal=gabung(n_tgl, np.int32),
        urut=gabung(n_urut, np.int16),
        menit=gabung(n_menit, np.int16),
        baris_nota=gabung(b_nota, np.int64),
        baris_barang=gabung(b_barang, np.int64),
        baris_jumlah=gabung(b_jumlah, np.int64),
        baris_harga=gabung(b_harga, np.int64),
    )


# --------------------------------------------------------------------------
# Penulisan lewat COPY
# --------------------------------------------------------------------------
POTONG_SALIN = 200_000


def _copy(kursor, perintah: str, baris) -> None:
    """Mengirim baris ke COPY dalam potongan, supaya penyangga teks tetap kecil."""
    potongan: list[tuple] = []

    def kirim() -> None:
        buf = io.StringIO()
        csv.writer(buf, lineterminator="\n").writerows(potongan)
        buf.seek(0)
        kursor.copy_expert(perintah, buf)
        potongan.clear()

    for b in baris:
        potongan.append(b)
        if len(potongan) >= POTONG_SALIN:
            kirim()
    if potongan:
        kirim()


def salin_transaksi(kursor, nota: Nota) -> int:
    tgl_iso: dict[int, str] = {}
    tgl_rapat: dict[int, str] = {}
    for t in np.unique(nota.tanggal).tolist():
        d = date.fromordinal(t)
        tgl_iso[t] = d.isoformat()
        tgl_rapat[t] = d.strftime("%Y%m%d")

    def baris():
        for i, (u, t, n, m) in enumerate(
            zip(nota.usaha_id.tolist(), nota.tanggal.tolist(), nota.urut.tolist(), nota.menit.tolist())
        ):
            hari = tgl_iso[t]
            yield (
                i + 1,
                u,
                f"{tgl_rapat[t]}-{u:03d}-{n:03d}",
                f"{hari} {m // 60:02d}:{m % 60:02d}:00+00",
                KASIR,
                SUMBER,
                "f",
                f"{hari} 20:30:00+00",
            )

    _copy(
        kursor,
        "COPY transaksi (id, usaha_id, nomor_struk, waktu, kasir, sumber, dibatalkan, "
        "diproses_pada) FROM STDIN WITH (FORMAT csv)",
        baris(),
    )
    return nota.n_nota


def salin_transaksi_baris(kursor, nota: Nota, nama: dict[int, str], satuan: dict[int, str]) -> int:
    def baris():
        for i, (r, b, q, h) in enumerate(
            zip(
                nota.baris_nota.tolist(),
                nota.baris_barang.tolist(),
                nota.baris_jumlah.tolist(),
                nota.baris_harga.tolist(),
            )
        ):
            yield (i + 1, r + 1, nama[b], f"{q // 1000}.{q % 1000:03d}", satuan[b], h)

    _copy(
        kursor,
        "COPY transaksi_baris (id, transaksi_id, nama_menu, jumlah, satuan, harga_jual_satuan) "
        "FROM STDIN WITH (FORMAT csv)",
        baris(),
    )
    return nota.n_baris
