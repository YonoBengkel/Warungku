-- Tiga pemeriksaan yang harus lulus sebelum dataset dipakai melatih apa pun.
--
-- Semuanya mengembalikan 0. Angka selain 0 berarti ada yang bohong, dan lebih
-- baik tahu sekarang daripada saat angka laporan tidak bisa dijelaskan.
--
-- Jalankan:
--   psql postgresql://warungku:warungku@localhost:5433/warungku_dev \
--        -f skrip/02_periksa_konsistensi.sql

\echo '1. permintaan_harian harus sama dengan hasil jumlahan pergerakan'
WITH dari_ledger AS (
    SELECT pg.usaha_id, pg.barang_id,
           (pg.waktu AT TIME ZONE 'UTC')::date AS tanggal,
           SUM(-pg.jumlah) AS jumlah
      FROM pergerakan pg
      JOIN barang b ON b.id = pg.barang_id
     WHERE pg.jenis = 'terjual' AND b.dicatat_manual = false
     GROUP BY 1, 2, 3
)
SELECT COUNT(*) AS baris_tidak_cocok
  FROM permintaan_harian ph
  FULL OUTER JOIN dari_ledger dl
    ON dl.usaha_id = ph.usaha_id
   AND dl.barang_id = ph.barang_id
   AND dl.tanggal = ph.tanggal
 WHERE ph.id IS NULL
    OR (dl.jumlah IS NULL AND ph.jumlah <> 0)
    OR ABS(COALESCE(dl.jumlah, 0) - ph.jumlah) > 0.001;

\echo '2. barang.stok harus sama dengan saldo akhir buku besar'
-- `barang.stok` adalah nilai berjalan: ia ada supaya layar tidak perlu
-- menjumlah ribuan baris tiap kali dibuka. Nilai berjalan hanya boleh ada
-- kalau ada yang menjaganya. Pemeriksaan inilah penjaganya.
WITH kumulatif AS (
    SELECT barang_id, SUM(jumlah) AS total FROM pergerakan GROUP BY 1
)
SELECT COUNT(*) AS barang_tidak_cocok
  FROM barang b JOIN kumulatif k ON k.barang_id = b.id
 WHERE ABS(k.total - b.stok) > 0.01;

\echo '3. fitur Mesin 2 tidak boleh memuat masa depan'
-- Tanggal fitur harus sama dengan tanggal pesanan dibuat. Kalau fitur dihitung
-- dari keadaan hari ini, model ikut melihat rating yang justru TERBENTUK oleh
-- pesanan ini — akurasinya naik, dan angkanya bohong.
SELECT COUNT(*) AS baris_menyimpang
  FROM fitur_pesanan f JOIN pesanan p ON p.id = f.pesanan_id
 WHERE f.tanggal <> (p.dibuat_pada AT TIME ZONE 'UTC')::date;

\echo '4. setiap baris pesanan harus menunjuk penawaran milik distributor pesanan itu'
SELECT COUNT(*) AS baris_salah_distributor
  FROM pesanan_baris pb
  JOIN pesanan ps ON ps.id = pb.pesanan_id
  JOIN penawaran pn ON pn.id = pb.penawaran_id
 WHERE pn.distributor_id <> ps.distributor_id;
