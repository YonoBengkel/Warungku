"""
Endpoint portal distributor.

Pasangan dari `gudang.py`, membaca tabel yang sama dari arah berlawanan.
`pesanan` adalah satu tabel untuk kedua portal — bukan dua tabel yang
disinkronkan — jadi aksi distributor di sini mengubah pesanan yang dilihat
pemilik warung di sana, tanpa langkah penyalinan apa pun.

Bentuk jawabannya mengikuti store frontend yang sudah ada (`usePesananMasuk`,
`useKontrakMasuk`), bukan bentuk baru. Frontend-nya sudah beku; menambah bentuk
baru di sini berarti menambah penerjemah di sisi frontend tanpa alasan.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import text
from sqlmodel import Session

from warungku.basis_data import mesin
from warungku.model import Distributor

from .skema import PesananMasuk, PelangganTersegmen, RingkasanSegmen

rute = APIRouter(prefix="/distributor/{distributor_id}", tags=["distributor"])


def _distributor_atau_404(sesi: Session, distributor_id: int) -> Distributor:
    d = sesi.get(Distributor, distributor_id)
    if d is None:
        raise HTTPException(404, "Distributor tidak ditemukan.")
    return d


@rute.get("/pesanan", response_model=list[PesananMasuk])
def pesanan_masuk(
    distributor_id: int = Path(ge=1),
    status: str | None = Query(default=None, description="saring menurut status"),
    batas: int = Query(default=100, ge=1, le=500),
):
    """Pesanan yang masuk ke distributor ini, terbaru dulu."""
    with Session(mesin()) as sesi:
        _distributor_atau_404(sesi, distributor_id)
        baris = sesi.exec(
            text(
                """
                SELECT p.id, p.nomor, p.usaha_id, u.nama AS nama_usaha, u.kota,
                       p.dibuat_pada, p.status, p.status_bayar, p.ongkos_kirim,
                       p.perkiraan_tiba, p.dari_saran, p.sudah_diulas,
                       COALESCE(n.jumlah_baris, 0) AS jumlah_baris,
                       COALESCE(n.nilai, 0)        AS nilai
                  FROM pesanan p
                  JOIN usaha u ON u.id = p.usaha_id
                  LEFT JOIN LATERAL (
                      SELECT COUNT(*) AS jumlah_baris,
                             SUM(b.jumlah * b.harga_satuan)::bigint AS nilai
                        FROM pesanan_baris b WHERE b.pesanan_id = p.id
                  ) n ON true
                 WHERE p.distributor_id = :d
                   AND (:s IS NULL OR p.status::text = :s)
                 ORDER BY p.dibuat_pada DESC
                 LIMIT :n
                """
            ).bindparams(d=distributor_id, s=status, n=batas)
        ).all()
        return [PesananMasuk(**dict(r._mapping)) for r in baris]


@rute.get("/segmen", response_model=list[RingkasanSegmen])
def ringkasan_segmen(distributor_id: int = Path(ge=1)):
    """
    Ringkasan tiap segmen pelanggan. **Tidak** memanggil layanan model.

    Kalau Mesin 3 belum pernah dijalankan, daftarnya kosong — bukan galat.
    Portal menampilkan "segmentasi belum dihitung", dan itu keadaan yang jujur;
    menghitungnya di tempat akan membuat halaman menunggu MCMC selesai.
    """
    with Session(mesin()) as sesi:
        _distributor_atau_404(sesi, distributor_id)
        baris = sesi.exec(
            text(
                """
                SELECT segmen, nama_segmen, ciri, saran,
                       COUNT(*)                         AS jumlah,
                       ROUND(AVG(recency))::int         AS rata_recency,
                       ROUND(AVG(frequency))::int       AS rata_frequency,
                       ROUND(AVG(monetary))::bigint     AS rata_monetary,
                       MAX(dijalankan_pada)             AS dijalankan_pada,
                       MAX(tanggal_acuan)               AS tanggal_acuan
                  FROM segmen_pelanggan
                 WHERE distributor_id = :d
                 GROUP BY segmen, nama_segmen, ciri, saran
                 ORDER BY jumlah DESC
                """
            ).bindparams(d=distributor_id)
        ).all()
        return [RingkasanSegmen(**dict(r._mapping)) for r in baris]


@rute.get("/segmen/{segmen}", response_model=list[PelangganTersegmen])
def anggota_segmen(distributor_id: int = Path(ge=1), segmen: str = Path(min_length=2)):
    """
    Anggota satu segmen beserta angka RFM-nya.

    Angkanya ikut dikirim, tidak hanya nama segmennya. Distributor yang merasa
    pelanggannya salah dikelompokkan akan bertanya "kenapa?", dan layar harus
    bisa menjawabnya tanpa membuka basis data.
    """
    with Session(mesin()) as sesi:
        _distributor_atau_404(sesi, distributor_id)
        baris = sesi.exec(
            text(
                """
                SELECT s.usaha_id, u.nama AS nama_usaha, u.kota,
                       s.segmen, s.nama_segmen, s.recency, s.frequency,
                       s.monetary, s.lama_berlangganan, s.jenis_usaha,
                       s.kategori_utama, s.jarak_ke_pusat
                  FROM segmen_pelanggan s
                  JOIN usaha u ON u.id = s.usaha_id
                 WHERE s.distributor_id = :d AND s.segmen = :g
                 ORDER BY s.monetary DESC
                """
            ).bindparams(d=distributor_id, g=segmen)
        ).all()
        return [PelangganTersegmen(**dict(r._mapping)) for r in baris]
