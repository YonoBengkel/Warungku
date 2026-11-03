"""
Kasir Portal POS: akun kasir yang dikelola pemilik, dan shift kas.

* Akun kasir = `pengguna` + `keanggotaan` berperan pegawai. Ia masuk lewat `/auth/pos/masuk`
  dan mendapat token jenis `kasir`, yang hanya diterima endpoint POS (`kasir_atau_pemilik`).
  Mengelola akun kasir hanya untuk pemilik (`usaha_saya`).
* Shift: buka dengan uang modal, tutup dengan uang yang dihitung di laci. Selisih =
  uang dihitung dikurangi (modal + tunai dari nota shift ini). QRIS dan transfer tidak
  masuk laci, jadi tidak ikut dihitung.
* QR simulasi (revisi V8, Q178): kasir membuat tagihan, HP pelanggan membuka tautan di
  QR-nya (`/bayar/{token}`, tanpa masuk), dan tagihan ditandai lunas. Bukan QRIS dan
  tidak ada uang yang berpindah. Tombol cadangan menandai lunas dari layar kasir.
"""

from __future__ import annotations

import html
import os
import secrets
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path as BerkasPath

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import PeranPengguna
from warungku.model import Keanggotaan, PembayaranQr, Pengguna, ShiftKas, Usaha

from .otentikasi import Identitas, acak_kata_sandi, identitas, kasir_atau_pemilik, usaha_saya

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["kasir"])
#: Halaman yang dibuka HP pelanggan dari QR simulasi. Tanpa token masuk: kuncinya
#: adalah token tagihan yang acak dan panjang.
rute_publik = APIRouter(tags=["bayar simulasi"])


# ---------------------------------------------------------------- akun kasir


class KasirBaru(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    email: EmailStr
    nomor_hp: str = Field(min_length=8, max_length=20)
    kata_sandi: str = Field(min_length=6, max_length=128)


class KasirUbah(BaseModel):
    aktif: bool | None = None
    kata_sandi: str | None = Field(default=None, min_length=6, max_length=128)


class KasirKeluar(BaseModel):
    pengguna_id: int
    nama: str
    email: str | None
    nomor_hp: str
    aktif: bool
    dibuat_pada: datetime | None


def _kasir_keluar(p: Pengguna) -> KasirKeluar:
    return KasirKeluar(pengguna_id=p.id, nama=p.nama, email=p.email, nomor_hp=p.nomor_hp, aktif=p.aktif, dibuat_pada=p.dibuat_pada)


def _kasir_usaha(sesi: Session, usaha_id: int) -> list[Pengguna]:
    return list(
        sesi.exec(
            select(Pengguna)
            .join(Keanggotaan, Keanggotaan.pengguna_id == Pengguna.id)
            .where(Keanggotaan.usaha_id == usaha_id, Keanggotaan.peran == PeranPengguna.PEGAWAI)
            .order_by(Pengguna.nama)
        ).all()
    )


@rute.get("/kasir", response_model=list[KasirKeluar])
def daftar_kasir(usaha_id: int = Depends(usaha_saya)) -> list[KasirKeluar]:
    with Session(mesin()) as sesi:
        return [_kasir_keluar(p) for p in _kasir_usaha(sesi, usaha_id)]


@rute.post("/kasir", response_model=KasirKeluar, status_code=201)
def tambah_kasir(badan: KasirBaru, usaha_id: int = Depends(usaha_saya)) -> KasirKeluar:
    """Pemilik membuat akun kasir. Email dan nomor HP tidak boleh sudah dipakai akun lain."""
    with Session(mesin()) as sesi:
        email = str(badan.email).lower()
        if sesi.exec(select(Pengguna).where(Pengguna.email == email)).first() is not None:
            raise HTTPException(409, "Email ini sudah dipakai akun lain.")
        if sesi.exec(select(Pengguna).where(Pengguna.nomor_hp == badan.nomor_hp)).first() is not None:
            raise HTTPException(409, "Nomor HP ini sudah dipakai akun lain.")
        pengguna = Pengguna(
            nomor_hp=badan.nomor_hp,
            email=email,
            kata_sandi_hash=acak_kata_sandi(badan.kata_sandi),
            nama=badan.nama.strip(),
        )
        sesi.add(pengguna)
        sesi.flush()
        sesi.add(Keanggotaan(pengguna_id=pengguna.id, usaha_id=usaha_id, peran=PeranPengguna.PEGAWAI))
        sesi.commit()
        sesi.refresh(pengguna)
        return _kasir_keluar(pengguna)


@rute.patch("/kasir/{pengguna_id}", response_model=KasirKeluar)
def ubah_kasir(pengguna_id: int, badan: KasirUbah, usaha_id: int = Depends(usaha_saya)) -> KasirKeluar:
    """Nonaktifkan atau aktifkan lagi akun kasir, atau atur ulang kata sandinya."""
    with Session(mesin()) as sesi:
        pengguna = next((p for p in _kasir_usaha(sesi, usaha_id) if p.id == pengguna_id), None)
        if pengguna is None:
            raise HTTPException(404, "Kasir tidak ditemukan di usaha ini.")
        if badan.aktif is not None:
            pengguna.aktif = badan.aktif
        if badan.kata_sandi is not None:
            pengguna.kata_sandi_hash = acak_kata_sandi(badan.kata_sandi)
        sesi.add(pengguna)
        sesi.commit()
        sesi.refresh(pengguna)
        return _kasir_keluar(pengguna)


# ---------------------------------------------------------------------- shift


class BukaShift(BaseModel):
    modal_awal: int = Field(ge=0, le=1_000_000_000)


class TutupShift(BaseModel):
    uang_dihitung: int = Field(ge=0, le=1_000_000_000)
    catatan: str | None = Field(default=None, max_length=200)


class ShiftKeluar(BaseModel):
    id: int
    nama_kasir: str
    dibuka_pada: datetime
    ditutup_pada: datetime | None
    modal_awal: int
    jumlah_nota: int
    tunai: int
    qris: int
    transfer: int
    #: Modal awal ditambah tunai dari nota shift ini.
    tunai_diharapkan: int
    uang_dihitung: int | None
    #: Uang dihitung dikurangi yang diharapkan. Negatif: laci kurang.
    selisih: int | None
    catatan: str | None


_REKAP = """
    SELECT COUNT(*) AS jumlah,
           COALESCE(SUM(bersih) FILTER (WHERE cara_bayar = 'tunai'), 0) AS tunai,
           COALESCE(SUM(bersih) FILTER (WHERE cara_bayar = 'qris'), 0) AS qris,
           COALESCE(SUM(bersih) FILTER (WHERE cara_bayar = 'transfer'), 0) AS transfer
      FROM (
        SELECT t.id, t.cara_bayar,
               GREATEST(COALESCE(SUM(b.jumlah * b.harga_jual_satuan), 0) - t.diskon, 0) AS bersih
          FROM transaksi t JOIN transaksi_baris b ON b.transaksi_id = t.id
         WHERE t.shift_id = :s AND NOT t.dibatalkan
         GROUP BY t.id
      ) n
"""


def _rekap(sesi: Session, shift_id: int) -> tuple[int, int, int, int]:
    r = sesi.exec(text(_REKAP).bindparams(s=shift_id)).one()
    return int(r.jumlah), int(round(r.tunai)), int(round(r.qris)), int(round(r.transfer))


def _shift_keluar(sesi: Session, s: ShiftKas) -> ShiftKeluar:
    """Shift terbuka dihitung langsung. Shift tertutup memakai rekap yang dibekukan saat ditutup."""
    if s.ditutup_pada is None:
        jumlah, tunai, qris, transfer = _rekap(sesi, s.id)
        diharapkan, selisih = s.modal_awal + tunai, None
    else:
        jumlah, tunai, qris, transfer = s.jumlah_nota or 0, s.tunai or 0, s.qris or 0, s.transfer or 0
        diharapkan, selisih = s.tunai_diharapkan or 0, s.selisih
    return ShiftKeluar(
        id=s.id, nama_kasir=s.nama_kasir, dibuka_pada=s.dibuka_pada, ditutup_pada=s.ditutup_pada,
        modal_awal=s.modal_awal, jumlah_nota=jumlah, tunai=tunai, qris=qris, transfer=transfer,
        tunai_diharapkan=diharapkan, uang_dihitung=s.uang_dihitung, selisih=selisih, catatan=s.catatan,
    )


def _shift_terbuka(sesi: Session, usaha_id: int) -> ShiftKas | None:
    return sesi.exec(
        select(ShiftKas).where(ShiftKas.usaha_id == usaha_id, ShiftKas.ditutup_pada == None)  # noqa: E711
        .with_for_update()
    ).first()


@rute.get("/shift/aktif", response_model=ShiftKeluar | None)
def shift_aktif(usaha_id: int = Depends(kasir_atau_pemilik)) -> ShiftKeluar | None:
    with Session(mesin()) as sesi:
        s = _shift_terbuka(sesi, usaha_id)
        return _shift_keluar(sesi, s) if s else None


@rute.post("/shift/buka", response_model=ShiftKeluar, status_code=201)
def buka_shift(
    badan: BukaShift, usaha_id: int = Depends(kasir_atau_pemilik), saya: Identitas = Depends(identitas)
) -> ShiftKeluar:
    with Session(mesin()) as sesi:
        pengguna = sesi.get(Pengguna, saya.pengguna_id)
        s = ShiftKas(
            usaha_id=usaha_id, dibuka_oleh=saya.pengguna_id, nama_kasir=pengguna.nama if pengguna else "Kasir",
            dibuka_pada=datetime.now(timezone.utc), modal_awal=badan.modal_awal,
        )
        sesi.add(s)
        try:
            sesi.commit()
        except IntegrityError:
            sesi.rollback()
            raise HTTPException(409, "Sudah ada shift yang terbuka. Tutup dulu sebelum membuka yang baru.")
        sesi.refresh(s)
        return _shift_keluar(sesi, s)


@rute.post("/shift/tutup", response_model=ShiftKeluar)
def tutup_shift(badan: TutupShift, usaha_id: int = Depends(kasir_atau_pemilik)) -> ShiftKeluar:
    """Tutup shift: bekukan rekap, hitung selisih terhadap uang yang dihitung di laci."""
    with Session(mesin()) as sesi:
        s = _shift_terbuka(sesi, usaha_id)
        if s is None:
            raise HTTPException(409, "Tidak ada shift yang terbuka.")
        jumlah, tunai, qris, transfer = _rekap(sesi, s.id)
        s.ditutup_pada = datetime.now(timezone.utc)
        s.jumlah_nota, s.tunai, s.qris, s.transfer = jumlah, tunai, qris, transfer
        s.tunai_diharapkan = s.modal_awal + tunai
        s.uang_dihitung = badan.uang_dihitung
        s.selisih = badan.uang_dihitung - s.tunai_diharapkan
        s.catatan = (badan.catatan or "").strip() or None
        sesi.add(s)
        sesi.commit()
        sesi.refresh(s)
        return _shift_keluar(sesi, s)


@rute.get("/shift", response_model=list[ShiftKeluar])
def riwayat_shift(
    usaha_id: int = Depends(usaha_saya),
    batas: int = Query(default=10, ge=1, le=50),
    mulai: int = Query(default=0, ge=0, description="Lewati sekian shift terbaru, untuk halaman berikutnya."),
) -> list[ShiftKeluar]:
    """Shift terbaru, untuk pemilik."""
    with Session(mesin()) as sesi:
        daftar = sesi.exec(
            select(ShiftKas)
            .where(ShiftKas.usaha_id == usaha_id)
            .order_by(ShiftKas.dibuka_pada.desc(), ShiftKas.id.desc())
            .limit(batas)
            .offset(mulai)
        ).all()
        return [_shift_keluar(sesi, s) for s in daftar]


# ------------------------------------------------------- QR simulasi (V8)

#: Tagihan QR yang belum dibayar selama ini dianggap kedaluwarsa.
UMUR_QR = timedelta(minutes=10)


class QrBaru(BaseModel):
    nomor_struk: str = Field(min_length=1, max_length=60)
    jumlah: int = Field(gt=0, le=1_000_000_000)


class QrKeluar(BaseModel):
    token: str
    #: Tautan yang dimuat di QR.
    url: str
    #: False kalau alamat jaringan laptop tidak diketahui, sehingga HP kemungkinan tidak
    #: bisa membuka tautannya; layar kasir lalu menyarankan tombol cadangan.
    terjangkau_hp: bool
    jumlah: int
    #: 'menunggu', 'lunas', atau 'kedaluwarsa' (dihitung, tidak disimpan).
    status: str
    kedaluwarsa_pada: datetime


def _ip_lan() -> str | None:
    """
    Alamat IPv4 laptop di jaringan lokal, tanpa mengirim paket apa pun: membuka soket
    UDP ke alamat yang tidak dirutekan hanya membuat sistem memilih antarmuka keluar.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()
    return None if ip.startswith("127.") else ip


def _alamat_publik(request: Request) -> tuple[str, bool]:
    """
    Awal tautan yang bisa dibuka HP di jaringan yang sama, dan apakah itu mungkin terjangkau.

    Urutannya: `WARUNGKU_ALAMAT_QR` yang diisi `siapkan.cmd` atau `nyalakan.cmd` (alamat
    Wi-Fi laptop beserta port API), lalu alamat yang dipakai kasir kalau ia membuka API
    lewat alamat jaringan, lalu alamat jaringan yang dideteksi sendiri. Di dalam kontainer
    Docker deteksi itu menghasilkan alamat kontainer, yang tidak bisa dijangkau HP.
    """
    env = os.environ.get("WARUNGKU_ALAMAT_QR", "").strip().rstrip("/")
    if env:
        return env, True
    host = request.url.hostname or ""
    if host not in ("localhost", "127.0.0.1", "::1"):
        return str(request.base_url).rstrip("/"), True
    if BerkasPath("/.dockerenv").exists():
        return str(request.base_url).rstrip("/"), False
    ip = _ip_lan()
    if ip is None:
        return str(request.base_url).rstrip("/"), False
    return f"http://{ip}:{request.url.port or 8000}", True


def _kedaluwarsa(q: PembayaranQr) -> bool:
    return q.status == "menunggu" and datetime.now(timezone.utc) > q.kedaluwarsa_pada


def _qr_keluar(q: PembayaranQr, request: Request) -> QrKeluar:
    alamat, terjangkau = _alamat_publik(request)
    return QrKeluar(
        token=q.token, url=f"{alamat}/bayar/{q.token}", terjangkau_hp=terjangkau, jumlah=q.jumlah,
        status="kedaluwarsa" if _kedaluwarsa(q) else q.status, kedaluwarsa_pada=q.kedaluwarsa_pada,
    )


def _qr_milik(sesi: Session, usaha_id: int, token: str) -> PembayaranQr:
    q = sesi.exec(select(PembayaranQr).where(PembayaranQr.token == token, PembayaranQr.usaha_id == usaha_id)).first()
    if q is None:
        raise HTTPException(404, "Tagihan QR tidak ditemukan di usaha ini.")
    return q


def _lunaskan(sesi: Session, q: PembayaranQr, cara: str) -> None:
    """Tandai lunas sekali saja. Memindai ulang atau menekan tombol lagi tidak mengubah apa pun."""
    if q.status == "lunas":
        return
    if _kedaluwarsa(q):
        raise HTTPException(410, "Tagihan QR ini sudah kedaluwarsa. Minta kasir membuat QR baru.")
    q.status, q.cara_lunas, q.lunas_pada = "lunas", cara, datetime.now(timezone.utc)
    sesi.add(q)
    sesi.commit()
    sesi.refresh(q)


@rute.post("/qr", response_model=QrKeluar, status_code=201)
def buat_qr(badan: QrBaru, request: Request, usaha_id: int = Depends(kasir_atau_pemilik)) -> QrKeluar:
    """Tagihan QR simulasi untuk satu nota yang belum dikirim."""
    sekarang = datetime.now(timezone.utc)
    q = PembayaranQr(
        usaha_id=usaha_id, token=secrets.token_urlsafe(24), nomor_struk=badan.nomor_struk.strip(),
        jumlah=badan.jumlah, dibuat_pada=sekarang, kedaluwarsa_pada=sekarang + UMUR_QR,
    )
    with Session(mesin()) as sesi:
        sesi.add(q)
        sesi.commit()
        sesi.refresh(q)
        return _qr_keluar(q, request)


@rute.get("/qr/{token}", response_model=QrKeluar)
def status_qr(token: str, request: Request, usaha_id: int = Depends(kasir_atau_pemilik)) -> QrKeluar:
    """Ditanyakan layar kasir berulang-ulang sampai tagihannya lunas."""
    with Session(mesin()) as sesi:
        return _qr_keluar(_qr_milik(sesi, usaha_id, token), request)


@rute.post("/qr/{token}/lunas", response_model=QrKeluar)
def lunaskan_qr(token: str, request: Request, usaha_id: int = Depends(kasir_atau_pemilik)) -> QrKeluar:
    """Tombol cadangan Anggap Sudah Dibayar, untuk jaringan yang tidak bisa dijangkau HP."""
    with Session(mesin()) as sesi:
        q = _qr_milik(sesi, usaha_id, token)
        _lunaskan(sesi, q, "tombol")
        return _qr_keluar(q, request)


_HALAMAN_BAYAR = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Pembayaran simulasi</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body {{ margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #f4f6f8;
         font-family: system-ui, sans-serif; color: #111a23; padding: 16px; }}
  main {{ width: 100%; max-width: 22rem; background: #fff; border: 1px solid #e2e6ea; border-radius: 16px;
          padding: 24px; text-align: center; }}
  .label {{ display: inline-block; font-size: 12px; font-weight: 700; color: #3a0a73; background: #f3ecfb;
            border-radius: 999px; padding: 4px 10px; }}
  h1 {{ font-size: 20px; margin: 16px 0 4px; }}
  .jumlah {{ font-size: 32px; font-weight: 800; margin: 8px 0; }}
  p {{ color: #48545f; font-size: 14px; line-height: 1.5; margin: 8px 0 0; }}
  #status {{ font-weight: 700; color: #111a23; }}
  .ok #status {{ color: #15803d; }}
  .gagal #status {{ color: #c1121f; }}
</style>
</head>
<body>
<main>
  <span class="label">Simulasi, bukan QRIS sungguhan</span>
  <h1>{usaha}</h1>
  <div class="jumlah">{jumlah}</div>
  <p id="status">Memproses pembayaran simulasi&hellip;</p>
  <p>Tidak ada uang yang berpindah. Halaman ini hanya untuk demo Turnify Flow.</p>
</main>
<script>
  // Lunas dikirim lewat POST dari halaman ini, bukan saat halaman dimuat, supaya
  // pratinjau tautan di aplikasi kamera tidak ikut melunasi tagihan.
  fetch(location.pathname + '/lunas', {{ method: 'POST' }})
    .then(function (r) {{ return r.json().then(function (j) {{ return {{ ok: r.ok, j: j }} }}) }})
    .then(function (h) {{
      var el = document.getElementById('status')
      if (h.ok) {{ document.body.className = 'ok'; el.textContent = 'Pembayaran simulasi diterima. Kasir melanjutkan nota.' }}
      else {{ document.body.className = 'gagal'; el.textContent = h.j.detail || 'Pembayaran simulasi belum bisa diproses.' }}
    }})
    .catch(function () {{ document.body.className = 'gagal'; document.getElementById('status').textContent = 'Server tidak bisa dihubungi dari HP ini.' }})
</script>
</body>
</html>
"""


def _rupiah(n: int) -> str:
    return "Rp " + f"{n:,}".replace(",", ".")


@rute_publik.get("/bayar/{token}", response_class=HTMLResponse, include_in_schema=False)
def halaman_bayar(token: str) -> HTMLResponse:
    """Halaman yang terbuka saat HP memindai QR simulasi."""
    with Session(mesin()) as sesi:
        q = sesi.exec(select(PembayaranQr).where(PembayaranQr.token == token)).first()
        if q is None:
            return HTMLResponse("<!doctype html><meta charset=utf-8><p>Tagihan simulasi ini tidak dikenal.</p>", status_code=404)
        u = sesi.get(Usaha, q.usaha_id)
        isi = _HALAMAN_BAYAR.format(usaha=html.escape(u.nama if u else "Turnify Flow"), jumlah=html.escape(_rupiah(q.jumlah)))
        return HTMLResponse(isi, headers={"Cache-Control": "no-store"})


@rute_publik.post("/bayar/{token}/lunas")
def bayar_lunas(token: str) -> dict:
    """Dipanggil halaman pindai. Menandai lunas sekali; tagihan kedaluwarsa ditolak dengan 410."""
    with Session(mesin()) as sesi:
        q = sesi.exec(select(PembayaranQr).where(PembayaranQr.token == token)).first()
        if q is None:
            raise HTTPException(404, "Tagihan simulasi ini tidak dikenal.")
        _lunaskan(sesi, q, "pindai")
        return {"status": "lunas", "jumlah": q.jumlah}
