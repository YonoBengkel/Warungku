"""
Mesin 2 saat dipakai sungguhan: menilai kandidat hari ini, menulis ke `rekomendasi_skor`.

Bedanya dengan `evaluasi.py`. Di sana kandidat dirakit dari matriks
counterfactual, dan labelnya diketahui — itu evaluasi. Di sini kandidat dirakit
dari `penawaran` yang benar-benar ada hari ini, dan tidak ada label sama sekali.

Satu hal yang membuat berkas ini tidak sekadar pengulangan: **vektor fiturnya
harus dirakit dengan cara yang sama persis seperti saat dilatih.** Kalau urutan
kolomnya bergeser, atau `p_rasio_harga` dihitung terhadap pembanding yang
berbeda, model menerima angka yang artinya lain dan skornya menjadi karangan
tanpa ada galat yang muncul. Karena itu keduanya memakai `FITUR` dan
`KeadaanDistributor` yang sama.

Modelnya dilatih SEKALI untuk seluruh usaha, lalu dipakai berulang
(`jalankan_semua`). Melatih ulang per usaha akan menjalankan MCMC BART tujuh
puluh kali untuk model yang sama persis.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sqlalchemy import text

from warungku.basis_data import mesin

from ..data import FITUR, muat_fitur_pesanan
from .bandit import ThompsonSampling
from .beta import BetaBernoulli, kunci_dari
from .fuzzy import ATURAN_BAWAAN
from .keadaan import KeadaanDistributor, muat_keadaan, muat_ulasan

#: Berapa lama skor dianggap masih berlaku. Skor Mesin 2 bergantung pada harga
#: dan stok distributor yang bisa berubah hari itu juga, jadi ia disinggahkan
#: pendek — bukan disimpan sebagai angka tetap seperti perkiraan permintaan.
UMUR_SKOR = timedelta(hours=12)

#: Berapa kandidat teratas yang disimpan per barang. Layar menampilkan tiga.
#: Menyimpan semuanya berarti menulis puluhan ribu baris tiap kali jalan untuk
#: angka yang tidak pernah dilihat siapa pun.
SIMPAN_TERATAS = 3


def keadaan_sekarang() -> KeadaanDistributor:
    """Keadaan distributor hari ini: seluruh riwayat diputar ulang."""
    k = muat_keadaan()
    df = muat_fitur_pesanan()
    for _, r in df.sort_values("tanggal").iterrows():
        k.perbarui(r)
    for r in muat_ulasan().itertuples():
        k.catat_ulasan(int(r.distributor_id))
    return k


def kandidat_untuk(usaha_id: int) -> pd.DataFrame:
    """
    Penawaran yang layak untuk tiap barang usaha ini, hari ini.

    "Layak" berarti tiga hal sekaligus: produknya sama (lewat
    `produk_master_id`, bukan kecocokan nama — "Gula Pasir" dan "Gula pasir
    1kg" adalah produk yang sama), penawarannya aktif, dan kotanya masuk area
    kirim distributor. Tanpa saringan ketiga, model akan menyarankan
    distributor yang tidak akan pernah mau mengirim ke sana, dan pemilik warung
    kehilangan kepercayaan pada seluruh daftar saran.
    """
    with mesin().connect() as kon:
        return pd.read_sql_query(
            text(
                """
                SELECT b.id AS barang_id, b.nama AS nama_barang,
                       b.stok::float8 AS stok, b.batas_aman::float8 AS batas_aman,
                       pn.id AS penawaran_id, pn.distributor_id,
                       pn.harga_satuan, pn.kemasan_isi::float8 AS kemasan_isi,
                       pn.stok_tersedia::float8 AS stok_distributor,
                       d.nama AS nama_distributor, d.minimum_pesanan
                  FROM barang b
                  JOIN usaha u ON u.id = b.usaha_id
                  JOIN penawaran pn ON pn.produk_master_id = b.produk_master_id
                  JOIN distributor d ON d.id = pn.distributor_id
                 WHERE b.usaha_id = :u
                   AND pn.aktif = true
                   AND u.kota = ANY(d.area_kirim)
                """
            ).bindparams(u=usaha_id),
            kon,
        )


def _angka(x: float, desimal: int = 0) -> str:
    """Angka gaya Indonesia untuk kalimat di layar: 2.029 dan 4,8, bukan 2029 dan 4.8."""
    teks = f"{x:,.{desimal}f}"
    return teks.replace(",", "\u2009").replace(".", ",").replace("\u2009", ".")


def _alasan(baris: dict) -> str:
    """
    Satu kalimat, bahasa pemilik warung. Layar menuntutnya.

    Alasan dirakit dari fitur yang benar-benar dipakai model, bukan dikarang
    terpisah. Kalimat yang tidak bersumber dari fitur akan cepat bertentangan
    dengan skornya sendiri — misalnya menyebut "paling murah" untuk kandidat
    yang justru dipilih karena keandalannya.
    """
    bagian = []
    if baris["p_rasio_harga"] <= 1.001:
        bagian.append("harganya paling murah")
    elif baris["p_rasio_harga"] <= 1.05:
        bagian.append("harganya hampir sama dengan yang termurah")
    else:
        bagian.append("harganya %d%% di atas yang termurah" % round(100 * (baris["p_rasio_harga"] - 1)))

    if baris["d_pesanan_selesai"] >= 20:
        bagian.append(
            "sudah %s pesanan selesai dengan ketepatan waktu %s dari 5"
            % (_angka(baris["d_pesanan_selesai"]), _angka(baris["d_aspek_ketepatan"], 1))
        )
    elif baris["d_pesanan_selesai"] >= 1:
        bagian.append("riwayatnya masih singkat (%d pesanan)" % baris["d_pesanan_selesai"])
    else:
        bagian.append("belum punya riwayat pesanan di sini")

    if baris["p_sekota"] >= 0.5:
        bagian.append("gudangnya di kota yang sama")

    # Peringatan dipisah dari daftar sifat. Disambung dengan "dan" seperti
    # yang lain, ia menghasilkan "dan tapi nilai pesanan belum memenuhi
    # minimum" — kalimat yang akan dibaca pemilik warung di layar.
    peringatan = (
        " Catatan: nilai pesanan belum memenuhi minimum distributor."
        if baris["p_minimum_terpenuhi"] < 0.5
        else ""
    )
    if len(bagian) == 1:
        inti = bagian[0]
    else:
        inti = ", ".join(bagian[:-1]) + ", dan " + bagian[-1]
    return inti.capitalize() + "." + peringatan


def latih_model(penaksir: str = "beta"):
    """
    Latih penaksir pada seluruh riwayat sampai hari ini.

    Berbeda dari evaluasi, yang sengaja menahan 35 hari terakhir: di produksi
    tidak ada alasan membuang data terbaru, dan justru data terbarulah yang
    paling menggambarkan keadaan distributor sekarang.

    Bawaannya Beta-Bernoulli: "pelatihannya" adalah menghitung sukses dan gagal
    tiap distributor per kondisi dari seluruh pesanan yang sudah selesai.
    """
    df = muat_fitur_pesanan()
    if penaksir == "beta":
        X = df[list(FITUR)].to_numpy(dtype=float)
        model = BetaBernoulli()
        kunci = [kunci_dari(int(d), x, pisah_konteks=model.pisah_konteks) for d, x in zip(df["distributor_id"], X)]
        model.latih(X, df["sukses"].to_numpy(dtype=int), kunci=kunci)
        return model

    from .bandit import BanditLengkap
    from .penaksir import BartBayesian, LogistikBayesian, PohonBootstrap

    kelas = {"bart": BartBayesian, "logistik": LogistikBayesian, "pohon": PohonBootstrap}[penaksir]
    model = BanditLengkap(kelas(), ThompsonSampling())
    model.latih(df[list(FITUR)].to_numpy(dtype=float), df["sukses"].to_numpy(dtype=int))
    return model


def jalankan(
    usaha_id: int,
    *,
    thompson: bool = True,
    model=None,
    nama_model: str = "beta",
) -> dict:
    """
    Nilai seluruh kandidat untuk satu usaha, tulis `SIMPAN_TERATAS` teratas.

    `thompson=True` memakai pencuplikan untuk eksplorasi. Di produksi itu yang
    diinginkan: tanpa eksplorasi, distributor baru tidak pernah terpilih, jadi
    tidak pernah punya riwayat, jadi tidak pernah terpilih. Tapi ia membuat
    keluarannya **tidak deterministik** — dua kali jalan memberi urutan berbeda,
    dan itu harus disadari sebelum ada yang melaporkannya sebagai bug.
    """
    import time

    mulai = time.perf_counter()
    jalan_id = uuid.uuid4().hex[:16]
    sekarang = datetime.now(timezone.utc)
    hari_ini = sekarang.date()

    acak_global = np.random.default_rng()
    kandidat = kandidat_untuk(usaha_id)
    if kandidat.empty:
        return {"jalan_id": jalan_id, "barang": 0, "baris": 0, "detik": 0.0}

    keadaan = keadaan_sekarang()

    if model is None:
        model = latih_model()

    baris_keluar: list[dict] = []
    for barang_id, g in kandidat.groupby("barang_id", sort=True):
        butuh = max(0.0, float(g["batas_aman"].iloc[0]) * 2 - float(g["stok"].iloc[0]))
        if butuh <= 0:
            continue

        g = g.copy()
        g["jumlah_kemasan"] = np.maximum(1.0, np.ceil(butuh / g["kemasan_isi"].clip(lower=1e-6)))
        g["nilai"] = (g["harga_satuan"] * g["jumlah_kemasan"]).astype(int)
        per_satuan = g["harga_satuan"] / g["kemasan_isi"].clip(lower=1e-6)
        # Pembanding harga adalah kandidat termurah DI KEPUTUSAN INI, sama
        # seperti saat melatih. Memakai harga acuan produk atau rata-rata pasar
        # akan memberi angka yang artinya lain pada kolom yang sama.
        g["rasio_harga"] = per_satuan / max(1e-9, float(per_satuan.min()))

        fitur = [
            keadaan.fitur(
                distributor_id=int(r.distributor_id),
                usaha_id=usaha_id,
                tanggal=hari_ini,
                rasio_harga=float(r.rasio_harga),
                nilai=int(r.nilai),
            )
            for r in g.itertuples()
        ]
        X = np.array([[f[k] for k in FITUR] for f in fitur], dtype=float)
        rasio = g["rasio_harga"].to_numpy(dtype=float)
        segmen: list[str | None] = [None] * len(g)
        catatan_beta: list[str] = [""] * len(g)

        if isinstance(model, BetaBernoulli):
            # Jalur utama: keandalan Beta per distributor dan kondisi, satu
            # cuplikan Thompson untuk eksplorasi, lalu fuzzy menimbang harga.
            kunci = [kunci_dari(int(d), x, pisah_konteks=model.pisah_konteks) for d, x in zip(g["distributor_id"], X)]
            p, _sigma = model.peluang_dan_sebaran(X, kunci=kunci)
            keandalan = model.cuplik(kunci, acak_global) if thompson else p
            skor = ATURAN_BAWAAN.skor(keandalan, rasio)
            # Segmen dihitung dari keandalan TAKSIRAN, bukan cuplikan, supaya
            # label yang dibaca pemilik warung tidak berganti tiap penyegaran.
            # Urutan tetap memakai cuplikan; itulah yang memberi eksplorasi.
            segmen = ATURAN_BAWAAN.segmen(ATURAN_BAWAAN.skor(p, rasio))
            for j, k in enumerate(kunci):
                a, b = model.parameter(k)
                total = int(round(a + b - 2))
                # "Serupa" hanya benar kalau hitungannya dipisah per kondisi.
                cakupan = "pesanan serupa" if model.pisah_konteks else "pesanan"
                catatan_beta[j] = (
                    " %s dari %s %s sebelumnya ke distributor ini berjalan mulus."
                    % (_angka(round(a - 1)), _angka(total), cakupan)
                    if total > 0 else " Belum ada %s sebelumnya ke distributor ini." % cakupan
                )
            urut = np.argsort(-skor)[:SIMPAN_TERATAS]
            nama_tulis = "beta+thompson+fuzzy" if thompson else "beta+fuzzy"
        else:
            # Penaksir lama (BART, logistik): peluang sukses x utilitas harga.
            # `peluang_murni` dan bukan `peluang`: yang ditampilkan ke pemilik
            # warung harus taksiran, bukan cuplikan Thompson.
            p = np.clip(np.asarray(model.peluang_murni(X), dtype=float), 0.0, 1.0)
            if thompson:
                _p, sigma = model.penaksir.peluang_dan_sebaran(X)
                skor = ThompsonSampling().skor(p, sigma, acak_global)
            else:
                skor = p.copy()
            skor = skor / rasio
            urut = np.argsort(-skor)[:SIMPAN_TERATAS]
            nama_tulis = nama_model + ("+thompson" if thompson else "")

        for i in urut:
            r = g.iloc[int(i)]
            baris_keluar.append(
                {
                    "usaha_id": usaha_id,
                    "barang_id": int(barang_id),
                    "penawaran_id": int(r["penawaran_id"]),
                    "distributor_id": int(r["distributor_id"]),
                    "p_sukses": float(round(p[int(i)], 4)),
                    "skor": float(round(skor[int(i)], 4)),
                    "alasan": _alasan(fitur[int(i)] | {"nama": r["nama_distributor"]}) + catatan_beta[int(i)],
                    "segmen": segmen[int(i)],
                    "model_nama": nama_tulis,
                    "model_versi": "0.1",
                    "dijalankan_pada": sekarang,
                    "kedaluwarsa_pada": sekarang + UMUR_SKOR,
                }
            )

    if baris_keluar:
        from warungku.model import RekomendasiSkor

        with mesin().begin() as kon:
            # Skor lama untuk usaha ini dihapus. Berbeda dari `prediksi`, yang
            # riwayatnya dipertahankan: skor ini singgahan, bukan catatan.
            # Menyimpan riwayatnya akan menumpuk ratusan ribu baris yang tidak
            # pernah dibaca, dan setiap kueri harus menyaring mana yang terbaru.
            kon.execute(
                text("DELETE FROM rekomendasi_skor WHERE usaha_id = :u"), {"u": usaha_id}
            )
            kon.execute(RekomendasiSkor.__table__.insert(), baris_keluar)

    return {
        "jalan_id": jalan_id,
        "barang": int(kandidat["barang_id"].nunique()),
        "baris": len(baris_keluar),
        "detik": round(time.perf_counter() - mulai, 2),
    }


def jalankan_semua(penaksir: str = "beta", thompson: bool = True) -> dict:
    """
    Nilai kandidat untuk SELURUH usaha dengan satu kali pelatihan.

    Inilah jalur yang dipakai penjadwal. Memanggil `jalankan()` tujuh puluh
    kali akan melatih model yang sama tujuh puluh kali — pada BART itu berarti
    satu setengah jam untuk pekerjaan dua menit.
    """
    import time

    from sqlalchemy import text as _text

    mulai = time.perf_counter()
    model = latih_model(penaksir)
    with mesin().connect() as kon:
        usaha = [int(r[0]) for r in kon.execute(_text("SELECT id FROM usaha ORDER BY id")).all()]

    total_baris = 0
    total_barang = 0
    for uid in usaha:
        h = jalankan(uid, thompson=thompson, model=model, nama_model=penaksir)
        total_baris += h["baris"]
        total_barang += h["barang"]

    return {
        "usaha": len(usaha),
        "barang": total_barang,
        "baris": total_baris,
        "penaksir": penaksir,
        "detik": round(time.perf_counter() - mulai, 2),
    }
