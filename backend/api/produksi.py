"""
Produksi dan penjualan antarusaha untuk UMKM produsen (sejak 16 Okt 2026).

Dua jalur tulis, masing-masing dalam SATU transaksi basis data:

* **Catat produksi**: bahan baku dipotong sesuai resep (baris `pergerakan`
  jenis `terjual` bertaut `produksi_id`, plus `barang.stok`), stok barang jadi
  bertambah. Berbeda dengan nota kasir, produksi DITOLAK kalau bahannya tidak
  cukup: nota adalah fakta yang sudah terjadi, sedangkan produksi dicatat
  pemiliknya sendiri, dan bahan yang tidak ada tidak mungkin dimasak.
* **Catat kiriman ke pembeli**: stok barang jadi berkurang, ditolak kalau tidak
  cukup.

Invarian yang dijaga: `barang.stok` = jumlah pergerakan, dan `produk_jadi.stok`
= jumlah produksi - jumlah penjualan. Keduanya diperiksa
`skrip/02_periksa_konsistensi.sql`.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import JenisPergerakan
from warungku.model import Barang, Pembeli, Penjualan, PenjualanBaris, Produksi, ProdukJadi, ResepBahan, Usaha

from .otentikasi import usaha_saya
from .skema import (
    BahanResep,
    BarisPenjualanRingkas,
    OmsetBulanan,
    PembeliRingkas,
    PenjualanBaru,
    PenjualanRingkas,
    ProduksiBaru,
    ProduksiRingkas,
    ProdukJadiRingkas,
    RingkasanProduksi,
)

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["produksi"])


def _usaha(sesi: Session, usaha_id: int) -> Usaha:
    u = sesi.get(Usaha, usaha_id)
    if u is None:
        raise HTTPException(404, "Usaha tidak ditemukan.")
    return u


def _tanggal_acuan(sesi: Session, usaha_id: int) -> date:
    """
    Hari kiriman terakhir. Data simulasi berhenti sebelum hari ini, jadi bukan `date.today()`.

    Sengaja dari kiriman saja, bukan produksi: perkiraan pesanan dihitung dari
    kiriman, dan sesi masak yang dicatat hari ini tidak boleh menggeser jendela
    28 hari ke hari-hari tanpa data.
    """
    t = sesi.exec(
        text(
            """
            SELECT COALESCE(
                (SELECT MAX((waktu AT TIME ZONE 'UTC')::date) FROM penjualan WHERE usaha_id = :u),
                (SELECT MAX((waktu AT TIME ZONE 'UTC')::date) FROM produksi WHERE usaha_id = :u))
            """
        ).bindparams(u=usaha_id)
    ).scalar()
    return t or datetime.now(timezone.utc).date()


def _resep(sesi: Session, usaha_id: int) -> dict[int, list[tuple[ResepBahan, Barang]]]:
    hasil: dict[int, list[tuple[ResepBahan, Barang]]] = defaultdict(list)
    for r, b in sesi.exec(
        select(ResepBahan, Barang)
        .join(Barang, Barang.id == ResepBahan.barang_id)
        .join(ProdukJadi, ProdukJadi.id == ResepBahan.produk_jadi_id)
        .where(ProdukJadi.usaha_id == usaha_id)
        .order_by(ResepBahan.id)
    ).all():
        hasil[r.produk_jadi_id].append((r, b))
    return hasil


def _penjualan_ringkas(sesi: Session, daftar: list[Penjualan]) -> list[PenjualanRingkas]:
    if not daftar:
        return []
    nama_pembeli = {p.id: p.nama for p in sesi.exec(select(Pembeli).where(Pembeli.id.in_({j.pembeli_id for j in daftar}))).all()}
    baris: dict[int, list[BarisPenjualanRingkas]] = defaultdict(list)
    for b, pj in sesi.exec(
        select(PenjualanBaris, ProdukJadi)
        .join(ProdukJadi, ProdukJadi.id == PenjualanBaris.produk_jadi_id)
        .where(PenjualanBaris.penjualan_id.in_([j.id for j in daftar]))
        .order_by(PenjualanBaris.id)
    ).all():
        baris[b.penjualan_id].append(
            BarisPenjualanRingkas(produk_jadi_id=pj.id, nama=pj.nama, jumlah=b.jumlah, harga_satuan=b.harga_satuan)
        )
    return [
        PenjualanRingkas(
            id=j.id, nomor=j.nomor, waktu=j.waktu, pembeli_id=j.pembeli_id,
            nama_pembeli=nama_pembeli.get(j.pembeli_id, ""), total=j.total, catatan=j.catatan, baris=baris[j.id],
        )
        for j in daftar
    ]


@rute.get("/produksi/ringkasan", response_model=RingkasanProduksi)
def ringkasan(usaha_id: int = Depends(usaha_saya)) -> RingkasanProduksi:
    """Barang jadi beserta resep, kemampuan produksi, perkiraan pesanan, pembeli, dan omset bulanan."""
    with Session(mesin()) as sesi:
        _usaha(sesi, usaha_id)
        acuan = _tanggal_acuan(sesi, usaha_id)
        resep = _resep(sesi, usaha_id)

        # Penjualan harian per produk, 28 hari sampai tanggal acuan.
        harian: dict[int, dict[date, Decimal]] = defaultdict(dict)
        for pid, tgl, jml in sesi.exec(
            text(
                """
                SELECT pb.produk_jadi_id, (p.waktu AT TIME ZONE 'UTC')::date, SUM(pb.jumlah)
                  FROM penjualan_baris pb JOIN penjualan p ON p.id = pb.penjualan_id
                 WHERE p.usaha_id = :u
                   AND (p.waktu AT TIME ZONE 'UTC')::date > :a - 28
                   AND (p.waktu AT TIME ZONE 'UTC')::date <= :a
                 GROUP BY 1, 2
                """
            ).bindparams(u=usaha_id, a=acuan)
        ).all():
            harian[pid][tgl] = Decimal(jml)

        produk: list[ProdukJadiRingkas] = []
        for pj in sesi.exec(select(ProdukJadi).where(ProdukJadi.usaha_id == usaha_id).order_by(ProdukJadi.id)).all():
            bahan = [
                BahanResep(
                    barang_id=b.id, nama=b.nama, satuan=b.satuan, takaran=r.takaran, stok=b.stok,
                    cukup_untuk=max(0, math.floor(Decimal(b.stok) / Decimal(r.takaran))),
                )
                for r, b in resep.get(pj.id, [])
            ]
            # Perkiraan naif musiman: tiap hari ke depan = rata-rata hari yang
            # sama dalam empat pekan terakhir. Pesanan usaha mengikuti jadwal
            # mingguan (Indomaret tiap Senin), jadi pola hari inilah sinyalnya.
            perkiraan = Decimal(0)
            for k in range(1, 8):
                t = acuan + timedelta(days=k)
                lalu = [harian[pj.id].get(t - timedelta(days=7 * j), Decimal(0)) for j in range(1, 5)]
                perkiraan += sum(lalu) / 4
            kurang = perkiraan + Decimal(pj.batas_aman) - Decimal(pj.stok)
            produk.append(
                ProdukJadiRingkas(
                    id=pj.id, nama=pj.nama, satuan=pj.satuan, isi_bersih=pj.isi_bersih, stok=pj.stok,
                    batas_aman=pj.batas_aman, harga_jual=pj.harga_jual, ukuran_sesi=pj.ukuran_sesi, resep=bahan,
                    bisa_dibuat=min((x.cukup_untuk for x in bahan), default=0),
                    terjual_28_hari=sum(harian[pj.id].values(), Decimal(0)),
                    perkiraan_7_hari=perkiraan.quantize(Decimal("1")),
                    saran_produksi=max(0, math.ceil(kurang / 6) * 6),
                )
            )

        pembeli: list[PembeliRingkas] = []
        for pb, n, nilai, terakhir in sesi.exec(
            text(
                """
                SELECT pb.id, COUNT(p.id) FILTER (WHERE (p.waktu AT TIME ZONE 'UTC')::date > :a - 28),
                       COALESCE(SUM(p.total) FILTER (WHERE (p.waktu AT TIME ZONE 'UTC')::date > :a - 28), 0),
                       MAX(p.waktu)
                  FROM pembeli pb LEFT JOIN penjualan p ON p.pembeli_id = pb.id
                 WHERE pb.usaha_id = :u
                 GROUP BY pb.id
                """
            ).bindparams(u=usaha_id, a=acuan)
        ).all():
            x = sesi.get(Pembeli, pb)
            pembeli.append(
                PembeliRingkas(
                    id=x.id, nama=x.nama, jenis=x.jenis, kota=x.kota, ketentuan=x.ketentuan, sejak=x.sejak,
                    kiriman_28_hari=int(n), nilai_28_hari=int(nilai), terakhir=terakhir,
                )
            )
        pembeli.sort(key=lambda p: -p.nilai_28_hari)

        omset = [
            OmsetBulanan(bulan=b, total=int(t), kiriman=int(n))
            for b, t, n in sesi.exec(
                text(
                    """
                    SELECT to_char(waktu AT TIME ZONE 'UTC', 'YYYY-MM'), SUM(total), COUNT(*)
                      FROM penjualan WHERE usaha_id = :u
                       AND (waktu AT TIME ZONE 'UTC')::date > (:a - INTERVAL '12 months')::date
                     GROUP BY 1 ORDER BY 1
                    """
                ).bindparams(u=usaha_id, a=acuan)
            ).all()
        ]
        return RingkasanProduksi(tanggal_acuan=acuan, produk=produk, pembeli=pembeli, omset_bulanan=omset)


@rute.get("/produksi", response_model=list[ProduksiRingkas])
def riwayat_produksi(usaha_id: int = Depends(usaha_saya), hari: int = Query(30, ge=1, le=400)) -> list[ProduksiRingkas]:
    with Session(mesin()) as sesi:
        _usaha(sesi, usaha_id)
        acuan = _tanggal_acuan(sesi, usaha_id)
        batas = datetime.combine(acuan - timedelta(days=hari - 1), datetime.min.time(), tzinfo=timezone.utc)
        # Tanpa batas atas: sesi masak sesudah kiriman terakhir tetap tampil.
        return [
            ProduksiRingkas(
                id=p.id, waktu=p.waktu, produk_jadi_id=pj.id, nama_produk=pj.nama, jumlah=p.jumlah,
                oleh=p.oleh, catatan=p.catatan,
            )
            for p, pj in sesi.exec(
                select(Produksi, ProdukJadi)
                .join(ProdukJadi, ProdukJadi.id == Produksi.produk_jadi_id)
                .where(Produksi.usaha_id == usaha_id, Produksi.waktu >= batas)
                .order_by(Produksi.waktu.desc(), Produksi.id.desc())
            ).all()
        ]


def _angka(x) -> str:
    """Jumlah gaya Indonesia untuk pesan di layar: 20.000 dan 1,5, bukan 20000.000."""
    teks = f"{float(x):,.2f}".rstrip("0").rstrip(".")
    return teks.replace(",", "\u2009").replace(".", ",").replace("\u2009", ".")


@rute.post("/produksi", response_model=ProduksiRingkas, status_code=201)
def catat_produksi(badan: ProduksiBaru, usaha_id: int = Depends(usaha_saya)) -> ProduksiRingkas:
    with Session(mesin()) as sesi:
        u = _usaha(sesi, usaha_id)
        pj = sesi.get(ProdukJadi, badan.produk_jadi_id)
        if pj is None or pj.usaha_id != usaha_id:
            raise HTTPException(404, "Produk tidak ditemukan.")
        bahan = _resep(sesi, usaha_id).get(pj.id, [])
        if not bahan:
            raise HTTPException(409, "Produk ini belum punya resep, jadi bahan yang terpakai tidak bisa dihitung.")

        jumlah = Decimal(badan.jumlah)
        kurang = [
            f"{b.nama} (butuh {_angka(jumlah * r.takaran)} {b.satuan}, ada {_angka(b.stok)} {b.satuan})"
            for r, b in bahan
            if Decimal(b.stok) < jumlah * Decimal(r.takaran)
        ]
        if kurang:
            raise HTTPException(409, "Bahan tidak cukup: " + "; ".join(kurang) + ".")

        waktu = datetime.now(timezone.utc)
        oleh = u.nama_pemilik or "Pemilik"
        prod = Produksi(usaha_id=usaha_id, produk_jadi_id=pj.id, waktu=waktu, jumlah=jumlah, catatan=badan.catatan, oleh=oleh)
        sesi.add(prod)
        sesi.flush()
        for r, b in bahan:
            pakai = jumlah * Decimal(r.takaran)
            b.stok = Decimal(b.stok) - pakai
            sesi.add(b)
            sesi.exec(
                text(
                    """
                    INSERT INTO pergerakan
                        (usaha_id, barang_id, waktu, jenis, jumlah, stok_sesudah, keterangan, produksi_id, oleh)
                    VALUES (:u, :b, :w, :j, :n, :s, :k, :p, :o)
                    """
                ).bindparams(
                    u=usaha_id, b=b.id, w=waktu, j=JenisPergerakan.TERJUAL.value, n=-pakai, s=b.stok,
                    k=f"Dipakai produksi {jumlah:g} {pj.satuan} {pj.nama}", p=prod.id, o=oleh,
                )
            )
        pj.stok = Decimal(pj.stok) + jumlah
        sesi.add(pj)
        sesi.commit()
        return ProduksiRingkas(
            id=prod.id, waktu=waktu, produk_jadi_id=pj.id, nama_produk=pj.nama, jumlah=jumlah, oleh=oleh,
            catatan=badan.catatan,
        )


@rute.get("/penjualan", response_model=list[PenjualanRingkas])
def daftar_penjualan(usaha_id: int = Depends(usaha_saya), hari: int = Query(30, ge=1, le=400)) -> list[PenjualanRingkas]:
    with Session(mesin()) as sesi:
        _usaha(sesi, usaha_id)
        acuan = _tanggal_acuan(sesi, usaha_id)
        batas = datetime.combine(acuan - timedelta(days=hari - 1), datetime.min.time(), tzinfo=timezone.utc)
        daftar = sesi.exec(
            select(Penjualan)
            .where(Penjualan.usaha_id == usaha_id, Penjualan.waktu >= batas)
            .order_by(Penjualan.waktu.desc(), Penjualan.id.desc())
        ).all()
        return _penjualan_ringkas(sesi, list(daftar))


@rute.post("/penjualan", response_model=PenjualanRingkas, status_code=201)
def catat_penjualan(badan: PenjualanBaru, usaha_id: int = Depends(usaha_saya)) -> PenjualanRingkas:
    with Session(mesin()) as sesi:
        _usaha(sesi, usaha_id)
        pembeli = sesi.get(Pembeli, badan.pembeli_id)
        if pembeli is None or pembeli.usaha_id != usaha_id:
            raise HTTPException(404, "Pembeli tidak ditemukan.")

        # Gabungkan baris berproduk sama supaya stok tidak diperiksa dua kali secara terpisah.
        minta: dict[int, Decimal] = defaultdict(Decimal)
        for b in badan.baris:
            minta[b.produk_jadi_id] += Decimal(b.jumlah)
        produk: dict[int, ProdukJadi] = {}
        kurang = []
        for pid, q in minta.items():
            pj = sesi.get(ProdukJadi, pid)
            if pj is None or pj.usaha_id != usaha_id:
                raise HTTPException(404, "Produk tidak ditemukan.")
            produk[pid] = pj
            if Decimal(pj.stok) < q:
                kurang.append(f"{pj.nama} (diminta {_angka(q)} {pj.satuan}, ada {_angka(pj.stok)} {pj.satuan})")
        if kurang:
            raise HTTPException(409, "Stok barang jadi tidak cukup: " + "; ".join(kurang) + ".")

        waktu = datetime.now(timezone.utc)
        hari_ini = sesi.exec(
            text(
                "SELECT COUNT(*) FROM penjualan WHERE usaha_id = :u AND (waktu AT TIME ZONE 'UTC')::date = :t"
            ).bindparams(u=usaha_id, t=waktu.date())
        ).scalar_one()
        jual = Penjualan(
            usaha_id=usaha_id, pembeli_id=pembeli.id, nomor=f"PJ-{waktu:%y%m%d}-{int(hari_ini) + 1:02d}",
            waktu=waktu, total=int(sum(produk[pid].harga_jual * q for pid, q in minta.items())), catatan=badan.catatan,
        )
        sesi.add(jual)
        sesi.flush()
        for pid, q in minta.items():
            pj = produk[pid]
            sesi.add(PenjualanBaris(penjualan_id=jual.id, produk_jadi_id=pid, jumlah=q, harga_satuan=pj.harga_jual))
            pj.stok = Decimal(pj.stok) - q
            sesi.add(pj)
        sesi.commit()
        sesi.refresh(jual)
        return _penjualan_ringkas(sesi, [jual])[0]
