"""
Kontrak berjangka dengan kuota bulanan: dari pengajuan sampai berhenti.

    UMKM        POST /usaha/{u}/kontrak                         -> menunggu-persetujuan
                POST /usaha/{u}/kontrak/{k}/berhenti            (pengajuan berhenti; kontrak tetap jalan)
                POST /usaha/{u}/kontrak/{k}/rutin               (pesanan rutin hidup/mati)
    Distributor POST /distributor/{d}/kontrak/{k}/setujui       -> aktif, masa dihitung sejak hari ini
                POST /distributor/{d}/kontrak/{k}/tolak         -> ditolak, wajib beralasan
                POST /distributor/{d}/kontrak/{k}/jawab-berhenti -> dihentikan, atau tetap jalan

Aturan yang dijaga:

- **Harga dan kuota disalin dari paket saat diajukan.** Paket yang diubah
  distributor sesudahnya tidak mengubah kontrak yang sudah ada.
- **Kontrak tidak bisa dihentikan sepihak.** Pengajuan berhenti hanya tercatat
  sampai distributor menjawab; selama itu kewajiban kuota tetap berlaku.
- **Status waktu dihitung saat dibaca.** "Akan berakhir" (30 hari terakhir) dan
  "selesai" (lewat tanggal berakhir) tidak butuh penjadwal yang mengubah baris.

Kuota bulanan (`kontrak_periode`) bergerak dari jalur pesanan di `pesanan.py`.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import StatusKontrak
from warungku.model import Barang, Kontrak, KontrakPeriode, PaketKontrak, Penawaran, Usaha

from .otentikasi import distributor_saya, usaha_saya
from .skema import AjukanKontrak, AlasanWajib, JawabBerhenti, KontrakLengkap, PeriodeKontrak, PesananRutin

rute_umkm = APIRouter(prefix="/usaha/{usaha_id}", tags=["kontrak"])
rute_distributor = APIRouter(prefix="/distributor/{distributor_id}", tags=["kontrak"])

HARI_AKAN_BERAKHIR = 30


def _sekarang() -> datetime:
    return datetime.now(timezone.utc)


def _nilai(x) -> str:
    return str(getattr(x, "value", x))


def tambah_bulan(t: datetime, n: int) -> datetime:
    """Tanggal yang sama n bulan kemudian; 31 Jan + 1 bulan = 28/29 Feb."""
    bulan = t.month - 1 + n
    tahun, bulan = t.year + bulan // 12, bulan % 12 + 1
    hari = min(t.day, calendar.monthrange(tahun, bulan)[1])
    return t.replace(year=tahun, month=bulan, day=hari)


def kode_periode(t: datetime | date) -> str:
    return f"{t.year}-{t.month:02d}"


def periode_berjalan(sesi: Session, k: Kontrak, waktu: datetime) -> KontrakPeriode:
    """Baris kuota bulan `waktu`, dibuat kalau belum ada. Dipakai juga oleh jalur pesanan."""
    kode = kode_periode(waktu)
    p = sesi.exec(
        select(KontrakPeriode).where(KontrakPeriode.kontrak_id == k.id, KontrakPeriode.periode == kode)
    ).first()
    if p is None:
        p = KontrakPeriode(kontrak_id=k.id, periode=kode, kuota=k.kuota_min_per_bulan, diterima=Decimal(0))
        sesi.add(p)
        sesi.flush()
    return p


def status_terbaca(k: Kontrak, sekarang: datetime | None = None) -> str:
    sekarang = sekarang or _sekarang()
    s = _nilai(k.status)
    if s in (StatusKontrak.AKTIF.value, StatusKontrak.AKAN_BERAKHIR.value):
        if k.berakhir <= sekarang:
            return StatusKontrak.SELESAI.value
        if k.berakhir - sekarang <= timedelta(days=HARI_AKAN_BERAKHIR):
            return StatusKontrak.AKAN_BERAKHIR.value
        return StatusKontrak.AKTIF.value
    return s


def lengkap(sesi: Session, k: Kontrak) -> KontrakLengkap:
    u = sesi.get(Usaha, k.usaha_id)
    periode = sesi.exec(
        select(KontrakPeriode).where(KontrakPeriode.kontrak_id == k.id).order_by(KontrakPeriode.periode)
    ).all()
    daftar = [PeriodeKontrak(periode=p.periode, kuota=p.kuota, diterima=p.diterima, selesai=p.selesai) for p in periode]
    # Kontrak aktif selalu punya periode bulan ini, walau belum ada barang yang diterima.
    kini = kode_periode(_sekarang())
    if status_terbaca(k) in ("aktif", "akan-berakhir") and not any(p.periode == kini for p in daftar):
        daftar.append(PeriodeKontrak(periode=kini, kuota=k.kuota_min_per_bulan, diterima=Decimal(0), selesai=False))
    return KontrakLengkap(
        id=k.id,
        usaha_id=k.usaha_id,
        nama_usaha=u.nama if u else "",
        usaha_jenis=_nilai(u.jenis_usaha) if u else "",
        usaha_kota=u.kota if u else "",
        usaha_alamat=u.alamat if u else "",
        usaha_nomor_hp=u.nomor_hp if u else "",
        distributor_id=k.distributor_id,
        penawaran_id=k.penawaran_id,
        paket_id=k.paket_id,
        barang_id=k.barang_id,
        nama_barang=k.nama_barang,
        durasi_bulan=k.durasi_bulan,
        kuota_min_per_bulan=k.kuota_min_per_bulan,
        harga_satuan=k.harga_satuan,
        satuan=k.satuan,
        mulai=k.mulai,
        berakhir=k.berakhir,
        status=status_terbaca(k),
        dalam_perjalanan=k.dalam_perjalanan,
        ketentuan_kuota_kurang=k.ketentuan_kuota_kurang,
        pesanan_rutin_aktif=k.pesanan_rutin_aktif,
        pesanan_rutin_berikutnya=k.pesanan_rutin_berikutnya,
        alasan_ditolak=k.alasan_ditolak,
        pengajuan_berhenti_waktu=k.pengajuan_berhenti_waktu,
        pengajuan_berhenti_alasan=k.pengajuan_berhenti_alasan,
        jawaban_berhenti_waktu=k.jawaban_berhenti_waktu,
        jawaban_berhenti_disetujui=k.jawaban_berhenti_disetujui,
        jawaban_berhenti_alasan=k.jawaban_berhenti_alasan,
        periode=daftar,
    )


def _kunci(sesi: Session, kontrak_id: int, *, usaha_id: int | None = None, distributor_id: int | None = None) -> Kontrak:
    k = sesi.exec(select(Kontrak).where(Kontrak.id == kontrak_id).with_for_update()).first()
    if k is None or (usaha_id is not None and k.usaha_id != usaha_id) or (
        distributor_id is not None and k.distributor_id != distributor_id
    ):
        raise HTTPException(404, "Kontrak tidak ditemukan.")
    return k


def _wajib(k: Kontrak, *status: StatusKontrak) -> None:
    if status_terbaca(k) not in {s.value for s in status}:
        raise HTTPException(409, f"Kontrak berstatus {status_terbaca(k)}; langkah ini tidak berlaku.")


# --------------------------------------------------------------------------
# Sisi pemilik usaha
# --------------------------------------------------------------------------
@rute_umkm.get("/kontrak", response_model=list[KontrakLengkap])
def daftar_kontrak(usaha_id: int = Depends(usaha_saya)):
    with Session(mesin()) as sesi:
        semua = sesi.exec(select(Kontrak).where(Kontrak.usaha_id == usaha_id).order_by(Kontrak.id.desc())).all()
        return [lengkap(sesi, k) for k in semua]


@rute_umkm.post("/kontrak", response_model=KontrakLengkap, status_code=201)
def ajukan(badan: AjukanKontrak, usaha_id: int = Depends(usaha_saya)):
    """
    Ajukan kontrak dari satu paket. Mengajukan paket yang sama dua kali selama
    pengajuan pertama belum dijawab mengembalikan pengajuan yang sama.
    """
    with Session(mesin()) as sesi:
        paket = sesi.get(PaketKontrak, badan.paket_id)
        if paket is None:
            raise HTTPException(404, "Paket kontrak tidak ditemukan.")
        ada = sesi.exec(
            select(Kontrak).where(
                Kontrak.usaha_id == usaha_id,
                Kontrak.paket_id == paket.id,
                Kontrak.status == StatusKontrak.MENUNGGU_PERSETUJUAN,
            )
        ).first()
        if ada is not None:
            return lengkap(sesi, ada)
        pn = sesi.get(Penawaran, paket.penawaran_id)
        barang = None
        if pn is not None and pn.produk_master_id is not None:
            barang = sesi.exec(
                select(Barang).where(Barang.usaha_id == usaha_id, Barang.produk_master_id == pn.produk_master_id)
            ).first()
        mulai = _sekarang()
        k = Kontrak(
            usaha_id=usaha_id,
            distributor_id=paket.distributor_id,
            penawaran_id=paket.penawaran_id,
            paket_id=paket.id,
            barang_id=barang.id if barang else None,
            nama_barang=pn.nama if pn else paket.kode,
            durasi_bulan=paket.durasi_bulan,
            kuota_min_per_bulan=paket.kuota_min_per_bulan,
            harga_satuan=paket.harga_satuan,
            satuan=pn.kemasan_nama if pn else "",
            # Sementara; dihitung ulang sejak tanggal disetujui.
            mulai=mulai,
            berakhir=tambah_bulan(mulai, paket.durasi_bulan),
            status=StatusKontrak.MENUNGGU_PERSETUJUAN,
            ketentuan_kuota_kurang=paket.ketentuan_kuota_kurang,
        )
        sesi.add(k)
        sesi.commit()
        return lengkap(sesi, k)


@rute_umkm.post("/kontrak/{kontrak_id}/berhenti", response_model=KontrakLengkap)
def ajukan_berhenti(badan: AlasanWajib, kontrak_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    with Session(mesin()) as sesi:
        k = _kunci(sesi, kontrak_id, usaha_id=usaha_id)
        _wajib(k, StatusKontrak.AKTIF, StatusKontrak.AKAN_BERAKHIR)
        k.pengajuan_berhenti_waktu = _sekarang()
        k.pengajuan_berhenti_alasan = badan.alasan
        k.jawaban_berhenti_waktu = k.jawaban_berhenti_disetujui = k.jawaban_berhenti_alasan = None
        sesi.add(k)
        sesi.commit()
        return lengkap(sesi, k)


@rute_umkm.post("/kontrak/{kontrak_id}/rutin", response_model=KontrakLengkap)
def atur_rutin(badan: PesananRutin, kontrak_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """Pesanan rutin hidup atau mati. Draf pesanannya sendiri belum dibuat otomatis oleh server."""
    with Session(mesin()) as sesi:
        k = _kunci(sesi, kontrak_id, usaha_id=usaha_id)
        _wajib(k, StatusKontrak.AKTIF, StatusKontrak.AKAN_BERAKHIR)
        k.pesanan_rutin_aktif = badan.aktif
        k.pesanan_rutin_berikutnya = (_sekarang() + timedelta(days=7)).date() if badan.aktif else None
        sesi.add(k)
        sesi.commit()
        return lengkap(sesi, k)


# --------------------------------------------------------------------------
# Sisi distributor
# --------------------------------------------------------------------------
@rute_distributor.get("/kontrak", response_model=list[KontrakLengkap])
def kontrak_masuk(distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        semua = sesi.exec(
            select(Kontrak).where(Kontrak.distributor_id == distributor_id).order_by(Kontrak.id.desc())
        ).all()
        return [lengkap(sesi, k) for k in semua]


@rute_distributor.post("/kontrak/{kontrak_id}/setujui", response_model=KontrakLengkap)
def setujui(kontrak_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    """Masa kontrak dihitung sejak disetujui: sebelum itu belum ada kewajiban apa pun."""
    with Session(mesin()) as sesi:
        k = _kunci(sesi, kontrak_id, distributor_id=distributor_id)
        _wajib(k, StatusKontrak.MENUNGGU_PERSETUJUAN)
        k.mulai = _sekarang()
        k.berakhir = tambah_bulan(k.mulai, k.durasi_bulan)
        k.status = StatusKontrak.AKTIF
        sesi.add(k)
        sesi.flush()
        periode_berjalan(sesi, k, k.mulai)
        sesi.commit()
        return lengkap(sesi, k)


@rute_distributor.post("/kontrak/{kontrak_id}/tolak", response_model=KontrakLengkap)
def tolak(badan: AlasanWajib, kontrak_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        k = _kunci(sesi, kontrak_id, distributor_id=distributor_id)
        _wajib(k, StatusKontrak.MENUNGGU_PERSETUJUAN)
        k.status = StatusKontrak.DITOLAK
        k.alasan_ditolak = badan.alasan
        sesi.add(k)
        sesi.commit()
        return lengkap(sesi, k)


@rute_distributor.post("/kontrak/{kontrak_id}/jawab-berhenti", response_model=KontrakLengkap)
def jawab_berhenti(badan: JawabBerhenti, kontrak_id: int = Path(ge=1), distributor_id: int = Depends(distributor_saya)):
    with Session(mesin()) as sesi:
        k = _kunci(sesi, kontrak_id, distributor_id=distributor_id)
        if k.pengajuan_berhenti_waktu is None:
            raise HTTPException(409, "Tidak ada pengajuan berhenti yang menunggu jawaban.")
        if not badan.setuju and not (badan.alasan or "").strip():
            raise HTTPException(422, "Menolak pengajuan berhenti wajib disertai alasan.")
        waktu = _sekarang()
        k.jawaban_berhenti_waktu = waktu
        k.jawaban_berhenti_disetujui = badan.setuju
        k.jawaban_berhenti_alasan = None if badan.setuju else badan.alasan.strip()
        k.pengajuan_berhenti_waktu = k.pengajuan_berhenti_alasan = None
        if badan.setuju:
            k.status = StatusKontrak.DIHENTIKAN
            k.berakhir = waktu
            k.pesanan_rutin_aktif = False
            k.pesanan_rutin_berikutnya = None
        sesi.add(k)
        sesi.commit()
        return lengkap(sesi, k)
