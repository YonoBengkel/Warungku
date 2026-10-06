"""Mesin koneksi dan sesi."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine
from sqlmodel import Session, create_engine

from .konfigurasi import alamat_basis_data

_mesin: Engine | None = None


def mesin() -> Engine:
    global _mesin
    if _mesin is None:
        _mesin = create_engine(
            alamat_basis_data(),
            echo=False,
            pool_pre_ping=True,
        )
    return _mesin


def sesi() -> Session:
    return Session(mesin())


@contextmanager
def sesi_tertutup() -> Iterator[Session]:
    """
    Sesi yang menutup dirinya sendiri dan membatalkan seluruh perubahan kalau
    terjadi galat di tengah jalan.

    Ini yang menjaga aksi berlapis tetap utuh: `terimaBarang` menyentuh stok,
    pergerakan, kuota kontrak, dan notifikasi sekaligus. Kalau salah satunya
    gagal dan yang lain telanjur tersimpan, stok bertambah tapi kuota kontrak
    tidak — dan itu tidak akan ketahuan sampai akhir bulan.
    """
    s = sesi()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
