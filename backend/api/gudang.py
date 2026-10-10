"""
Alur tulis dari kasir, dan bacaan stok yang menyertainya.

Satu invarian dijaga seluruh berkas ini, dan hanya satu:

    stok barang == jumlah seluruh baris pergerakan barang itu

Setiap penjualan menambah satu baris buku besar DAN memperbarui `barang.stok`,
dalam satu transaksi basis data. Kalau salah satunya gagal, keduanya dibatalkan.
Nilai `stok` yang disimpan itu hanya ada supaya layar tidak perlu menjumlah
ribuan baris tiap kali dibuka — dan nilai berjalan seperti itu hanya boleh ada
kalau ada yang menjaganya. Di sinilah penjaganya, dan
`skrip/02_periksa_konsistensi.sql` adalah yang memeriksa penjaganya bekerja.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import JenisPergerakan
from warungku.model import Barang, PemetaanMenu, PemetaanMenuBahan, Transaksi, TransaksiBaris, Usaha

from .otentikasi import usaha_saya
from .skema import BarangRingkas, HasilStruk, PerkiraanRingkas, SaranDistributor, StrukMasuk

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["gudang"])


def _usaha_atau_404(sesi: Session, usaha_id: int) -> Usaha:
    u = sesi.get(Usaha, usaha_id)
    if u is None:
        raise HTTPException(404, "Usaha tidak ditemukan.")
    return u


def _status(stok: Decimal, batas: Decimal) -> str:
    """Status yang ditampilkan di layar. Ambangnya sama dengan di frontend."""
    if stok <= 0:
        return "habis"
    if stok < batas:
        return "menipis"
    return "aman"


@rute.get("/barang", response_model=list[BarangRingkas])
def daftar_barang(usaha_id: int = Depends(usaha_saya)) -> list[BarangRingkas]:
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        barang = sesi.exec(
            select(Barang).where(Barang.usaha_id == usaha_id).order_by(Barang.nama)
        ).all()
        return [
            BarangRingkas(
                id=b.id,
                nama=b.nama,
                satuan=b.satuan,
                stok=b.stok,
                batas_aman=b.batas_aman,
                status=_status(b.stok, b.batas_aman),
                dicatat_manual=b.dicatat_manual,
            )
            for b in barang
        ]


@rute.get("/barang/{barang_id}/perkiraan", response_model=list[PerkiraanRingkas])
def perkiraan_barang(barang_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """
    Baca perkiraan terbaru dari tabel. **Tidak** memanggil layanan model.

    Kalau layanan model mati, endpoint ini tetap menjawab — dengan angka
    terakhir yang tersimpan, dan `tingkat_layanan` menyatakan apa adanya bahwa
    angkanya tidak segar. Itu jauh lebih baik daripada halaman yang gagal
    dibuka, dan jauh lebih jujur daripada angka segar palsu.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        baris = sesi.exec(
            text(
                """
                SELECT barang_id, tanggal_target, p10, p50, p90, model_nama,
                       model_versi, dijalankan_pada, kematangan, tingkat_layanan
                  FROM prediksi
                 WHERE usaha_id = :u AND barang_id = :b
                   AND jalan_id = (
                       SELECT jalan_id FROM prediksi
                        WHERE barang_id = :b ORDER BY dijalankan_pada DESC LIMIT 1
                   )
                 ORDER BY tanggal_target
                """
            ).bindparams(u=usaha_id, b=barang_id)
        ).all()
        return [PerkiraanRingkas(**dict(r._mapping)) for r in baris]


@rute.get("/barang/{barang_id}/saran", response_model=list[SaranDistributor])
def saran_distributor(barang_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """
    Baca saran distributor dari tabel. **Tidak** memanggil layanan model.

    Baris yang sudah kedaluwarsa tetap dikembalikan, ditandai
    `kedaluwarsa: true`. Menyembunyikannya akan membuat layar kosong tanpa
    penjelasan setiap kali penjadwal terlambat — dan saran dari delapan jam
    lalu jauh lebih berguna daripada tidak ada saran sama sekali, selama
    pemilik warung tahu umurnya.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        baris = sesi.exec(
            text(
                """
                SELECT r.barang_id, r.distributor_id, r.penawaran_id,
                       d.nama AS nama_distributor, r.p_sukses, r.skor, r.alasan, r.segmen,
                       r.model_nama, r.dijalankan_pada, r.kedaluwarsa_pada,
                       (r.kedaluwarsa_pada < now()) AS kedaluwarsa
                  FROM rekomendasi_skor r
                  JOIN distributor d ON d.id = r.distributor_id
                 WHERE r.usaha_id = :u AND r.barang_id = :b
                 ORDER BY r.skor DESC
                """
            ).bindparams(u=usaha_id, b=barang_id)
        ).all()
        return [SaranDistributor(**dict(r._mapping)) for r in baris]


@rute.post("/transaksi", response_model=HasilStruk)
def terima_struk(struk: StrukMasuk, usaha_id: int = Depends(usaha_saya)) -> HasilStruk:
    """
    Terima satu nota dari kasir. Aman dikirim ulang berapa kali pun.

    Alurnya, dalam satu transaksi basis data:

    1. Nota disimpan. Kalau `nomor_struk` sudah ada, berhenti di sini dan
       jawab `sudah_ada=True` — bukan galat.
    2. Tiap baris nota diterjemahkan dari nama menu ke bahan lewat
       `pemetaan_menu`. Yang tidak dikenali dilaporkan, nota tetap diterima.
    3. Untuk tiap bahan: satu baris `pergerakan` jenis `terjual` ditulis dan
       `barang.stok` dikurangi. Keduanya atau tidak sama sekali.

    Stok dibiarkan boleh menjadi negatif. Itu bukan kelalaian — nota dari kasir
    adalah fakta yang sudah terjadi, dan menolaknya karena stok tercatat tidak
    cukup berarti menolak kenyataan demi menjaga angka. Stok negatif justru
    tanda yang berguna: ia berarti ada barang masuk yang belum dicatat.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)

        ada = sesi.exec(
            select(Transaksi).where(
                Transaksi.usaha_id == usaha_id, Transaksi.nomor_struk == struk.nomor_struk
            )
        ).first()
        if ada is not None:
            jumlah = sesi.exec(
                text("SELECT COUNT(*) FROM transaksi_baris WHERE transaksi_id = :t").bindparams(
                    t=ada.id
                )
            ).scalar_one()
            return HasilStruk(
                diterima=True, sudah_ada=True, transaksi_id=ada.id,
                baris_tercatat=int(jumlah), tak_dikenali=[],
            )

        trx = Transaksi(
            usaha_id=usaha_id,
            nomor_struk=struk.nomor_struk,
            waktu=struk.waktu,
            kasir=struk.kasir,
            sumber=struk.sumber,
        )
        sesi.add(trx)
        sesi.flush()  # butuh id-nya untuk menautkan baris

        # Pemetaan menu -> bahan, dibaca sekali untuk seluruh nota.
        peta: dict[str, list[tuple[int, Decimal]]] = {}
        for pm, pb in sesi.exec(
            select(PemetaanMenu, PemetaanMenuBahan)
            .join(PemetaanMenuBahan, PemetaanMenuBahan.pemetaan_id == PemetaanMenu.id)
            .where(PemetaanMenu.usaha_id == usaha_id)
        ).all():
            peta.setdefault(pm.nama_menu.strip().lower(), []).append((pb.barang_id, pb.takaran))

        tak_dikenali: list[str] = []
        tercatat = 0
        for baris in struk.baris:
            sesi.add(
                TransaksiBaris(
                    transaksi_id=trx.id,
                    nama_menu=baris.nama_menu,
                    jumlah=baris.jumlah,
                    satuan=baris.satuan,
                    harga_jual_satuan=baris.harga_jual_satuan,
                )
            )
            tercatat += 1

            bahan = peta.get(baris.nama_menu.strip().lower())
            if not bahan:
                tak_dikenali.append(baris.nama_menu)
                continue

            for barang_id, takaran in bahan:
                b = sesi.get(Barang, barang_id)
                if b is None or b.usaha_id != usaha_id:
                    continue
                if b.dicatat_manual:
                    # Barang yang dicatat manual tidak ikut dikurangi kasir:
                    # pemiliknya yang menghitung sendiri, dan mengurangi dari
                    # dua arah akan menghitungnya dua kali.
                    continue
                pakai = Decimal(baris.jumlah) * Decimal(takaran)
                b.stok = Decimal(b.stok) - pakai
                sesi.add(b)
                sesi.exec(
                    text(
                        """
                        INSERT INTO pergerakan
                            (usaha_id, barang_id, waktu, jenis, jumlah, stok_sesudah,
                             keterangan, transaksi_id, oleh)
                        VALUES (:u, :b, :w, :j, :n, :s, :k, :t, :o)
                        """
                    ).bindparams(
                        u=usaha_id, b=barang_id, w=struk.waktu,
                        j=JenisPergerakan.TERJUAL.value, n=-pakai, s=b.stok,
                        k="Penjualan dari struk " + struk.nomor_struk,
                        t=trx.id, o=struk.kasir or "Kasir",
                    )
                )

        sesi.commit()
        return HasilStruk(
            diterima=True, sudah_ada=False, transaksi_id=trx.id,
            baris_tercatat=tercatat, tak_dikenali=tak_dikenali,
        )
