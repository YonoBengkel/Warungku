"""
Penjadwal harian untuk ketiga mesin.

Hidup di dalam proses layanan `ml`, bukan sebagai cron terpisah. Alasannya
praktis: tim menjalankan ini di laptop untuk demo, dan cron di kontainer
berarti satu bagian lagi yang harus dinyalakan. Konsekuensinya jujur disebut —
**kalau layanan `ml` mati, penjadwalnya ikut mati.** Untuk pemasangan
sungguhan, pindahkan ke cron atau Task Scheduler dan matikan penjadwal ini
lewat `WARUNGKU_JADWAL=0`.

Jadwalnya:

    02.00 WIB tiap hari   Mesin 1  perkiraan permintaan 30 hari ke depan
    tiap 4 jam            Mesin 2  skor distributor (kedaluwarsa 12 jam)
    tiap 4 jam            Mesin 3  segmentasi pelanggan distributor

Mesin 1 jam dua pagi karena warung sudah tutup dan belum buka — data hari
kemarin sudah lengkap, dan tidak ada yang menunggu. Mesin 2 tiap empat jam
karena skornya berlaku dua belas jam; menyegarkan tiap empat jam berarti tidak
pernah ada yang basi, dengan dua kali cadangan kalau satu kali jalan gagal.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

ZONA = "Asia/Jakarta"

#: Catatan hasil jalan terakhir tiap tugas, dibaca endpoint `/jadwal`.
#: Penjadwal yang tidak bisa ditanyai "kapan terakhir kamu jalan?" adalah
#: penjadwal yang kegagalannya baru ketahuan saat ada yang curiga angkanya basi.
riwayat: dict[str, dict] = {}

_penjadwal: BackgroundScheduler | None = None


def _catat(nama: str, fungsi) -> None:
    mulai = datetime.now(timezone.utc)
    try:
        hasil = fungsi()
        riwayat[nama] = {
            "berhasil": True,
            "mulai": mulai.isoformat(),
            "selesai": datetime.now(timezone.utc).isoformat(),
            "hasil": {k: v for k, v in hasil.items() if k != "per_distributor"}
            if isinstance(hasil, dict)
            else hasil,
        }
    except Exception as e:
        # Kegagalan DICATAT, bukan dilempar. Pengecualian yang lolos dari tugas
        # terjadwal hanya akan tercetak ke log dan hilang; yang tercatat di sini
        # bisa dilihat lewat /jadwal tanpa membuka log.
        riwayat[nama] = {
            "berhasil": False,
            "mulai": mulai.isoformat(),
            "selesai": datetime.now(timezone.utc).isoformat(),
            "galat": "%s: %s" % (type(e).__name__, e),
        }


def _mesin1() -> dict:
    from .layanan import _jalankan_mesin1

    return _jalankan_mesin1(None, os.environ.get("WARUNGKU_METODE_MESIN1", "chronos"), 30).model_dump()


def _mesin2() -> dict:
    from .mesin2.saran import jalankan_semua

    return jalankan_semua(penaksir=os.environ.get("WARUNGKU_PENAKSIR_MESIN2", "beta"))


def _mesin3() -> dict:
    from .mesin3.segmentasi import jalankan

    return jalankan()


def mulai() -> BackgroundScheduler | None:
    """Nyalakan penjadwal. Dipanggil saat layanan `ml` mulai."""
    global _penjadwal
    if os.environ.get("WARUNGKU_JADWAL", "1") == "0":
        return None
    if _penjadwal is not None:
        return _penjadwal

    p = BackgroundScheduler(timezone=ZONA)
    p.add_job(
        lambda: _catat("mesin1", _mesin1),
        CronTrigger(hour=2, minute=0, timezone=ZONA),
        id="mesin1", name="Mesin 1 — perkiraan permintaan",
        # Kalau layanan mati saat jadwalnya lewat, jalankan sekali saat hidup
        # lagi — tapi jangan menumpuk tiga hari yang terlewat sekaligus.
        coalesce=True, misfire_grace_time=3600, max_instances=1,
    )
    p.add_job(
        lambda: _catat("mesin2", _mesin2),
        CronTrigger(hour="0,4,8,12,16,20", minute=10, timezone=ZONA),
        id="mesin2", name="Mesin 2 — skor distributor",
        coalesce=True, misfire_grace_time=1800, max_instances=1,
    )
    p.add_job(
        lambda: _catat("mesin3", _mesin3),
        CronTrigger(hour="0,4,8,12,16,20", minute=25, timezone=ZONA),
        id="mesin3", name="Mesin 3 — segmentasi pelanggan",
        coalesce=True, misfire_grace_time=1800, max_instances=1,
    )
    p.start()
    _penjadwal = p
    return p


def berhenti() -> None:
    global _penjadwal
    if _penjadwal is not None:
        _penjadwal.shutdown(wait=False)
        _penjadwal = None


def keadaan() -> dict:
    """Apa yang dijadwalkan, kapan berikutnya, dan bagaimana hasil terakhirnya."""
    if _penjadwal is None:
        return {"aktif": False, "alasan": "penjadwal dimatikan lewat WARUNGKU_JADWAL=0"}
    tugas = []
    for j in _penjadwal.get_jobs():
        tugas.append(
            {
                "id": j.id,
                "nama": j.name,
                "berikutnya": j.next_run_time.isoformat() if j.next_run_time else None,
                "terakhir": riwayat.get(j.id),
            }
        )
    return {"aktif": True, "zona": ZONA, "tugas": tugas}
