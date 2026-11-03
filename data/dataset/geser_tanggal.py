"""
Geser tanggal data simulasi maju supaya berakhir paling lambat kemarin (revisi V8, Q180).

    python -m dataset.geser_tanggal                      # sampai kemarin (WIB)
    python -m dataset.geser_tanggal --sampai 2026-11-09
    python -m dataset.geser_tanggal --coba               # hitung saja, lalu batalkan

Data simulasi dibangkitkan berakhir 5 Okt 2026 (`buat_dataset.AKHIR`). Tanpa geseran,
Ringkasan Penjualan dan Prediksi tampak berhenti sebulan sebelum hari ini. Skrip ini
menggeser semua tanggal data simulasi maju kelipatan 7 hari, jadi pola hari tetap
(Sabtu tetap Sabtu) dan angka model tetap sama persis: yang pindah hanya tanggalnya.
Akibatnya data berakhir antara kemarin dan enam hari sebelumnya. `siapkan.cmd` dan
`nyalakan.cmd` menjalankannya setiap kali menyala. Kalau belum genap seminggu sejak
geseran terakhir, tidak ada yang berubah.

Yang digeser, dalam satu transaksi:

* nota simulasi (`transaksi` bernomor `YYYYMMDD-UUU-NNN`), termasuk tanggal di nomornya;
* `permintaan_harian` wilayah simulasi (barang simulasi, sampai akhir data). Bagian
  yang berasal dari nota sungguhan (Portal POS, nota demo yang sudah diproses)
  dipisahkan dulu dan tetap di tanggalnya;
* `pergerakan`, `produksi`, `penjualan`, dan `pembeli` buatan pembangkit, yaitu id yang
  dicatat pada geseran pertama di `geseran_tanggal.id_simulasi` (termasuk koreksi stok
  variasi demo yang bertanggal akhir data);
* pesanan simulasi beserta jejak, ulasan, dan fitur Mesin 2-nya, termasuk tanggal di
  nomornya. Waktu kejadiannya (dibuat, sampai, jejak, ulasan) tidak melewati sekarang;
* keluaran Mesin 1 (`prediksi`) dari jalan yang berpangkal di akhir data simulasi;
* `data_kasir.terakhir_masuk` dan `penawaran.stok_diperbarui_pada` yang masih bernilai
  stempel waktu simulasi.

Yang tidak digeser: semua yang dibuat sungguhan (nota Portal POS, pesanan dan kontrak
lewat layar, shift kas, QR), variasi demo yang tanggalnya relatif terhadap hari ini
(pesanan V/W, kontrak, promo, nota DEMO-), keluaran Mesin 2 dan 3 (dihitung ulang tiap
empat jam), dan kalender libur. Lonjakan musiman seperti Lebaran ikut bergeser beberapa
minggu dari tanggal liburnya.
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import text

from warungku.basis_data import mesin

from .buat_dataset import AKHIR
from .kalender import hari_libur, sedang_ramadan
from .pola import pekan_gajian

WIB = timezone(timedelta(hours=7))
#: Nota simulasi bernomor tanggal-usaha-urutan, mis. 20261005-070-034. Nota Portal POS
#: (POS-), nota demo (DEMO-), dan nota uji tidak pernah berbentuk begini.
POLA_NOTA = r"^[0-9]{8}-[0-9]{3}-[0-9]+$"
#: Panjang ramalan Mesin 1, sama dengan `ml.data.CAKRAWALA` (ml tidak diimpor di sini
#: supaya skrip ini tidak butuh pandas).
CAKRAWALA = 30

#: Baris buatan pembangkit pada geseran pertama: semua yang bertanggal sampai akhir data
#: asli. Baris sungguhan selalu lebih baru dari itu. Untuk `permintaan_harian` yang dicatat
#: adalah id barangnya, karena setiap deret simulasi menutup seluruh rentang simulasi.
SARINGAN_AWAL = {
    "pergerakan": "SELECT id FROM pergerakan WHERE transaksi_id IS NULL AND waktu < :batas",
    "produksi": "SELECT id FROM produksi WHERE waktu < :batas",
    "penjualan": "SELECT id FROM penjualan WHERE waktu < :batas",
    "pembeli": "SELECT id FROM pembeli WHERE dibuat_pada < :batas",
    "pesanan": "SELECT id FROM pesanan WHERE dibuat_pada < :batas AND nomor !~ '-[VW][0-9]'",
    "permintaan_harian": "SELECT DISTINCT barang_id FROM permintaan_harian WHERE tanggal <= :akhir",
}


def _ada_tabel(kon) -> bool:
    return bool(kon.execute(text("SELECT to_regclass('geseran_tanggal') IS NOT NULL")).scalar())


def akhir_data(kon) -> date:
    """Tanggal terakhir data simulasi sekarang. Basis data yang belum pernah digeser: AKHIR."""
    if not _ada_tabel(kon):
        return AKHIR
    return kon.execute(text("SELECT akhir_data FROM geseran_tanggal WHERE id = 1")).scalar() or AKHIR


def id_simulasi(kon, tabel: str) -> str | None:
    """Id baris simulasi `tabel` (teks int8multirange), atau None kalau data belum pernah digeser."""
    if not _ada_tabel(kon):
        return None
    return kon.execute(text("SELECT id_simulasi ->> :t FROM geseran_tanggal WHERE id = 1"), {"t": tabel}).scalar()


def _batas(t: date) -> datetime:
    """Awal hari sesudah `t` dalam stempel waktu simulasi, yang menyimpan jam setempat sebagai UTC."""
    return datetime.combine(t + timedelta(days=1), time(0, 0), tzinfo=timezone.utc)


def _kalender(t: date) -> dict:
    """Kovariat baris permintaan, dengan aturan yang sama dengan `api.gudang.terima_struk`."""
    return {"l": hari_libur(t), "g": pekan_gajian(t), "r": sedang_ramadan(t)}


def _id_simulasi_awal(kon, akhir: date) -> dict[str, str]:
    p = {"batas": _batas(akhir), "akhir": akhir}
    return {
        tabel: kon.execute(
            text(f"SELECT coalesce(range_agg(int8range(id, id, '[]'))::text, '{{}}') FROM ({kueri}) s(id)"), p
        ).scalar_one()
        for tabel, kueri in SARINGAN_AWAL.items()
    }


def _ubah(kon, kueri: str, p: dict) -> int:
    return kon.execute(text(kueri), p).rowcount


def _permintaan(kon, p: dict, akhir_baru: date) -> int:
    """
    Pindahkan wilayah simulasi `permintaan_harian`. Bagian nota sungguhan dipisah dulu,
    lalu dikembalikan ke tanggalnya. Hari bolong di antara akhir data baru dan baris
    sungguhan sesudahnya dibiarkan bolong: Mesin 1 melengkapinya sendiri saat memuat
    deret (`ml.data._isi_bolong`), jadi tabel ini hanya berisi yang benar-benar tercatat.
    """
    kon.execute(
        text(
            """
            CREATE TEMP TABLE ph_nyata ON COMMIT DROP AS
            SELECT p.usaha_id, p.barang_id, (p.waktu AT TIME ZONE 'UTC')::date AS tanggal,
                   sum(-p.jumlah) AS jumlah
              FROM pergerakan p JOIN transaksi t ON t.id = p.transaksi_id
             WHERE p.jenis = 'terjual' AND NOT t.dibatalkan AND t.nomor_struk !~ :pola
             GROUP BY 1, 2, 3
            """
        ),
        p,
    )
    wilayah = "barang_id::int8 <@ CAST(:r_ph AS int8multirange) AND tanggal <= :akhir"
    kon.execute(
        text(
            """
            CREATE TEMP TABLE ph_sim ON COMMIT DROP AS
            SELECT ph.usaha_id, ph.barang_id, ph.tanggal + :h AS tanggal,
                   GREATEST(ph.jumlah - coalesce(n.jumlah, 0), 0) AS jumlah,
                   ph.stok_habis, ph.hari_libur, ph.pekan_gajian, ph.ramadan, ph.promo_aktif
              FROM permintaan_harian ph
              LEFT JOIN ph_nyata n
                ON n.usaha_id = ph.usaha_id AND n.barang_id = ph.barang_id AND n.tanggal = ph.tanggal
             WHERE ph.barang_id::int8 <@ CAST(:r_ph AS int8multirange) AND ph.tanggal <= :akhir
            """
        ),
        p,
    )
    n = _ubah(kon, f"DELETE FROM permintaan_harian WHERE {wilayah}", p)
    # Baris tanpa bagian nota sungguhan di tanggal yang kini ditutup data simulasi, mis.
    # isian hari bolong (nol berstatus stok habis) yang ditulis backend 0.14.0 dan 0.14.1.
    _ubah(
        kon,
        """
        DELETE FROM permintaan_harian ph
         WHERE barang_id::int8 <@ CAST(:r_ph AS int8multirange) AND tanggal > :akhir AND tanggal <= :akhir_baru
           AND NOT EXISTS (SELECT 1 FROM ph_nyata n
                            WHERE n.usaha_id = ph.usaha_id AND n.barang_id = ph.barang_id AND n.tanggal = ph.tanggal)
        """,
        p | {"akhir_baru": akhir_baru},
    )
    sisipkan = """
        INSERT INTO permintaan_harian
            (usaha_id, barang_id, tanggal, jumlah, stok_habis, hari_libur, pekan_gajian, ramadan, promo_aktif)
        VALUES (:u, :b, :t, :n, false, :l, :g, :r, false)
        ON CONFLICT (usaha_id, barang_id, tanggal) DO NOTHING
    """
    nyata = kon.execute(
        text(f"SELECT usaha_id, barang_id, tanggal, jumlah FROM ph_nyata WHERE {wilayah}"), p
    ).all()
    for u, b, t, jml in nyata:
        kon.execute(text(sisipkan), {"u": u, "b": b, "t": t, "n": jml, **_kalender(t)})
    kon.execute(
        text(
            """
            INSERT INTO permintaan_harian
                (usaha_id, barang_id, tanggal, jumlah, stok_habis, hari_libur, pekan_gajian, ramadan, promo_aktif)
            SELECT usaha_id, barang_id, tanggal, jumlah, stok_habis, hari_libur, pekan_gajian, ramadan, promo_aktif
              FROM ph_sim
            ON CONFLICT (usaha_id, barang_id, tanggal) DO UPDATE
               SET jumlah = permintaan_harian.jumlah + EXCLUDED.jumlah,
                   stok_habis = permintaan_harian.stok_habis OR EXCLUDED.stok_habis,
                   hari_libur = EXCLUDED.hari_libur, pekan_gajian = EXCLUDED.pekan_gajian,
                   ramadan = EXCLUDED.ramadan, promo_aktif = EXCLUDED.promo_aktif
            """
        )
    )
    # Dibuang sekarang, bukan menunggu commit, supaya geseran berikutnya di transaksi yang sama bisa jalan.
    kon.execute(text("DROP TABLE ph_nyata, ph_sim"))
    return n


def geser(kon, sampai: date) -> dict:
    """
    Geser data simulasi supaya berakhir paling lambat `sampai`, dalam transaksi `kon`
    (tidak di-commit di sini). Mengembalikan ringkasan; `hari` 0 berarti tidak ada yang berubah.
    """
    if not _ada_tabel(kon):
        raise RuntimeError("Tabel geseran_tanggal belum ada. Naikkan skema dulu: alembic upgrade head.")
    akhir = akhir_data(kon)
    baris = kon.execute(text("SELECT id_simulasi FROM geseran_tanggal WHERE id = 1")).scalar()
    if baris is None:
        # Geseran pertama: pakai akhir nota simulasi yang sebenarnya, bukan hanya AKHIR,
        # kalau basis datanya dibangkitkan dengan akhir yang lain.
        akhir = kon.execute(
            text("SELECT max((waktu AT TIME ZONE 'UTC')::date) FROM transaksi WHERE nomor_struk ~ :pola"),
            {"pola": POLA_NOTA},
        ).scalar() or akhir
    hari = (sampai - akhir).days // 7 * 7
    if hari <= 0:
        return {"hari": 0, "akhir": akhir}
    ids = baris or _id_simulasi_awal(kon, akhir)
    akhir_baru = akhir + timedelta(days=hari)
    kini = datetime.now(timezone.utc)
    p = {
        "h": hari, "iv": timedelta(days=hari), "akhir": akhir, "kini": kini, "pola": POLA_NOTA,
        **{f"r_{k}": ids[k] for k in ("pergerakan", "produksi", "penjualan", "pembeli", "pesanan")},
        "r_ph": ids["permintaan_harian"],
    }
    hasil: dict = {"hari": hari, "akhir_lama": akhir, "akhir": akhir_baru}

    # Nomor nota memuat tanggalnya. Kendala unik dilepas sebentar, karena nomor yang
    # digeser bisa sama dengan nomor lain yang belum digeser di pernyataan yang sama.
    kon.execute(text("ALTER TABLE transaksi DROP CONSTRAINT uq_transaksi_struk"))
    hasil["transaksi"] = _ubah(
        kon,
        """
        UPDATE transaksi
           SET waktu = waktu + :iv, diproses_pada = diproses_pada + :iv,
               nomor_struk = to_char(to_date(left(nomor_struk, 8), 'YYYYMMDD') + :h, 'YYYYMMDD')
                             || substr(nomor_struk, 9)
         WHERE nomor_struk ~ :pola
        """,
        p,
    )
    kon.execute(text("ALTER TABLE transaksi ADD CONSTRAINT uq_transaksi_struk UNIQUE (usaha_id, nomor_struk)"))

    hasil["permintaan_harian"] = _permintaan(kon, p, akhir_baru)

    dalam = "id::int8 <@ CAST(:r_{} AS int8multirange)"
    hasil["pergerakan"] = _ubah(kon, f"UPDATE pergerakan SET waktu = waktu + :iv WHERE {dalam.format('pergerakan')}", p)
    hasil["produksi"] = _ubah(
        kon, f"UPDATE produksi SET waktu = waktu + :iv, dibuat_pada = dibuat_pada + :iv WHERE {dalam.format('produksi')}", p
    )
    hasil["penjualan"] = _ubah(
        kon, f"UPDATE penjualan SET waktu = waktu + :iv, dibuat_pada = dibuat_pada + :iv WHERE {dalam.format('penjualan')}", p
    )
    _ubah(kon, f"UPDATE pembeli SET sejak = sejak + :h WHERE {dalam.format('pembeli')}", p)

    kon.execute(text("ALTER TABLE pesanan DROP CONSTRAINT uq_pesanan_nomor"))
    hasil["pesanan"] = _ubah(
        kon,
        f"""
        UPDATE pesanan
           SET dibuat_pada = LEAST(dibuat_pada + :iv, :kini),
               perkiraan_tiba = perkiraan_tiba + :iv,
               kirim_waktu_sampai = LEAST(kirim_waktu_sampai + :iv, :kini),
               nomor = CASE WHEN nomor ~ '^PS-[0-9]{{6}}-'
                            THEN 'PS-' || to_char(to_date(substr(nomor, 4, 6), 'YYMMDD') + :h, 'YYMMDD') || substr(nomor, 10)
                            ELSE nomor END
         WHERE {dalam.format('pesanan')}
        """,
        p,
    )
    kon.execute(text("ALTER TABLE pesanan ADD CONSTRAINT uq_pesanan_nomor UNIQUE (nomor)"))
    milik_pesanan = "pesanan_id::int8 <@ CAST(:r_pesanan AS int8multirange)"
    _ubah(kon, f"UPDATE pesanan_jejak SET waktu = LEAST(waktu + :iv, :kini) WHERE {milik_pesanan}", p)
    _ubah(kon, f"UPDATE ulasan SET waktu = LEAST(waktu + :iv, :kini) WHERE {milik_pesanan}", p)
    _ubah(kon, f"UPDATE fitur_pesanan SET tanggal = tanggal + :h WHERE {milik_pesanan}", p)

    # Jalan Mesin 1 yang berpangkal di akhir data simulasi. Jalan yang berpangkal di nota
    # sungguhan sesudahnya sudah bertanggal benar.
    kon.execute(text("ALTER TABLE prediksi DROP CONSTRAINT uq_prediksi"))
    hasil["prediksi"] = _ubah(
        kon,
        """
        UPDATE prediksi SET tanggal_target = tanggal_target + :h
         WHERE jalan_id IN (SELECT jalan_id FROM prediksi GROUP BY jalan_id
                             HAVING max(tanggal_target) <= CAST(:akhir AS date) + :cakrawala)
        """,
        p | {"cakrawala": CAKRAWALA},
    )
    kon.execute(text("ALTER TABLE prediksi ADD CONSTRAINT uq_prediksi UNIQUE (barang_id, tanggal_target, jalan_id)"))

    # Stempel waktu simulasi (buat_dataset: hari terakhir pukul 21.00 dan 07.30) yang belum
    # ditimpa kasir atau distributor sungguhan.
    _ubah(
        kon,
        "UPDATE data_kasir SET terakhir_masuk = terakhir_masuk + :iv WHERE terakhir_masuk = :s",
        p | {"s": datetime.combine(akhir, time(21, 0), tzinfo=timezone.utc)},
    )
    _ubah(
        kon,
        "UPDATE penawaran SET stok_diperbarui_pada = stok_diperbarui_pada + :iv WHERE stok_diperbarui_pada = :s",
        p | {"s": datetime.combine(akhir, time(7, 30), tzinfo=timezone.utc)},
    )

    kon.execute(
        text(
            """
            INSERT INTO geseran_tanggal (id, hari, akhir_data, id_simulasi, diperbarui_pada)
            VALUES (1, :h, :akhir_baru, CAST(:ids AS jsonb), :kini)
            ON CONFLICT (id) DO UPDATE
               SET hari = geseran_tanggal.hari + EXCLUDED.hari, akhir_data = EXCLUDED.akhir_data,
                   diperbarui_pada = EXCLUDED.diperbarui_pada
            """
        ),
        {"h": hari, "akhir_baru": akhir_baru, "ids": json.dumps(ids), "kini": kini},
    )
    return hasil


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip(), formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sampai", type=date.fromisoformat, help="tanggal terakhir yang boleh (bawaan: kemarin, WIB)")
    ap.add_argument("--coba", action="store_true", help="hitung dan tampilkan, lalu batalkan semua perubahan")
    arg = ap.parse_args()
    sampai = arg.sampai or datetime.now(WIB).date() - timedelta(days=1)

    with mesin().connect() as kon:
        trans = kon.begin()
        hasil = geser(kon, sampai)
        if arg.coba:
            trans.rollback()
        else:
            trans.commit()

    if not hasil["hari"]:
        print(f"Data simulasi masih segar: berakhir {hasil['akhir']}, paling lambat {sampai}.")
        return
    awal = "Coba geser (dibatalkan)" if arg.coba else "Data simulasi digeser"
    print(f"{awal} {hasil['hari']} hari: berakhir {hasil['akhir_lama']} -> {hasil['akhir']}.")
    print("  " + ", ".join(f"{k} {v}" for k, v in hasil.items() if k not in ("hari", "akhir_lama", "akhir")))


if __name__ == "__main__":
    main()
