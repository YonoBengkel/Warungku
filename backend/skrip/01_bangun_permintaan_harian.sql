-- Membangun ulang `permintaan_harian` dari `pergerakan` + `hari_libur_nasional`.
--
-- Tabel ini turunan, bukan sumber. Sumbernya adalah buku besar `pergerakan`
-- dan tabel acuan `hari_libur_nasional`. Skrip ini ada supaya definisi
-- "permintaan" tertulis satu kali di satu tempat, dan supaya siapa pun bisa
-- membuktikan isi tabel turunannya memang berasal dari sumbernya — bukan dari
-- skrip Python yang kebetulan jalan bulan lalu.
--
-- Jalankan:
--   docker exec -i warungku-db psql -U warungku -d warungku_dev \
--     < skrip/01_bangun_permintaan_harian.sql
--
-- Aman diulang: upsert pada kunci unik (usaha_id, barang_id, tanggal).
--
-- BATAS YANG TERSISA. Kolom yang bisa diturunkan dari sumber sekarang ada tiga:
--
--   jumlah       -> bisa: jumlahan baris 'terjual'.
--   pekan_gajian -> bisa: aritmetika tanggal murni.
--   hari_libur   -> bisa, SEJAK kalender SKB masuk tabel `hari_libur_nasional`.
--                   Sebelumnya kalender hanya hidup di `dataset/pola.py`,
--                   sehingga hanya Python yang bisa mengisinya.
--
-- Dua yang masih belum bisa, dan sengaja TIDAK disentuh:
--
--   stok_habis   -> hari kehabisan stok tidak punya baris penjualan sama
--                   sekali, jadi tidak ada yang bisa dijumlahkan. Hanya
--                   pembangkit dataset dan API (yang tahu stok saat itu) yang
--                   berhak mengisinya.
--   ramadan      -> penanggalan Hijriah bergantung rukyat; SKB hanya menyebut
--                   Idulfitri. Rentang Ramadan diturunkan di
--                   `dataset/kalender.py`, bukan dikutip, jadi ia tidak boleh
--                   berlagak sebagai fakta di dalam SQL.
--   promo_aktif  -> asalnya tabel `promo`, bukan buku besar.
--
-- Kolom yang tidak disentuh DIBIARKAN APA ADANYA pada baris yang sudah ada.
-- Kalau skrip ini menimpanya dengan `false`, menjalankan skrip pemeliharaan
-- akan menghapus penanda kehabisan stok — dan model mulai belajar bahwa barang
-- paling laris adalah barang yang tidak laku.

BEGIN;

-- Tanggal dihitung di CTE lebih dulu. Memanggil `(waktu AT TIME ZONE 'UTC')`
-- langsung di dalam subkueri EXISTS membuat Postgres menolak dengan
-- "subquery uses ungrouped column" — kolom mentahnya tidak ada di GROUP BY.
WITH terjual AS (
    SELECT pg.usaha_id,
           pg.barang_id,
           (pg.waktu AT TIME ZONE 'UTC')::date AS tanggal,
           pg.jumlah
      FROM pergerakan pg
      JOIN barang b ON b.id = pg.barang_id
     WHERE pg.jenis = 'terjual'
       -- Barang yang dicatat manual tidak pernah masuk data model: angkanya
       -- tidak datang dari kasir, jadi tidak bisa dipercaya sebagai deret waktu.
       AND b.dicatat_manual = false
), harian AS (
    SELECT usaha_id, barang_id, tanggal,
           -- `jumlah` di pergerakan bertanda: terjual negatif, permintaan positif.
           SUM(-jumlah) AS jumlah
      FROM terjual
     GROUP BY 1, 2, 3
)
INSERT INTO permintaan_harian (usaha_id, barang_id, tanggal, jumlah, pekan_gajian, hari_libur)
SELECT h.usaha_id,
       h.barang_id,
       h.tanggal,
       h.jumlah,
       (EXTRACT(DAY FROM h.tanggal) >= 25 OR EXTRACT(DAY FROM h.tanggal) <= 5),
       -- Cuti bersama ikut dihitung libur: bagi warung, hari orang tidak
       -- bekerja adalah hari orang jajan.
       (l.tanggal IS NOT NULL)
  FROM harian h
  LEFT JOIN hari_libur_nasional l ON l.tanggal = h.tanggal
ON CONFLICT (usaha_id, barang_id, tanggal) DO UPDATE
SET jumlah       = EXCLUDED.jumlah,
    pekan_gajian = EXCLUDED.pekan_gajian,
    hari_libur   = EXCLUDED.hari_libur;

COMMIT;
