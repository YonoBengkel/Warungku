"""
Jalur tulis pesanan: dari keranjang pemilik usaha sampai barang diterima.

    UMKM        POST /usaha/{u}/pesanan                  -> menunggu-konfirmasi
    Distributor POST /distributor/{d}/pesanan/{p}/konfirmasi -> disiapkan
                POST /distributor/{d}/pesanan/{p}/tolak      -> batal
                POST /distributor/{d}/pesanan/{p}/kirim      -> dikirim
                POST /distributor/{d}/pesanan/{p}/sampai     -> (tetap dikirim, bukti antar tercatat)
    UMKM        POST /usaha/{u}/pesanan/{p}/terima       -> selesai / selesai-catatan

Tiga aturan dijaga di sini:

1. **Satu pesanan, dua portal.** Kedua sisi membaca baris yang sama
   (`PesananLengkap`); tidak ada salinan yang bisa saling selisih.
2. **Stok hanya naik lewat penerimaan.** Barang yang "sudah sampai" menurut
   distributor belum menambah stok sampai pemilik usaha menghitungnya.
   Kenaikan stok ditulis sebagai pergerakan `masuk` dan `barang.stok` diubah
   dalam transaksi yang sama, seperti jalur nota kasir.
3. **Penerimaan menutup putaran belajar Mesin 2.** Pesanan yang selesai ditulis
   ke `fitur_pesanan`: fitur dihitung dari keadaan SEBELUM pesanan dibuat
   (riwayat pesanan yang dibuat lebih dulu), label dari hasil hitung barang.
   Definisinya sama dengan `data/dataset/buat_dataset.py::bangun_fitur_pesanan`.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import AlasanSelisih, JenisPergerakan, StatusBayar, StatusKontrak, StatusPesanan
from warungku.model import (
    Barang,
    Distributor,
    FiturPesanan,
    Kontrak,
    Penawaran,
    Pergerakan,
    Pesanan,
    PesananBaris,
    PesananJejak,
    Usaha,
)

from .kontrak import periode_berjalan, status_terbaca
from .otentikasi import distributor_saya, usaha_saya
from .skema import (
    BarisPesananLengkap,
    JejakPesananLengkap,
    KirimPesanan,
    KonfirmasiPesanan,
    Penerimaan,
    PesananBaru,
    PesananLengkap,
    SampaiPesanan,
    TolakPesanan,
)

rute_umkm = APIRouter(prefix="/usaha/{usaha_id}", tags=["pesanan"])
rute_distributor = APIRouter(prefix="/distributor/{distributor_id}", tags=["pesanan"])

#: Sama dengan `data/dataset/pola.py::BULAN_HUJAN`.
BULAN_HUJAN = frozenset({11, 12, 1, 2, 3})
#: Lama kirim bawaan kalau barang tujuan tidak diketahui.
HARI_KIRIM_BAWAAN = 2
ALASAN_JUMLAH = {AlasanSelisih.KURANG.value, AlasanSelisih.LEBIH.value}
ALASAN_KONDISI = {AlasanSelisih.RUSAK.value, AlasanSelisih.KUALITAS_BEDA.value, AlasanSelisih.SALAH_BARANG.value}


def _sekarang() -> datetime:
    return datetime.now(timezone.utc)


def _nilai(x) -> str:
    """Nilai enum sebagai teks, apa pun bentuk yang dikembalikan basis data."""
    return str(getattr(x, "value", x))


# --------------------------------------------------------------------------
# Bacaan bersama
# --------------------------------------------------------------------------
def _lengkap(sesi: Session, p: Pesanan) -> PesananLengkap:
    usaha = sesi.get(Usaha, p.usaha_id)
    dist = sesi.get(Distributor, p.distributor_id)
    baris = sesi.exec(select(PesananBaris).where(PesananBaris.pesanan_id == p.id).order_by(PesananBaris.id)).all()
    jejak = sesi.exec(select(PesananJejak).where(PesananJejak.pesanan_id == p.id).order_by(PesananJejak.waktu)).all()
    return PesananLengkap(
        id=p.id,
        nomor=p.nomor,
        usaha_id=p.usaha_id,
        nama_usaha=usaha.nama if usaha else "",
        usaha_jenis=_nilai(usaha.jenis_usaha) if usaha else "",
        usaha_kota=usaha.kota if usaha else "",
        usaha_alamat=usaha.alamat if usaha else "",
        usaha_nomor_hp=usaha.nomor_hp if usaha else "",
        usaha_lat=usaha.lat if usaha else None,
        usaha_lng=usaha.lng if usaha else None,
        distributor_id=p.distributor_id,
        nama_distributor=dist.nama if dist else "",
        kontrak_id=p.kontrak_id,
        dibuat_pada=p.dibuat_pada,
        status=_nilai(p.status),
        status_bayar=_nilai(p.status_bayar),
        ongkos_kirim=p.ongkos_kirim,
        perkiraan_tiba=p.perkiraan_tiba,
        jumlah_bukti=p.jumlah_bukti,
        dari_saran=p.dari_saran,
        dari_rutin=p.dari_rutin,
        catatan_untuk_distributor=p.catatan_untuk_distributor,
        sudah_diulas=p.sudah_diulas,
        kode_belanja=p.kode_belanja,
        alasan_tolak=p.alasan_tolak,
        kirim_kurir=p.kirim_kurir,
        kirim_pengantar=p.kirim_pengantar,
        kirim_nomor_resi=p.kirim_nomor_resi,
        kirim_diterima_oleh=p.kirim_diterima_oleh,
        kirim_waktu_sampai=p.kirim_waktu_sampai,
        kirim_catatan=p.kirim_catatan,
        baris=[
            BarisPesananLengkap(
                id=b.id,
                penawaran_id=b.penawaran_id,
                barang_id=b.barang_id,
                nama=b.nama,
                jumlah=b.jumlah,
                satuan=b.satuan,
                harga_satuan=b.harga_satuan,
                harga_normal=b.harga_normal,
                promo_id=b.promo_id,
                isi_per_satuan=b.isi_per_satuan,
                jumlah_diterima=b.jumlah_diterima,
                alasan_selisih=_nilai(b.alasan_selisih) if b.alasan_selisih is not None else None,
                catatan_penerimaan=b.catatan_penerimaan,
            )
            for b in baris
        ],
        jejak=[JejakPesananLengkap(waktu=j.waktu, status=_nilai(j.status), keterangan=j.keterangan) for j in jejak],
    )


def _kunci_pesanan(sesi: Session, pesanan_id: int, *, usaha_id: int | None = None, distributor_id: int | None = None) -> Pesanan:
    """Ambil pesanan dengan kunci baris, dan pastikan memang milik pemanggil."""
    p = sesi.exec(select(Pesanan).where(Pesanan.id == pesanan_id).with_for_update()).first()
    if p is None or (usaha_id is not None and p.usaha_id != usaha_id) or (
        distributor_id is not None and p.distributor_id != distributor_id
    ):
        # 404 juga untuk pesanan milik orang lain: 403 akan membocorkan bahwa nomornya ada.
        raise HTTPException(404, "Pesanan tidak ditemukan.")
    return p


def _lepas_dalam_perjalanan(sesi: Session, p: Pesanan) -> None:
    """Pesanan berkontrak yang batal tidak lagi dihitung "sedang dikirim" pada kuotanya."""
    if p.kontrak_id is None:
        return
    k = sesi.exec(select(Kontrak).where(Kontrak.id == p.kontrak_id).with_for_update()).first()
    if k is None:
        return
    dipesan = sum(
        Decimal(b.jumlah) for b in sesi.exec(select(PesananBaris).where(PesananBaris.pesanan_id == p.id)).all()
    )
    k.dalam_perjalanan = max(Decimal(0), Decimal(k.dalam_perjalanan) - dipesan)
    sesi.add(k)


def _jejak(sesi: Session, p: Pesanan, status: StatusPesanan, keterangan: str) -> None:
    sesi.add(PesananJejak(pesanan_id=p.id, waktu=_sekarang(), status=status, keterangan=keterangan))


def _wajib_status(p: Pesanan, *diizinkan: StatusPesanan) -> None:
    if _nilai(p.status) not in {s.value for s in diizinkan}:
        raise HTTPException(
            409,
            f"Pesanan berstatus {_nilai(p.status)}; langkah ini hanya untuk status "
            + ", ".join(s.value for s in diizinkan) + ".",
        )


# --------------------------------------------------------------------------
# Sisi pemilik usaha
# --------------------------------------------------------------------------
@rute_umkm.get("/pesanan", response_model=list[PesananLengkap])
def daftar_pesanan(usaha_id: int = Depends(usaha_saya), batas: int = Query(50, ge=1, le=200)):
    """Pesanan usaha ini, terbaru dulu."""
    with Session(mesin()) as sesi:
        semua = sesi.exec(
            select(Pesanan).where(Pesanan.usaha_id == usaha_id).order_by(Pesanan.dibuat_pada.desc(), Pesanan.id.desc()).limit(batas)
        ).all()
        return [_lengkap(sesi, p) for p in semua]


@rute_umkm.get("/pesanan/{pesanan_id}", response_model=PesananLengkap)
def rincian_pesanan(pesanan_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    with Session(mesin()) as sesi:
        p = sesi.get(Pesanan, pesanan_id)
        if p is None or p.usaha_id != usaha_id:
            raise HTTPException(404, "Pesanan tidak ditemukan.")
        return _lengkap(sesi, p)


def _harga_berlaku(sesi: Session, penawaran: Penawaran, waktu: datetime) -> tuple[int, int | None, int | None]:
    """(harga, harga_normal, promo_id). Potongan promo masuk ke harga beli sekali."""
    r = sesi.exec(
        text(
            """
            SELECT pr.id, pr.potongan_persen
              FROM promo_penawaran pp JOIN promo pr ON pr.id = pp.promo_id
             WHERE pp.penawaran_id = :p AND pr.potongan_persen IS NOT NULL
               AND (pr.berakhir IS NULL OR pr.berakhir > :w)
             ORDER BY pr.potongan_persen DESC LIMIT 1
            """
        ).bindparams(p=penawaran.id, w=waktu)
    ).first()
    if r is None:
        return penawaran.harga_satuan, None, None
    # Setengah ke atas, sama dengan Math.round di layar: round() Python membulatkan
    # ke genap terdekat, sehingga harga ,5 rupiah bisa selisih 1 dengan yang dilihat pengguna.
    harga = int((Decimal(penawaran.harga_satuan) * (100 - r.potongan_persen) / 100).quantize(Decimal(1), ROUND_HALF_UP))
    return harga, penawaran.harga_satuan, r.id


def _barang_tujuan(sesi: Session, usaha_id: int, penawaran: Penawaran) -> Barang | None:
    """Barang di gudang yang bertambah saat penawaran ini diterima: dicocokkan lewat produk master."""
    if penawaran.produk_master_id is None:
        return None
    return sesi.exec(
        select(Barang).where(Barang.usaha_id == usaha_id, Barang.produk_master_id == penawaran.produk_master_id)
    ).first()


@rute_umkm.post("/pesanan", response_model=list[PesananLengkap], status_code=201)
def buat_pesanan(badan: PesananBaru, usaha_id: int = Depends(usaha_saya)):
    """
    Kirim keranjang. Satu pesanan per distributor, harga disalin saat ini juga.

    Harga disalin ke baris pesanan, tidak dihitung ulang nanti: pesanan lama
    tidak boleh berubah nilainya hanya karena distributor mengubah daftar harga.
    """
    with Session(mesin()) as sesi:
        if sesi.get(Usaha, usaha_id) is None:
            raise HTTPException(404, "Usaha tidak ditemukan.")
        waktu = _sekarang()
        # Satu pesanan per (distributor, kontrak): pesanan tidak pernah mencampur dua
        # kontrak, supaya kuota tiap kontrak bergerak dari pesanan yang tepat.
        per_distributor: dict[tuple[int, int | None], list[tuple[Penawaran, Decimal]]] = {}
        kontrak_dipakai: dict[int, Kontrak] = {}
        for b in badan.baris:
            pn = sesi.get(Penawaran, b.penawaran_id)
            if pn is None or not pn.aktif:
                raise HTTPException(422, f"Penawaran {b.penawaran_id} tidak ada atau sudah tidak aktif.")
            if b.kontrak_id is not None:
                k = kontrak_dipakai.get(b.kontrak_id) or sesi.exec(
                    select(Kontrak).where(Kontrak.id == b.kontrak_id).with_for_update()
                ).first()
                if (
                    k is None
                    or k.usaha_id != usaha_id
                    or k.penawaran_id != pn.id
                    or status_terbaca(k) not in (StatusKontrak.AKTIF.value, StatusKontrak.AKAN_BERAKHIR.value)
                ):
                    raise HTTPException(422, f"Kontrak {b.kontrak_id} tidak berlaku untuk penawaran {pn.id}.")
                kontrak_dipakai[k.id] = k
            per_distributor.setdefault((pn.distributor_id, b.kontrak_id), []).append((pn, Decimal(b.jumlah)))

        kode = f"BL-{waktu:%y%m%d}-{secrets.token_hex(3).upper()}" if len(per_distributor) > 1 else None
        dibuat: list[Pesanan] = []
        for (distributor_id, kontrak_id), isi in per_distributor.items():
            kontrak = kontrak_dipakai.get(kontrak_id) if kontrak_id is not None else None
            tujuan = [(_barang_tujuan(sesi, usaha_id, pn), pn, n) for pn, n in isi]
            hari_kirim = max((bt.hari_kirim for bt, _, _ in tujuan if bt is not None), default=HARI_KIRIM_BAWAAN)
            p = Pesanan(
                nomor=f"PS-{waktu:%y%m%d}-T{secrets.token_hex(3).upper()}",
                usaha_id=usaha_id,
                distributor_id=distributor_id,
                kontrak_id=kontrak_id,
                dibuat_pada=waktu,
                status=StatusPesanan.MENUNGGU_KONFIRMASI,
                status_bayar=StatusBayar.BELUM_DIBAYAR,
                perkiraan_tiba=waktu + timedelta(days=hari_kirim),
                dari_saran=badan.dari_saran,
                catatan_untuk_distributor=badan.catatan_untuk_distributor,
                kode_belanja=kode,
            )
            sesi.add(p)
            sesi.flush()
            # Nomor mengikuti pola data lama (PS-yymmdd-id) begitu id diketahui.
            p.nomor = f"PS-{waktu:%y%m%d}-{p.id}"
            for barang, pn, n in tujuan:
                if kontrak is not None:
                    # Harga kontrak adalah kesepakatan yang mengikat: promo tidak memotongnya.
                    harga, normal, promo_id = kontrak.harga_satuan, None, None
                    kontrak.dalam_perjalanan = Decimal(kontrak.dalam_perjalanan) + n
                    sesi.add(kontrak)
                else:
                    harga, normal, promo_id = _harga_berlaku(sesi, pn, waktu)
                sesi.add(
                    PesananBaris(
                        pesanan_id=p.id,
                        penawaran_id=pn.id,
                        barang_id=barang.id if barang else None,
                        nama=pn.nama,
                        jumlah=n,
                        satuan=pn.kemasan_nama,
                        harga_satuan=harga,
                        harga_normal=normal,
                        promo_id=promo_id,
                        isi_per_satuan=pn.kemasan_isi,
                    )
                )
            _jejak(sesi, p, StatusPesanan.MENUNGGU_KONFIRMASI, "Pesanan dikirim ke distributor.")
            dibuat.append(p)
        sesi.commit()
        return [_lengkap(sesi, p) for p in dibuat]


@rute_umkm.post("/pesanan/{pesanan_id}/batal", response_model=PesananLengkap)
def batalkan(badan: TolakPesanan, pesanan_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """Pemilik usaha membatalkan pesanan yang belum dijawab distributor."""
    with Session(mesin()) as sesi:
        p = _kunci_pesanan(sesi, pesanan_id, usaha_id=usaha_id)
        _wajib_status(p, StatusPesanan.MENUNGGU_KONFIRMASI)
        p.status = StatusPesanan.BATAL
        sesi.add(p)
        _lepas_dalam_perjalanan(sesi, p)
        _jejak(sesi, p, StatusPesanan.BATAL, f"Dibatalkan pemilik usaha: {badan.alasan}")
        sesi.commit()
        return _lengkap(sesi, p)


@rute_umkm.post("/pesanan/{pesanan_id}/terima", response_model=PesananLengkap)
def terima_barang(badan: Penerimaan, pesanan_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """
    Hitung barang yang datang. Stok naik sebanyak yang DITERIMA, bukan yang dipesan.

    Setiap baris pesanan harus ikut dihitung: penerimaan setengah jalan membuat
    label Mesin 2 ("jumlah sesuai") tidak bisa ditentukan.
    """
    with Session(mesin()) as sesi:
        p = _kunci_pesanan(sesi, pesanan_id, usaha_id=usaha_id)
        _wajib_status(p, StatusPesanan.DIKIRIM)
        semua = {b.id: b for b in sesi.exec(select(PesananBaris).where(PesananBaris.pesanan_id == p.id)).all()}
        isian = {r.baris_id: r for r in badan.baris}
        if set(isian) != set(semua):
            raise HTTPException(422, "Setiap baris pesanan harus diisi jumlah diterimanya, tidak lebih dan tidak kurang.")

        waktu = _sekarang()
        if p.kirim_waktu_sampai is None:
            p.kirim_waktu_sampai = waktu
        ada_catatan = False
        for bid, b in semua.items():
            r = isian[bid]
            b.jumlah_diterima = r.jumlah_diterima
            selisih = r.jumlah_diterima != b.jumlah
            alasan = r.alasan_selisih or (
                (AlasanSelisih.KURANG.value if r.jumlah_diterima < b.jumlah else AlasanSelisih.LEBIH.value) if selisih else None
            )
            b.alasan_selisih = AlasanSelisih(alasan) if alasan else None
            b.catatan_penerimaan = r.catatan
            ada_catatan = ada_catatan or alasan is not None
            sesi.add(b)

            if b.barang_id is None or r.jumlah_diterima <= 0:
                continue
            barang = sesi.exec(select(Barang).where(Barang.id == b.barang_id).with_for_update()).first()
            if barang is None or barang.usaha_id != usaha_id:
                continue
            masuk = Decimal(r.jumlah_diterima) * Decimal(b.isi_per_satuan)
            barang.stok = Decimal(barang.stok) + masuk
            barang.harga_beli_terakhir = b.harga_satuan
            sesi.add(barang)
            sesi.add(
                Pergerakan(
                    usaha_id=usaha_id,
                    barang_id=barang.id,
                    waktu=waktu,
                    jenis=JenisPergerakan.MASUK,
                    jumlah=masuk,
                    stok_sesudah=barang.stok,
                    keterangan=f"Diterima dari pesanan {p.nomor}",
                    pesanan_id=p.id,
                    oleh="Pemilik usaha",
                )
            )

        p.status = StatusPesanan.SELESAI_CATATAN if ada_catatan else StatusPesanan.SELESAI
        sesi.add(p)
        if p.kontrak_id is not None:
            k = sesi.exec(select(Kontrak).where(Kontrak.id == p.kontrak_id).with_for_update()).first()
            if k is not None:
                # Kuota dihitung dari yang DITERIMA, di bulan barang itu diterima.
                per = periode_berjalan(sesi, k, waktu)
                per.diterima = Decimal(per.diterima) + sum(Decimal(b.jumlah_diterima or 0) for b in semua.values())
                sesi.add(per)
                k.dalam_perjalanan = max(Decimal(0), Decimal(k.dalam_perjalanan) - sum(Decimal(b.jumlah) for b in semua.values()))
                sesi.add(k)
        _jejak(
            sesi, p, p.status,
            "Barang diterima dengan catatan selisih." if ada_catatan else "Barang diterima lengkap dan sesuai.",
        )
        sesi.flush()
        _tulis_fitur(sesi, p, list(semua.values()))
        sesi.commit()
        return _lengkap(sesi, p)


# --------------------------------------------------------------------------
# Putaran belajar Mesin 2
# --------------------------------------------------------------------------
def _tulis_fitur(sesi: Session, p: Pesanan, baris: list[PesananBaris]) -> None:
    """
    Satu baris `fitur_pesanan` untuk pesanan yang baru selesai.

    Statistik distributor dihitung dari baris `fitur_pesanan` milik pesanan yang
    DIBUAT sebelum pesanan ini, bukan dari keadaan hari ini: pesanan lain yang
    selesai di antara dibuat dan diterimanya pesanan ini belum diketahui saat
    keputusan memesan diambil.
    """
    dist = sesi.get(Distributor, p.distributor_id)
    usaha = sesi.get(Usaha, p.usaha_id)
    if dist is None or usaha is None:
        return
    s = sesi.exec(
        text(
            """
            SELECT count(*) AS n,
                   coalesce(sum(f.l_tepat_waktu::int), 0) AS tepat,
                   coalesce(sum(f.l_jumlah_sesuai::int), 0) AS jumlah,
                   coalesce(sum(f.l_kondisi_baik::int), 0) AS kondisi,
                   coalesce(sum(q.sudah_diulas::int), 0) AS ulasan,
                   coalesce(sum((f.usaha_id = :u)::int), 0) AS hubungan
              FROM fitur_pesanan f JOIN pesanan q ON q.id = f.pesanan_id
             WHERE f.distributor_id = :d AND q.dibuat_pada < :w
            """
        ).bindparams(d=p.distributor_id, u=p.usaha_id, w=p.dibuat_pada)
    ).one()
    pernah_kontrak = bool(
        sesi.exec(
            text("SELECT EXISTS (SELECT 1 FROM kontrak WHERE usaha_id = :u AND distributor_id = :d AND mulai < :w)")
            .bindparams(u=p.usaha_id, d=p.distributor_id, w=p.dibuat_pada)
        ).scalar()
    )

    # Penghalusan Bayesian yang sama dengan pembangkit dataset.
    BOBOT_AWAL, PRIOR = 8.0, 4.2

    def halus(berhasil: int) -> float:
        return round((BOBOT_AWAL * PRIOR + 5.0 * berhasil + 2.5 * (s.n - berhasil)) / (BOBOT_AWAL + s.n), 4)

    # Rasio harga tiap baris terhadap penawaran termurah untuk produk yang sama saat ini.
    rasio: list[float] = []
    for b in baris:
        r = sesi.exec(
            text(
                """
                SELECT min(x.harga_satuan / NULLIF(x.kemasan_isi, 0)) AS termurah,
                       (SELECT y.harga_satuan / NULLIF(y.kemasan_isi, 0) FROM penawaran y WHERE y.id = :p) AS ini
                  FROM penawaran x
                 WHERE x.aktif AND x.produk_master_id = (SELECT produk_master_id FROM penawaran WHERE id = :p)
                """
            ).bindparams(p=b.penawaran_id)
        ).one()
        rasio.append(float(r.ini / r.termurah) if r.termurah and r.ini else 1.0)

    nilai = int(sum(Decimal(b.jumlah) * b.harga_satuan for b in baris))
    tanggal = p.dibuat_pada.date()
    sampai = p.kirim_waktu_sampai or _sekarang()
    janji = p.perkiraan_tiba or p.dibuat_pada
    telat = (sampai.date() - janji.date()).days
    alasan = {_nilai(b.alasan_selisih) for b in baris if b.alasan_selisih is not None}
    tepat = telat <= 0
    jumlah_sesuai = not (alasan & ALASAN_JUMLAH)
    kondisi_baik = not (alasan & ALASAN_KONDISI)
    stok_cukup = all(
        (sesi.get(Penawaran, b.penawaran_id).stok_tersedia or 0) >= b.jumlah for b in baris
    )

    sesi.exec(
        text("DELETE FROM fitur_pesanan WHERE pesanan_id = :p").bindparams(p=p.id)
    )
    sesi.add(
        FiturPesanan(
            pesanan_id=p.id,
            usaha_id=p.usaha_id,
            distributor_id=p.distributor_id,
            tanggal=tanggal,
            d_aspek_ketepatan=halus(s.tepat),
            d_aspek_jumlah=halus(s.jumlah),
            d_aspek_kondisi=halus(s.kondisi),
            d_jumlah_ulasan=int(s.ulasan),
            d_pesanan_selesai=int(s.n),
            d_umur_hari=(tanggal - dist.sejak).days,
            h_pernah_kontrak=pernah_kontrak,
            h_pesanan_sebelumnya=int(s.hubungan),
            p_jumlah_item=len(baris),
            p_nilai=nilai,
            p_rasio_harga=round(sum(rasio) / max(1, len(rasio)), 4),
            p_sekota=usaha.kota == dist.kota,
            p_hari_pekan=tanggal.weekday(),
            p_bulan=tanggal.month,
            p_musim_hujan=tanggal.month in BULAN_HUJAN,
            p_stok_cukup=stok_cukup,
            p_minimum_terpenuhi=nilai >= dist.minimum_pesanan,
            sukses=tepat and jumlah_sesuai and kondisi_baik,
            l_tepat_waktu=tepat,
            l_jumlah_sesuai=jumlah_sesuai,
            l_kondisi_baik=kondisi_baik,
            l_telat_hari=telat,
        )
    )


# --------------------------------------------------------------------------
# Sisi distributor
# --------------------------------------------------------------------------
@rute_distributor.get("/pesanan-masuk", response_model=list[PesananLengkap])
def daftar_pesanan_masuk(distributor_id: int = Depends(distributor_saya), batas: int = Query(60, ge=1, le=200)):
    """
    Pesanan masuk lengkap dengan baris dan jejak, terbaru dulu. Draf tidak ikut.

    Berbeda dengan `GET /pesanan` (ringkasan untuk tabel panjang): yang ini
    bentuk yang sama dengan yang dibaca pemilik usaha, supaya kedua portal
    membaca pesanan yang persis sama.
    """
    with Session(mesin()) as sesi:
        semua = sesi.exec(
            select(Pesanan)
            .where(Pesanan.distributor_id == distributor_id, Pesanan.status != StatusPesanan.DRAF)
            .order_by(Pesanan.dibuat_pada.desc(), Pesanan.id.desc())
            .limit(batas)
        ).all()
        return [_lengkap(sesi, p) for p in semua]


@rute_distributor.get("/pesanan/{pesanan_id}", response_model=PesananLengkap)
def rincian_pesanan_masuk(pesanan_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = sesi.get(Pesanan, pesanan_id)
        if p is None or p.distributor_id != distributor_id:
            raise HTTPException(404, "Pesanan tidak ditemukan.")
        return _lengkap(sesi, p)


@rute_distributor.post("/pesanan/{pesanan_id}/konfirmasi", response_model=PesananLengkap)
def konfirmasi(badan: KonfirmasiPesanan, pesanan_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = _kunci_pesanan(sesi, pesanan_id, distributor_id=distributor_id)
        _wajib_status(p, StatusPesanan.MENUNGGU_KONFIRMASI)
        if badan.perkiraan_tiba is not None:
            p.perkiraan_tiba = badan.perkiraan_tiba
        p.status = StatusPesanan.DISIAPKAN
        sesi.add(p)
        _jejak(sesi, p, StatusPesanan.DISIAPKAN, "Pesanan diterima distributor dan sedang disiapkan.")
        sesi.commit()
        return _lengkap(sesi, p)


@rute_distributor.post("/pesanan/{pesanan_id}/tolak", response_model=PesananLengkap)
def tolak(badan: TolakPesanan, pesanan_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = _kunci_pesanan(sesi, pesanan_id, distributor_id=distributor_id)
        _wajib_status(p, StatusPesanan.MENUNGGU_KONFIRMASI)
        p.status = StatusPesanan.BATAL
        p.alasan_tolak = badan.alasan
        sesi.add(p)
        _lepas_dalam_perjalanan(sesi, p)
        _jejak(sesi, p, StatusPesanan.BATAL, f"Ditolak distributor: {badan.alasan}")
        sesi.commit()
        return _lengkap(sesi, p)


@rute_distributor.post("/pesanan/{pesanan_id}/kirim", response_model=PesananLengkap)
def kirim(badan: KirimPesanan, pesanan_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        p = _kunci_pesanan(sesi, pesanan_id, distributor_id=distributor_id)
        _wajib_status(p, StatusPesanan.DISIAPKAN)
        p.status = StatusPesanan.DIKIRIM
        p.kirim_kurir, p.kirim_pengantar, p.kirim_nomor_resi = badan.kurir, badan.pengantar, badan.nomor_resi
        sesi.add(p)
        _jejak(sesi, p, StatusPesanan.DIKIRIM, "Barang dalam perjalanan.")
        sesi.commit()
        return _lengkap(sesi, p)


@rute_distributor.post("/pesanan/{pesanan_id}/sampai", response_model=PesananLengkap)
def sampai(badan: SampaiPesanan, pesanan_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    """Bukti antar. Status tetap `dikirim`: stok baru naik setelah pemilik usaha menghitung barangnya."""
    with Session(mesin()) as sesi:
        p = _kunci_pesanan(sesi, pesanan_id, distributor_id=distributor_id)
        _wajib_status(p, StatusPesanan.DIKIRIM)
        p.kirim_waktu_sampai = _sekarang()
        p.kirim_diterima_oleh, p.kirim_catatan = badan.diterima_oleh, badan.catatan
        sesi.add(p)
        _jejak(sesi, p, StatusPesanan.DIKIRIM, "Distributor menandai barang sudah sampai. Menunggu dihitung pemilik usaha.")
        sesi.commit()
        return _lengkap(sesi, p)
