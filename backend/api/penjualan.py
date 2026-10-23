"""
Ringkasan Penjualan (revisi 23 Okt 2026): satu halaman di tiap portal.

* **Pemilik usaha**: dari nota kasir (`transaksi` + `transaksi_baris`, harga
  jual dibawa struknya). UMKM produsen (jenis `produksi-makanan`) tidak berkasir,
  jadi ringkasannya dari penjualan ke pembeli usaha (`penjualan`).
* **Distributor**: dari pesanan yang sudah selesai di sisinya, yaitu status
  selesai, selesai-catatan, atau dikirim yang sudah ditandai sampai (sama dengan
  tab "Selesai" di portalnya). Pendapatan = nilai barang + ongkos kirim.

Tidak ada biaya promosi dan laba kotor: harga pokok per menu tidak tersedia.

Data demo tidak dihitung: nota `DEMO-` dan pesanan variasi demo (`PS-…-V…`,
`PS-…-W…`). Tanggal adalah tanggal usaha, `(waktu AT TIME ZONE 'UTC')::date`,
sama dengan Mesin 1 dan halaman Produksi: data simulasi menyimpan jam setempat
sebagai UTC.

Rentang bawaan: 30 hari yang berakhir di tanggal data terakhir, bukan hari ini.
Data simulasi berhenti 5 Okt 2026, dan rentang yang berakhir hari ini akan kosong.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlmodel import Session

from warungku.basis_data import mesin
from warungku.model import Usaha

from .otentikasi import distributor_saya, usaha_saya
from .skema import BarisTerlaris, PenjualanHarian, PihakTeratas, RincianNilai, RingkasanPenjualan

rute_umkm = APIRouter(prefix="/usaha/{usaha_id}", tags=["penjualan"])
rute_distributor = APIRouter(prefix="/distributor/{distributor_id}", tags=["penjualan"])

HARI_BAWAAN = 30
HARI_MAKS = 366
BANYAK_TERLARIS = 10
BANYAK_PIHAK = 5

#: Batas waktu sebagai tanggal usaha, tetap memakai indeks pada kolom waktu.
_ANTARA = "{k} >= CAST(:a AS timestamp) AT TIME ZONE 'UTC' AND {k} < CAST(:b AS timestamp) AT TIME ZONE 'UTC'"

#: Nota yang dihitung: tidak batal dan bukan nota demo.
_NOTA = "t.usaha_id = :u AND NOT t.dibatalkan AND t.nomor_struk NOT LIKE 'DEMO-%'"

#: Pesanan selesai di sisi distributor, tanpa variasi demo.
_SELESAI = (
    "p.distributor_id = :d"
    " AND (p.status IN ('selesai', 'selesai-catatan') OR (p.status = 'dikirim' AND p.kirim_waktu_sampai IS NOT NULL))"
    " AND p.nomor NOT LIKE 'PS-%-V%' AND p.nomor NOT LIKE 'PS-%-W%'"
)


def _rentang(dari: date | None, sampai: date | None, terakhir: date | None) -> tuple[date, date]:
    akhir = sampai or terakhir or date.today()
    awal = dari or akhir - timedelta(days=HARI_BAWAAN - 1)
    if awal > akhir:
        raise HTTPException(422, "Tanggal awal harus sama dengan atau sebelum tanggal akhir.")
    if (akhir - awal).days >= HARI_MAKS:
        raise HTTPException(422, "Rentang paling panjang satu tahun.")
    return awal, akhir


def _isi_hari(awal: date, akhir: date, baris) -> list[PenjualanHarian]:
    """Semua tanggal di rentang, termasuk yang kosong, supaya grafiknya tidak bolong."""
    ada = {r.tanggal: r for r in baris}
    hasil, t = [], awal
    while t <= akhir:
        r = ada.get(t)
        hasil.append(PenjualanHarian(tanggal=t, total=int(r.total) if r else 0, jumlah=int(r.jumlah) if r else 0))
        t += timedelta(days=1)
    return hasil


def _ringkasan(
    sesi: Session,
    *,
    sumber: str,
    kunci: dict,
    terakhir: date | None,
    dari: date | None,
    sampai: date | None,
    sql_harian: str,
    sql_total: str,
    sql_terlaris: str,
    sql_pihak: str | None,
    sql_rincian: str | None = None,
) -> RingkasanPenjualan:
    """Kerangka bersama ketiga sumber; tiap sumber menyumbang kueri SQL-nya."""
    awal, akhir = _rentang(dari, sampai, terakhir)
    panjang = (akhir - awal).days + 1
    batas = {**kunci, "a": awal, "b": akhir + timedelta(days=1)}
    batas_lalu = {**kunci, "a": awal - timedelta(days=panjang), "b": awal}

    harian = sesi.exec(text(sql_harian).bindparams(**batas)).all()
    total = sesi.exec(text(sql_total).bindparams(**batas)).one()
    lalu = sesi.exec(text(sql_total).bindparams(**batas_lalu)).one()
    terlaris = sesi.exec(text(sql_terlaris).bindparams(**batas, n=BANYAK_TERLARIS)).all()
    pihak = sesi.exec(text(sql_pihak).bindparams(**batas, n=BANYAK_PIHAK)).all() if sql_pihak else []
    rincian = sesi.exec(text(sql_rincian).bindparams(**batas)).one() if sql_rincian else None

    jumlah = int(total.jumlah or 0)
    nilai = int(total.total or 0)
    return RingkasanPenjualan(
        sumber=sumber,
        dari=awal,
        sampai=akhir,
        data_terakhir=terakhir,
        total=nilai,
        jumlah_transaksi=jumlah,
        jumlah_pihak=int(total.pihak) if "pihak" in total._fields and total.pihak is not None else None,
        rata_rata=round(nilai / jumlah) if jumlah else 0,
        pembanding_total=int(lalu.total or 0),
        pembanding_jumlah=int(lalu.jumlah or 0),
        rincian=[RincianNilai(label=k, nilai=int(v or 0)) for k, v in rincian._mapping.items()] if rincian else [],
        per_hari=_isi_hari(awal, akhir, harian),
        terlaris=[BarisTerlaris(nama=r.nama, satuan=r.satuan, jumlah=float(r.jumlah), total=int(r.total)) for r in terlaris],
        pihak_teratas=[PihakTeratas(nama=r.nama, jumlah=int(r.jumlah), total=int(r.total)) for r in pihak],
    )


def _nota(sesi: Session, usaha_id: int, dari: date | None, sampai: date | None) -> RingkasanPenjualan:
    terakhir = sesi.exec(
        text(f"SELECT max((t.waktu AT TIME ZONE 'UTC')::date) FROM transaksi t WHERE {_NOTA}").bindparams(u=usaha_id)
    ).scalar()
    waktu = _ANTARA.format(k="t.waktu")
    nilai_baris = "COALESCE(SUM(b.jumlah * b.harga_jual_satuan), 0)"
    return _ringkasan(
        sesi,
        sumber="nota",
        kunci={"u": usaha_id},
        terakhir=terakhir,
        dari=dari,
        sampai=sampai,
        sql_harian=f"""
            SELECT (t.waktu AT TIME ZONE 'UTC')::date AS tanggal, round({nilai_baris}) AS total,
                   COUNT(DISTINCT t.id) AS jumlah
              FROM transaksi t JOIN transaksi_baris b ON b.transaksi_id = t.id
             WHERE {_NOTA} AND {waktu}
             GROUP BY 1""",
        sql_total=f"""
            SELECT round({nilai_baris}) AS total, COUNT(DISTINCT t.id) AS jumlah
              FROM transaksi t JOIN transaksi_baris b ON b.transaksi_id = t.id
             WHERE {_NOTA} AND {waktu}""",
        sql_terlaris=f"""
            SELECT b.nama_menu AS nama, b.satuan, SUM(b.jumlah) AS jumlah, round({nilai_baris}) AS total
              FROM transaksi t JOIN transaksi_baris b ON b.transaksi_id = t.id
             WHERE {_NOTA} AND {waktu}
             GROUP BY b.nama_menu, b.satuan
             ORDER BY total DESC, nama LIMIT :n""",
        sql_pihak=None,
    )


def _penjualan_usaha(sesi: Session, usaha_id: int, dari: date | None, sampai: date | None) -> RingkasanPenjualan:
    terakhir = sesi.exec(
        text("SELECT max((p.waktu AT TIME ZONE 'UTC')::date) FROM penjualan p WHERE p.usaha_id = :u").bindparams(
            u=usaha_id
        )
    ).scalar()
    waktu = _ANTARA.format(k="p.waktu")
    return _ringkasan(
        sesi,
        sumber="penjualan-usaha",
        kunci={"u": usaha_id},
        terakhir=terakhir,
        dari=dari,
        sampai=sampai,
        sql_harian=f"""
            SELECT (p.waktu AT TIME ZONE 'UTC')::date AS tanggal, SUM(p.total) AS total, COUNT(*) AS jumlah
              FROM penjualan p WHERE p.usaha_id = :u AND {waktu} GROUP BY 1""",
        sql_total=f"""
            SELECT COALESCE(SUM(p.total), 0) AS total, COUNT(*) AS jumlah, COUNT(DISTINCT p.pembeli_id) AS pihak
              FROM penjualan p WHERE p.usaha_id = :u AND {waktu}""",
        sql_terlaris=f"""
            SELECT pj.nama, pj.satuan, SUM(pb.jumlah) AS jumlah, SUM(pb.jumlah * pb.harga_satuan)::bigint AS total
              FROM penjualan p
              JOIN penjualan_baris pb ON pb.penjualan_id = p.id
              JOIN produk_jadi pj ON pj.id = pb.produk_jadi_id
             WHERE p.usaha_id = :u AND {waktu}
             GROUP BY pj.nama, pj.satuan
             ORDER BY total DESC, pj.nama LIMIT :n""",
        sql_pihak=f"""
            SELECT pm.nama, COUNT(p.id) AS jumlah, SUM(p.total) AS total
              FROM penjualan p JOIN pembeli pm ON pm.id = p.pembeli_id
             WHERE p.usaha_id = :u AND {waktu}
             GROUP BY pm.nama
             ORDER BY total DESC, pm.nama LIMIT :n""",
    )


@rute_umkm.get("/ringkasan-penjualan", response_model=RingkasanPenjualan)
def ringkasan_usaha(
    usaha_id: int = Depends(usaha_saya),
    dari: date | None = Query(default=None, description="tanggal awal (YYYY-MM-DD)"),
    sampai: date | None = Query(default=None, description="tanggal akhir; bawaan: tanggal data terakhir"),
) -> RingkasanPenjualan:
    """Ringkasan penjualan usaha: dari nota kasir, atau dari penjualan ke pembeli untuk UMKM produsen."""
    with Session(mesin()) as sesi:
        u = sesi.get(Usaha, usaha_id)
        if u is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        if str(getattr(u.jenis_usaha, "value", u.jenis_usaha)) == "produksi-makanan":
            return _penjualan_usaha(sesi, usaha_id, dari, sampai)
        return _nota(sesi, usaha_id, dari, sampai)


@rute_distributor.get("/ringkasan-penjualan", response_model=RingkasanPenjualan)
def ringkasan_distributor(
    distributor_id: int = Depends(distributor_saya),
    dari: date | None = Query(default=None, description="tanggal awal (YYYY-MM-DD)"),
    sampai: date | None = Query(default=None, description="tanggal akhir; bawaan: tanggal data terakhir"),
) -> RingkasanPenjualan:
    """Ringkasan penjualan distributor dari pesanan yang sudah selesai, menurut tanggal pesanan."""
    nilai_pesanan = "(SELECT COALESCE(SUM(b.jumlah * b.harga_satuan), 0) FROM pesanan_baris b WHERE b.pesanan_id = p.id)"
    waktu = _ANTARA.format(k="p.dibuat_pada")
    with Session(mesin()) as sesi:
        terakhir = sesi.exec(
            text(f"SELECT max((p.dibuat_pada AT TIME ZONE 'UTC')::date) FROM pesanan p WHERE {_SELESAI}").bindparams(
                d=distributor_id
            )
        ).scalar()
        return _ringkasan(
            sesi,
            sumber="pesanan-selesai",
            kunci={"d": distributor_id},
            terakhir=terakhir,
            dari=dari,
            sampai=sampai,
            sql_harian=f"""
                SELECT (p.dibuat_pada AT TIME ZONE 'UTC')::date AS tanggal,
                       round(SUM({nilai_pesanan} + p.ongkos_kirim)) AS total, COUNT(*) AS jumlah
                  FROM pesanan p WHERE {_SELESAI} AND {waktu} GROUP BY 1""",
            sql_total=f"""
                SELECT round(COALESCE(SUM({nilai_pesanan} + p.ongkos_kirim), 0)) AS total, COUNT(*) AS jumlah,
                       COUNT(DISTINCT p.usaha_id) AS pihak
                  FROM pesanan p WHERE {_SELESAI} AND {waktu}""",
            sql_terlaris=f"""
                SELECT b.nama, b.satuan, SUM(b.jumlah) AS jumlah, round(SUM(b.jumlah * b.harga_satuan)) AS total
                  FROM pesanan p JOIN pesanan_baris b ON b.pesanan_id = p.id
                 WHERE {_SELESAI} AND {waktu}
                 GROUP BY b.nama, b.satuan
                 ORDER BY total DESC, b.nama LIMIT :n""",
            sql_pihak=f"""
                SELECT u.nama, COUNT(p.id) AS jumlah, round(SUM({nilai_pesanan} + p.ongkos_kirim)) AS total
                  FROM pesanan p JOIN usaha u ON u.id = p.usaha_id
                 WHERE {_SELESAI} AND {waktu}
                 GROUP BY u.nama
                 ORDER BY total DESC, u.nama LIMIT :n""",
            sql_rincian=f"""
                SELECT round(COALESCE(SUM({nilai_pesanan}), 0)) AS "Nilai barang",
                       COALESCE(SUM(p.ongkos_kirim), 0) AS "Ongkos kirim"
                  FROM pesanan p WHERE {_SELESAI} AND {waktu}""",
        )
