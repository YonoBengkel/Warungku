"""
Promo distributor: dibuat, diubah, dan diakhiri dari portal distributor.

Potongannya masuk ke harga beli sekali (lihat `pesanan._harga_berlaku`), tidak
ke harga kontrak. Promo tidak pernah dihapus, hanya diakhiri: pesanan lama
masih menyebut promo mana asal potongannya.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import JenisPromo
from warungku.model import Penawaran, Promo, PromoPenawaran, TingkatKeanggotaan

from .otentikasi import distributor_saya
from .skema import PromoLengkap, SimpanPromo, TingkatPromo

rute = APIRouter(prefix="/distributor/{distributor_id}", tags=["promo"])


def promo_lengkap(sesi: Session, p: Promo) -> PromoLengkap:
    pn = sesi.exec(select(PromoPenawaran.penawaran_id).where(PromoPenawaran.promo_id == p.id)).all()
    tk = sesi.exec(
        select(TingkatKeanggotaan).where(TingkatKeanggotaan.promo_id == p.id).order_by(TingkatKeanggotaan.urutan)
    ).all()
    return PromoLengkap(
        id=p.id,
        distributor_id=p.distributor_id,
        jenis=str(getattr(p.jenis, "value", p.jenis)),
        judul=p.judul,
        keterangan=p.keterangan,
        berakhir=p.berakhir,
        potongan_persen=p.potongan_persen,
        penawaran_ids=list(pn),
        tingkat=[TingkatPromo(nama=t.nama, syarat=t.syarat, manfaat=t.manfaat) for t in tk],
    )


def semua_promo(sesi: Session, distributor_id: int | None = None) -> list[PromoLengkap]:
    q = select(Promo).order_by(Promo.id.desc())
    if distributor_id is not None:
        q = q.where(Promo.distributor_id == distributor_id)
    return [promo_lengkap(sesi, p) for p in sesi.exec(q).all()]


def _isi(sesi: Session, p: Promo, badan: SimpanPromo, distributor_id: int) -> None:
    for pid in badan.penawaran_ids:
        pn = sesi.get(Penawaran, pid)
        if pn is None or pn.distributor_id != distributor_id:
            raise HTTPException(422, "Promo hanya bisa memuat penawaran milik sendiri.")
    p.jenis = JenisPromo(badan.jenis)
    p.judul, p.keterangan = badan.judul, badan.keterangan
    p.berakhir, p.potongan_persen = badan.berakhir, badan.potongan_persen
    sesi.add(p)
    sesi.flush()
    for lama in sesi.exec(select(PromoPenawaran).where(PromoPenawaran.promo_id == p.id)).all():
        sesi.delete(lama)
    for lama in sesi.exec(select(TingkatKeanggotaan).where(TingkatKeanggotaan.promo_id == p.id)).all():
        sesi.delete(lama)
    sesi.flush()
    for pid in dict.fromkeys(badan.penawaran_ids):
        sesi.add(PromoPenawaran(promo_id=p.id, penawaran_id=pid))
    for i, t in enumerate(badan.tingkat):
        sesi.add(TingkatKeanggotaan(promo_id=p.id, urutan=i, nama=t.nama, syarat=t.syarat, manfaat=t.manfaat))


def _milik(sesi: Session, promo_id: int, distributor_id: int) -> Promo:
    p = sesi.get(Promo, promo_id)
    if p is None or p.distributor_id != distributor_id:
        raise HTTPException(404, "Promo tidak ditemukan.")
    return p


@rute.post("/promo", response_model=PromoLengkap, status_code=201)
def buat(badan: SimpanPromo, distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = Promo(
            distributor_id=distributor_id,
            jenis=JenisPromo(badan.jenis),
            judul=badan.judul,
            dibuat_pada=datetime.now(timezone.utc),
        )
        _isi(sesi, p, badan, distributor_id)
        sesi.commit()
        return promo_lengkap(sesi, p)


@rute.put("/promo/{promo_id}", response_model=PromoLengkap)
def ubah(badan: SimpanPromo, promo_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    """Pesanan yang sudah dibuat tidak ikut berubah: harganya disalin saat dipesan."""
    with Session(mesin()) as sesi:
        p = _milik(sesi, promo_id, distributor_id)
        _isi(sesi, p, badan, distributor_id)
        sesi.commit()
        return promo_lengkap(sesi, p)


@rute.post("/promo/{promo_id}/akhiri", response_model=PromoLengkap)
def akhiri(promo_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = _milik(sesi, promo_id, distributor_id)
        p.berakhir = datetime.now(timezone.utc)
        sesi.add(p)
        sesi.commit()
        return promo_lengkap(sesi, p)
