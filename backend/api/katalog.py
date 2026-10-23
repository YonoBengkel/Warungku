"""
Katalog untuk pemilik usaha: distributor, penawarannya, dan ulasan sungguhan.

Dua hal dihitung di sini, bukan disimpan:

- **Rating distributor** dari tabel `ulasan`. Angka yang diketik di profil bisa
  dikarang; rata-rata ulasan tidak.
- **Barang terkait** tiap penawaran, yaitu barang di gudang usaha PEMANGGIL yang
  bertambah kalau penawaran itu dibeli. Dicocokkan lewat `produk_master_id`,
  jadi jawabannya berbeda untuk setiap usaha.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.model import Usaha

from .otentikasi import usaha_saya
from .skema import DistributorKatalog, Katalog, PaketKontrakRingkas, PenawaranKatalog, UlasanPublik, UsahaRingkas

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["katalog"])


def _nilai(x) -> str:
    return str(getattr(x, "value", x))


@rute.get("/katalog", response_model=Katalog)
def katalog(usaha_id: int = Depends(usaha_saya)) -> Katalog:
    """Semua distributor beserta penawarannya, dilihat dari usaha pemanggil."""
    with Session(mesin()) as sesi:
        u = sesi.get(Usaha, usaha_id)
        if u is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        distributor = sesi.exec(
            text(
                """
                SELECT d.id, d.nama, d.kota, d.deskripsi, d.warna, d.kategori, d.area_kirim,
                       d.terverifikasi, d.baru, d.sejak, d.alamat_gudang, d.nomor_hp,
                       d.jam_operasional, d.minimum_pesanan, d.lat, d.lng,
                       round(avg(ul.rating)::numeric, 2)::float               AS rating,
                       count(ul.id)                                           AS jumlah_ulasan,
                       count(DISTINCT ul.usaha_id)                            AS jumlah_umkm_pengulas,
                       round(avg(ul.aspek_ketepatan_waktu)::numeric, 2)::float AS aspek_ketepatan,
                       round(avg(ul.aspek_jumlah_sesuai)::numeric, 2)::float   AS aspek_jumlah,
                       round(avg(ul.aspek_kondisi_barang)::numeric, 2)::float  AS aspek_kondisi,
                       (SELECT count(*) FROM pesanan p
                         WHERE p.distributor_id = d.id
                           AND p.status IN ('selesai', 'selesai-catatan'))    AS jumlah_pesanan_selesai
                  FROM distributor d
                  LEFT JOIN ulasan ul ON ul.distributor_id = d.id
                 GROUP BY d.id
                 ORDER BY d.id
                """
            )
        ).all()
        penawaran = sesi.exec(
            text(
                """
                SELECT pn.id, pn.distributor_id, pn.nama, pn.kategori, pn.satuan, pn.harga_satuan,
                       pn.kemasan_nama, pn.kemasan_isi, pn.satuan_isi, pn.stok_tersedia,
                       pn.stok_diperbarui_pada, pn.keterangan, pn.aktif,
                       (SELECT b.id FROM barang b
                         WHERE b.usaha_id = :u AND b.produk_master_id = pn.produk_master_id
                         ORDER BY b.id LIMIT 1) AS barang_id_terkait
                  FROM penawaran pn
                 ORDER BY pn.distributor_id, pn.nama
                """
            ).bindparams(u=usaha_id)
        ).all()
        paket = sesi.exec(
            text(
                """
                SELECT id, penawaran_id, distributor_id, kode, durasi_bulan, kuota_min_per_bulan,
                       harga_satuan, hemat_persen, ketentuan_kuota_kurang, ketentuan_berhenti
                  FROM paket_kontrak ORDER BY penawaran_id, durasi_bulan
                """
            )
        ).all()
        from .promo import semua_promo

        return Katalog(
            promo=semua_promo(sesi),
            paket=[PaketKontrakRingkas(**dict(r._mapping)) for r in paket],
            usaha=UsahaRingkas(id=u.id, nama=u.nama, jenis_usaha=_nilai(u.jenis_usaha), kota=u.kota, alamat=u.alamat),
            distributor=[DistributorKatalog(**dict(r._mapping)) for r in distributor],
            penawaran=[PenawaranKatalog(**dict(r._mapping)) for r in penawaran],
        )


@rute.get("/distributor/{distributor_id}/ulasan", response_model=list[UlasanPublik])
def ulasan_distributor(
    distributor_id: int = Path(ge=1),
    usaha_id: int = Depends(usaha_saya),
    batas: int = Query(60, ge=1, le=300),
) -> list[UlasanPublik]:
    """
    Ulasan terbaru untuk satu distributor.

    Label sistem (berapa pesanan penulis ke distributor ini, sejak kapan ia
    berlangganan) dihitung dari tabel pesanan, supaya pembaca bisa menimbang
    ulasan dari pelanggan lama berbeda dengan ulasan dari pembeli sekali.
    """
    with Session(mesin()) as sesi:
        baris = sesi.exec(
            text(
                """
                SELECT ul.id, ul.distributor_id, u.nama AS nama_usaha, u.kota AS kota_usaha,
                       ul.rating, ul.isi, ul.waktu, p.nomor AS nomor_pesanan,
                       ul.aspek_ketepatan_waktu, ul.aspek_jumlah_sesuai, ul.aspek_kondisi_barang,
                       h.jumlah AS jumlah_pesanan_penulis, h.sejak AS pelanggan_sejak
                  FROM ulasan ul
                  JOIN usaha u ON u.id = ul.usaha_id
                  JOIN pesanan p ON p.id = ul.pesanan_id
                  LEFT JOIN LATERAL (
                      SELECT count(*) AS jumlah, min(q.dibuat_pada)::date AS sejak
                        FROM pesanan q
                       WHERE q.usaha_id = ul.usaha_id AND q.distributor_id = ul.distributor_id
                  ) h ON TRUE
                 WHERE ul.distributor_id = :d
                 ORDER BY ul.waktu DESC
                 LIMIT :n
                """
            ).bindparams(d=distributor_id, n=batas)
        ).all()
        return [UlasanPublik(**dict(r._mapping)) for r in baris]


# --------------------------------------------------------------------------
# Portal distributor: katalog dan paket kontrak miliknya sendiri
# --------------------------------------------------------------------------
from warungku.model import Kontrak, PaketKontrak, Penawaran  # noqa: E402

from .otentikasi import distributor_saya  # noqa: E402
from .skema import KatalogDistributor, SimpanPaket  # noqa: E402

rute_distributor = APIRouter(prefix="/distributor/{distributor_id}", tags=["katalog"])


def _paket_ringkas(p: PaketKontrak) -> PaketKontrakRingkas:
    return PaketKontrakRingkas(
        id=p.id, penawaran_id=p.penawaran_id, distributor_id=p.distributor_id, kode=p.kode,
        durasi_bulan=p.durasi_bulan, kuota_min_per_bulan=p.kuota_min_per_bulan, harga_satuan=p.harga_satuan,
        hemat_persen=p.hemat_persen, ketentuan_kuota_kurang=p.ketentuan_kuota_kurang,
        ketentuan_berhenti=p.ketentuan_berhenti,
    )


@rute_distributor.get("/katalog", response_model=KatalogDistributor)
def katalog_distributor(distributor_id: int = Depends(distributor_saya)) -> KatalogDistributor:
    with Session(mesin()) as sesi:
        penawaran = sesi.exec(
            text(
                """
                SELECT id, distributor_id, nama, kategori, satuan, harga_satuan, kemasan_nama, kemasan_isi,
                       satuan_isi, stok_tersedia, stok_diperbarui_pada, keterangan, aktif,
                       NULL::int AS barang_id_terkait
                  FROM penawaran WHERE distributor_id = :d ORDER BY nama
                """
            ).bindparams(d=distributor_id)
        ).all()
        paket = sesi.exec(
            select(PaketKontrak).where(PaketKontrak.distributor_id == distributor_id)
            .order_by(PaketKontrak.penawaran_id, PaketKontrak.durasi_bulan)
        ).all()
        from .promo import semua_promo

        return KatalogDistributor(
            promo=semua_promo(sesi, distributor_id),
            penawaran=[PenawaranKatalog(**dict(r._mapping)) for r in penawaran],
            paket=[_paket_ringkas(p) for p in paket],
        )


def _paket_milik(sesi: Session, paket_id: int, distributor_id: int) -> PaketKontrak:
    p = sesi.get(PaketKontrak, paket_id)
    if p is None or p.distributor_id != distributor_id:
        raise HTTPException(404, "Paket kontrak tidak ditemukan.")
    return p


def _isi_paket(p: PaketKontrak, badan: SimpanPaket, sesi: Session, distributor_id: int) -> None:
    pn = sesi.get(Penawaran, badan.penawaran_id)
    if pn is None or pn.distributor_id != distributor_id:
        raise HTTPException(422, "Paket hanya bisa dibuat untuk penawaran milik sendiri.")
    for kolom, nilai in badan.model_dump().items():
        setattr(p, kolom, nilai)


@rute_distributor.post("/paket", response_model=PaketKontrakRingkas, status_code=201)
def tambah_paket(badan: SimpanPaket, distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = PaketKontrak(distributor_id=distributor_id, penawaran_id=badan.penawaran_id, kode=badan.kode,
                         durasi_bulan=badan.durasi_bulan, kuota_min_per_bulan=badan.kuota_min_per_bulan,
                         harga_satuan=badan.harga_satuan)
        _isi_paket(p, badan, sesi, distributor_id)
        sesi.add(p)
        sesi.commit()
        return _paket_ringkas(p)


@rute_distributor.put("/paket/{paket_id}", response_model=PaketKontrakRingkas)
def ubah_paket(badan: SimpanPaket, paket_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    """Kontrak yang sudah berjalan tidak ikut berubah: harga dan kuotanya disalin saat diajukan."""
    with Session(mesin()) as sesi:
        p = _paket_milik(sesi, paket_id, distributor_id)
        _isi_paket(p, badan, sesi, distributor_id)
        sesi.add(p)
        sesi.commit()
        return _paket_ringkas(p)


@rute_distributor.delete("/paket/{paket_id}", status_code=204)
def hapus_paket(paket_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    """Kontrak yang memakai paket ini tetap berjalan; rujukannya ke paket dilepas."""
    with Session(mesin()) as sesi:
        p = _paket_milik(sesi, paket_id, distributor_id)
        for k in sesi.exec(select(Kontrak).where(Kontrak.paket_id == p.id)).all():
            k.paket_id = None
            sesi.add(k)
        sesi.delete(p)
        sesi.commit()
