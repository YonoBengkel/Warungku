"""
Merapikan deskripsi bawaan barang yang ditulis pembangkit lama.

    python -m dataset.rapikan_deskripsi

Pembangkit sebelum 19 Oktober 2026 menulis "20000 gram per karung": tanpa titik
ribuan dan dalam satuan simpan. Pembangkit sekarang menulis "1 karung = 20 kg"
(`katalog.deskripsi_kemasan`). Skrip ini menulis ulang hanya deskripsi yang
persis berpola lama, jadi deskripsi yang ditulis pemilik usaha sendiri tidak
tersentuh, dan menjalankannya berulang kali aman.
"""

from __future__ import annotations

import re

from sqlalchemy import text

from warungku.basis_data import mesin

from .katalog import deskripsi_kemasan

POLA_LAMA = re.compile(r"^(\d+(?:\.\d+)?) (gram|ml|pcs) per (\S+)$")


def rapikan() -> int:
    n = 0
    with mesin().begin() as kon:
        baris = kon.execute(
            text("SELECT id, deskripsi FROM barang WHERE deskripsi ~ '^[0-9.]+ (gram|ml|pcs) per '")
        ).all()
        for bid, desk in baris:
            m = POLA_LAMA.match(desk)
            if not m:
                continue
            baru = deskripsi_kemasan(float(m.group(1)), m.group(2), m.group(3))
            if baru != desk:
                kon.execute(text("UPDATE barang SET deskripsi = :d WHERE id = :b"), {"d": baru, "b": bid})
                n += 1
    return n


if __name__ == "__main__":
    n = rapikan()
    print(f"Deskripsi dirapikan: {n} barang" if n else "Deskripsi barang sudah rapi")
