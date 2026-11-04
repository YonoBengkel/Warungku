"""
Batas aman dari keluaran Mesin 1.

Aturan yang sama dengan Skenario 1 di simulasi laporan: batas aman satu barang adalah
jumlah p90 harian selama lama kirimnya, dibulatkan ke atas. Kalau stok ditambah barang
yang sedang dipesan turun di bawah angka ini, saatnya memesan lagi.

Dipisah dari `ml/` karena dua pihak memakainya: Mesin 1 sesudah menulis perkiraan, dan
`dataset.variasi_demo` saat aplikasi disiapkan. Yang kedua menjaga angka di layar benar
sesudah basis data dipulihkan dari image, tanpa menunggu jadwal Mesin 1 pukul 02.00.
"""

from __future__ import annotations

from sqlalchemy import text

#: Hari persediaan per pesanan, sama dengan simulasi dan pembangkit data.
HARI_PERSEDIAAN = 21

_SEGARKAN = text(
    """
    WITH terbaru AS (
        SELECT DISTINCT ON (barang_id) barang_id, jalan_id
          FROM prediksi
         WHERE (CAST(:u AS integer) IS NULL OR usaha_id = :u)
         ORDER BY barang_id, dijalankan_pada DESC
    ), akhir AS (
        SELECT barang_id, max(tanggal) AS t
          FROM permintaan_harian
         WHERE (CAST(:u AS integer) IS NULL OR usaha_id = :u)
         GROUP BY barang_id
    ), saran AS (
        SELECT b.id, ceil(sum(p.p90)) AS nilai
          FROM barang b
          JOIN akhir a ON a.barang_id = b.id
          JOIN terbaru t ON t.barang_id = b.id
          JOIN prediksi p ON p.barang_id = b.id AND p.jalan_id = t.jalan_id
         WHERE p.tanggal_target > a.t
           AND p.tanggal_target <= a.t + GREATEST(b.hari_kirim, 1)
         GROUP BY b.id, b.hari_kirim
        HAVING count(*) = GREATEST(b.hari_kirim, 1)
    )
    UPDATE barang b
       SET batas_aman_saran = s.nilai,
           batas_aman = CASE WHEN b.sumber_batas_aman = 'sistem' THEN s.nilai ELSE b.batas_aman END
      FROM saran s
     WHERE s.id = b.id AND s.nilai > 0
    """
)


def segarkan_batas_aman(kon, usaha_id: int | None = None) -> int:
    """
    Salin saran batas aman dari perkiraan terbaru tiap barang. Hasilnya banyak barang
    yang diperbarui.

    Angka yang diatur pemilik usaha sendiri tidak ditimpa, hanya sarannya yang ikut
    berubah. Barang yang perkiraannya tidak menutup seluruh lama kirim, atau p90-nya nol,
    dilewati: angka lamanya lebih berguna daripada batas yang terlalu kecil.
    """
    return kon.execute(_SEGARKAN, {"u": usaha_id}).rowcount
