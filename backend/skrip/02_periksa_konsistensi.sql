-- Pemeriksaan yang harus lulus sebelum dataset dipakai melatih apa pun.
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

\echo '5. nota hanya merinci penjualan: jumlahnya sama dengan buku besar per barang per hari'
-- Kueri yang sama dipakai `periksa_turunan` di dataset/buat_dataset.py
-- (SQL_NOTA_VS_BUKU_BESAR); ubah keduanya bersamaan.
WITH dari_nota AS (
    SELECT t.usaha_id, b.id AS barang_id,
           (t.waktu AT TIME ZONE 'UTC')::date AS tanggal,
           SUM(tb.jumlah) AS jumlah
      FROM transaksi_baris tb
      JOIN transaksi t ON t.id = tb.transaksi_id
      JOIN barang b ON b.usaha_id = t.usaha_id AND b.nama = tb.nama_menu
     WHERE NOT t.dibatalkan
       -- Nota yang diproses API memotong stok lewat resep (satu menu, banyak
       -- bahan), jadi tidak cocok dicocokkan per nama. Kebenarannya dijaga
       -- terima_struk dan diuji di backend/uji (test_struk, test_menu_kasir).
       -- Yang diperiksa di sini nota pembangkit simulasi: satu baris, satu barang.
       AND NOT EXISTS (SELECT 1 FROM pergerakan p2 WHERE p2.transaksi_id = t.id)
     GROUP BY 1, 2, 3
), dari_ledger AS (
    SELECT pg.usaha_id, pg.barang_id,
           (pg.waktu AT TIME ZONE 'UTC')::date AS tanggal,
           SUM(-pg.jumlah) AS jumlah
      FROM pergerakan pg
      JOIN barang b ON b.id = pg.barang_id
     -- Bahan baku yang terpakai produksi (UMKM produsen) tidak lewat nota kasir.
     WHERE pg.jenis = 'terjual' AND b.dicatat_manual = false AND pg.produksi_id IS NULL
       AND pg.transaksi_id IS NULL
     GROUP BY 1, 2, 3
)
SELECT COUNT(*) AS barang_hari_tidak_cocok
  FROM dari_nota n
  FULL OUTER JOIN dari_ledger l USING (usaha_id, barang_id, tanggal)
 WHERE ABS(COALESCE(n.jumlah, 0) - COALESCE(l.jumlah, 0)) > 0.001;

\echo '6. setiap nota punya baris, dan setiap baris punya harga jual'
-- Omset dihitung dari harga di nota. Baris tanpa harga membuat omset hari itu
-- terlihat lebih kecil tanpa ada yang tahu.
SELECT (SELECT COUNT(*) FROM transaksi t
         WHERE NOT EXISTS (SELECT 1 FROM transaksi_baris tb WHERE tb.transaksi_id = t.id))
     + (SELECT COUNT(*) FROM transaksi_baris WHERE harga_jual_satuan IS NULL)
       AS nota_cacat;

\echo '7. stok barang jadi harus sama dengan produksi dikurangi penjualan'
-- `produk_jadi.stok` adalah nilai berjalan UMKM produsen, sama seperti
-- `barang.stok`. Penjaganya ada di backend/api/produksi.py.
SELECT COUNT(*) AS produk_jadi_tidak_cocok
  FROM produk_jadi pj
 WHERE ABS(pj.stok
           - COALESCE((SELECT SUM(jumlah) FROM produksi p WHERE p.produk_jadi_id = pj.id), 0)
           + COALESCE((SELECT SUM(jumlah) FROM penjualan_baris pb WHERE pb.produk_jadi_id = pj.id), 0)) > 0.001;
