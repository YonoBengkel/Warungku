"""
Mesin 3 saat dijalankan: RFM per pelanggan, kelompokkan, beri nama, tulis tabel.

Keluarannya bukan nomor kelompok. Nomor kelompok tidak bisa dipakai siapa pun —
distributor tidak akan membuka halaman untuk membaca "Anda punya 14 pelanggan
di kelompok 3". Yang ditulis adalah kelompok bernama beserta satu kalimat ciri
dan satu kalimat saran tindakan.

Penamaannya dilakukan **setelah** pengelompokan, dari posisi pusat kelompok
terhadap kelompok lain — bukan dengan memaksa k ke angka tertentu lalu
menempelkan nama berurutan. Kalau datanya hanya membentuk tiga kelompok
bermakna, yang keluar tiga, bukan enam yang dua di antaranya kembar.
"""

from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd
from sqlalchemy import text

from warungku.basis_data import mesin

from .kprototypes import gamma_bawaan, kprototypes, siluet

#: Kolom numerik, urutannya tetap: recency, frequency, monetary, lama berlangganan.
NUM = ("recency", "frequency", "monetary", "lama_berlangganan")
KAT = ("jenis_usaha", "kategori_utama")

#: Pelanggan dengan kurang dari ini pesanan tidak diikutkan pengelompokan.
#: Satu pesanan tidak cukup untuk menyebut seseorang "pelanggan rutin" atau
#: "pelanggan yang mulai menghilang"; ia hanya orang yang pernah mencoba sekali.
MIN_PESANAN = 2

#: Berapa kelompok dicoba. Yang dipakai dipilih dengan skor siluet.
K_DICOBA = (3, 4, 5, 6)


def muat_rfm(tanggal_acuan: date | None = None) -> pd.DataFrame:
    """
    RFM per (distributor, pelanggan), dihitung dari pesanan yang tidak ditolak.

    Pesanan berstatus `draf` dan `batal` sengaja tidak dihitung: keduanya tidak
    pernah menjadi belanja, dan memasukkannya akan membuat pelanggan yang
    sering batal tampak lebih sering memesan daripada yang sebenarnya diterima.
    """
    with mesin().connect() as kon:
        df = pd.read_sql_query(
            text(
                """
                SELECT p.distributor_id,
                       p.usaha_id,
                       u.jenis_usaha,
                       COUNT(*)                                        AS frequency,
                       MAX((p.dibuat_pada AT TIME ZONE 'UTC')::date)   AS terakhir,
                       MIN((p.dibuat_pada AT TIME ZONE 'UTC')::date)   AS pertama,
                       COALESCE(SUM(pb.nilai), 0)::bigint              AS monetary
                  FROM pesanan p
                  JOIN usaha u ON u.id = p.usaha_id
                  LEFT JOIN LATERAL (
                      SELECT SUM(b.jumlah * b.harga_satuan)::bigint AS nilai
                        FROM pesanan_baris b WHERE b.pesanan_id = p.id
                  ) pb ON true
                 WHERE p.status NOT IN ('draf', 'batal')
                 GROUP BY p.distributor_id, p.usaha_id, u.jenis_usaha
                """
            ),
            kon,
        )
        kategori = pd.read_sql_query(
            text(
                """
                SELECT p.distributor_id, p.usaha_id, pn.kategori,
                       SUM(pb.jumlah * pb.harga_satuan)::bigint AS nilai
                  FROM pesanan p
                  JOIN pesanan_baris pb ON pb.pesanan_id = p.id
                  JOIN penawaran pn ON pn.id = pb.penawaran_id
                 WHERE p.status NOT IN ('draf', 'batal')
                 GROUP BY 1, 2, 3
                """
            ),
            kon,
        )

    # Kategori yang paling banyak dibelanjakan, per pasangan.
    utama = (
        kategori.sort_values("nilai", ascending=False)
        .groupby(["distributor_id", "usaha_id"], as_index=False)
        .first()[["distributor_id", "usaha_id", "kategori"]]
        .rename(columns={"kategori": "kategori_utama"})
    )
    df = df.merge(utama, on=["distributor_id", "usaha_id"], how="left")
    df["kategori_utama"] = df["kategori_utama"].fillna("lainnya")

    acuan = tanggal_acuan or pd.to_datetime(df["terakhir"]).max().date()
    df["recency"] = (pd.Timestamp(acuan) - pd.to_datetime(df["terakhir"])).dt.days
    df["lama_berlangganan"] = (pd.Timestamp(acuan) - pd.to_datetime(df["pertama"])).dt.days
    df["jenis_usaha"] = df["jenis_usaha"].astype(str)
    df.attrs["tanggal_acuan"] = acuan
    return df


# --------------------------------------------------------------------------
NAMA_SEGMEN: dict[str, tuple[str, str, str]] = {
    "andalan": (
        "Pelanggan andalan",
        "Paling sering memesan dengan belanja paling besar.",
        "Tawarkan paket kontrak atau promo keanggotaan supaya mereka bertahan.",
    ),
    "rutin": (
        "Pelanggan rutin",
        "Memesan lebih sering daripada kebanyakan toko, belanjanya sedang.",
        "Tawarkan kontrak supaya kuotanya pasti dan jadwal kirim bisa direncanakan.",
    ),
    "sedang": (
        "Pelanggan sedang",
        "Frekuensi dan belanjanya di tengah-tengah.",
        "Kabari promo untuk kategori yang paling sering mereka beli.",
    ),
    "baru": (
        "Pelanggan baru",
        "Baru mulai memesan belakangan ini.",
        "Pastikan kiriman pertamanya tepat waktu dan jumlahnya pas.",
    ),
    "jarang": (
        "Pelanggan yang mulai menjauh",
        "Sudah lama tidak memesan dibanding biasanya.",
        "Hubungi dan tanyakan kendalanya sebelum mereka pindah.",
    ),
    "kecil": (
        "Pelanggan kecil",
        "Belanjanya kecil dan jarang.",
        "Biarkan berjalan apa adanya; jangan habiskan ongkos promo di sini.",
    ),
}


def _beri_nama(pusat_num: np.ndarray, kolom: tuple[str, ...]) -> list[str]:
    """
    Terjemahkan posisi pusat kelompok menjadi nama yang berarti.

    Dilakukan dari **peringkat relatif antar kelompok**, bukan dari ambang
    mutlak. Ambang mutlak ("belanja di atas 5 juta = andalan") akan salah
    begitu ia dipakai distributor yang skalanya berbeda — dan tiap distributor
    memang berbeda skala.
    """
    i_r, i_f, i_m, i_l = (kolom.index(c) for c in ("recency", "frequency", "monetary", "lama_berlangganan"))
    k = len(pusat_num)

    def peringkat(i: int) -> np.ndarray:
        """0 = terendah, 1 = tertinggi, dalam skala 0..1 antar kelompok."""
        v = pusat_num[:, i]
        urut = np.argsort(np.argsort(v))
        return urut / max(1, k - 1)

    p_r, p_f, p_m, p_l = peringkat(i_r), peringkat(i_f), peringkat(i_m), peringkat(i_l)

    nama: list[str] = []
    for c in range(k):
        if p_l[c] <= 0.25 and p_f[c] <= 0.5:
            nama.append("baru")
        elif p_r[c] >= 0.75:
            nama.append("jarang")
        elif p_f[c] >= 0.75 and p_m[c] >= 0.75:
            nama.append("andalan")
        elif p_f[c] >= 0.5:
            nama.append("rutin")
        elif p_m[c] <= 0.25 and p_f[c] <= 0.25:
            nama.append("kecil")
        else:
            nama.append("sedang")

    # Dua kelompok boleh bernama sama kalau memang mirip; yang tidak boleh
    # adalah memaksa nama berbeda demi variasi. Pembeda ditambahkan di layar,
    # bukan di sini.
    return nama


def segmentasi_satu(df: pd.DataFrame, benih: int = 20261006) -> tuple[pd.DataFrame, dict]:
    """Kelompokkan pelanggan satu distributor. Mengembalikan (baris, ringkasan)."""
    df = df[df["frequency"] >= MIN_PESANAN].copy()
    if len(df) < max(K_DICOBA[0] * 2, 8):
        return pd.DataFrame(), {"alasan": "pelanggan terlalu sedikit", "pelanggan": len(df)}

    X_num_mentah = df[list(NUM)].to_numpy(dtype=float)
    # Dibakukan supaya keempat peubah punya bobot setara. Tanpa ini, monetary
    # yang bernilai jutaan akan menenggelamkan recency yang bernilai puluhan,
    # dan kelompoknya hanya akan memisahkan besar-kecil belanja.
    rata, simpang = X_num_mentah.mean(axis=0), X_num_mentah.std(axis=0)
    simpang[simpang < 1e-9] = 1.0
    X_num = (X_num_mentah - rata) / simpang
    X_kat = df[list(KAT)].to_numpy(dtype=object)
    g = gamma_bawaan(X_num)

    terbaik, k_terbaik, skor_terbaik = None, None, -2.0
    semua_skor = {}
    for k in K_DICOBA:
        if len(df) < k * 2:
            continue
        h = kprototypes(X_num, X_kat, k, gamma=g, benih=benih)
        s = siluet(X_num, X_kat, h.label, g)
        semua_skor[k] = round(float(s), 4) if s == s else None
        if s == s and s > skor_terbaik:
            terbaik, k_terbaik, skor_terbaik = h, k, s

    if terbaik is None:
        return pd.DataFrame(), {"alasan": "siluet tidak terdefinisi", "pelanggan": len(df)}

    nama = _beri_nama(terbaik.pusat_angka * simpang + rata, NUM)
    df = df.assign(
        segmen=[nama[c] for c in terbaik.label],
        jarak_ke_pusat=np.round(terbaik.jarak, 4),
    )
    ringkas = {
        "pelanggan": len(df),
        "k": k_terbaik,
        "siluet": round(float(skor_terbaik), 4),
        "gamma": round(float(g), 4),
        "siluet_per_k": semua_skor,
    }
    return df, ringkas


def jalankan(benih: int = 20261006) -> dict:
    """Segmentasi seluruh distributor, tulis ke `segmen_pelanggan`."""
    mulai = time.perf_counter()
    jalan_id = uuid.uuid4().hex[:16]
    sekarang = datetime.now(timezone.utc)

    semua = muat_rfm()
    acuan = semua.attrs["tanggal_acuan"]
    baris: list[dict] = []
    per_distributor: dict[int, dict] = {}

    for distributor_id, g in semua.groupby("distributor_id", sort=True):
        hasil, ringkas = segmentasi_satu(g, benih=benih)
        per_distributor[int(distributor_id)] = ringkas
        if hasil.empty:
            continue
        for r in hasil.itertuples():
            nama_segmen, ciri, saran = NAMA_SEGMEN[r.segmen]
            baris.append(
                {
                    "distributor_id": int(distributor_id),
                    "usaha_id": int(r.usaha_id),
                    "segmen": r.segmen,
                    "nama_segmen": nama_segmen,
                    "ciri": ciri,
                    "saran": saran,
                    "recency": int(r.recency),
                    "frequency": int(r.frequency),
                    "monetary": int(r.monetary),
                    "lama_berlangganan": int(r.lama_berlangganan),
                    "jenis_usaha": str(r.jenis_usaha),
                    "kategori_utama": str(r.kategori_utama),
                    "jarak_ke_pusat": float(r.jarak_ke_pusat),
                    "jalan_id": jalan_id,
                    "model_nama": "kprototypes",
                    "model_versi": "0.1",
                    "dijalankan_pada": sekarang,
                    "tanggal_acuan": acuan,
                }
            )

    if baris:
        from warungku.model import SegmenPelanggan

        with mesin().begin() as kon:
            # Hasil lama dihapus: segmen adalah potret keadaan sekarang, bukan
            # catatan. Menyimpan riwayatnya akan menumpuk baris yang tidak
            # pernah dibaca, dan setiap kueri harus menyaring mana yang terbaru.
            kon.execute(text("DELETE FROM segmen_pelanggan"))
            kon.execute(SegmenPelanggan.__table__.insert(), baris)

    return {
        "jalan_id": jalan_id,
        "distributor": len(per_distributor),
        "baris": len(baris),
        "tanggal_acuan": acuan.isoformat(),
        "per_distributor": per_distributor,
        "detik": round(time.perf_counter() - mulai, 2),
    }
