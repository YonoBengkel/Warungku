"""
Keadaan keluaran mesin di basis data lokal, untuk `tools/lokal/nyalakan.ps1`.

Mencetak satu baris JSON. Skrip penyala memakainya untuk memutuskan apakah
ketiga mesin perlu dijalankan sekali sesudah semua layanan menyala, misalnya
karena basis datanya baru dipulihkan dari image lama atau UMKM produsen baru
ditambahkan.
"""

from __future__ import annotations

import json

from sqlalchemy import text

from warungku.basis_data import mesin


def main() -> None:
    with mesin().connect() as kon:

        def hitung(sql: str) -> int:
            return int(kon.execute(text(sql)).scalar_one())

        print(
            json.dumps(
                {
                    # Garis perkiraan uji balik di grafik hanya ada sesudah Mesin 1 LightGBM jalan.
                    "uji_balik": hitung("SELECT COUNT(*) FROM prediksi WHERE model_versi = 'lightgbm/uji-balik'"),
                    # Barang yang riwayatnya cukup (>= 60 hari) tapi belum punya perkiraan.
                    "tanpa_perkiraan": hitung(
                        """
                        SELECT COUNT(*) FROM (
                            SELECT h.barang_id FROM permintaan_harian h
                              JOIN barang b ON b.id = h.barang_id
                             WHERE NOT b.dicatat_manual
                             GROUP BY h.barang_id HAVING COUNT(*) >= 60
                        ) x
                        WHERE NOT EXISTS (SELECT 1 FROM prediksi p WHERE p.barang_id = x.barang_id)
                        """
                    ),
                    "saran": hitung("SELECT COUNT(*) FROM rekomendasi_skor"),
                    "segmen": hitung("SELECT COUNT(*) FROM segmen_pelanggan"),
                }
            )
        )


if __name__ == "__main__":
    main()
