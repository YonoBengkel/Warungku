"""
Alur tulis dari kasir, dan bacaan stok yang menyertainya.

Satu invarian dijaga seluruh berkas ini, dan hanya satu:

    stok barang == jumlah seluruh baris pergerakan barang itu

Setiap penjualan menambah satu baris buku besar DAN memperbarui `barang.stok`,
dalam satu transaksi basis data. Kalau salah satunya gagal, keduanya dibatalkan.
Nilai `stok` yang disimpan itu hanya ada supaya layar tidak perlu menjumlah
ribuan baris tiap kali dibuka — dan nilai berjalan seperti itu hanya boleh ada
kalau ada yang menjaganya. Di sinilah penjaganya, dan
`skrip/02_periksa_konsistensi.sql` adalah yang memeriksa penjaganya bekerja.
"""

from __future__ import annotations

from datetime import timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import text
from sqlmodel import Session, select

from warungku.basis_data import mesin
from warungku.enum import JenisPergerakan
from warungku.model import Barang, Kemasan, PemetaanMenu, PemetaanMenuBahan, Transaksi, TransaksiBaris, Usaha

from .otentikasi import usaha_saya
from .skema import (
    BahanMenu,
    BarangRingkas,
    BarisNota,
    HasilStruk,
    KemasanRingkas,
    MenuBelumDipasangkan,
    MenuJual,
    MenuJualMasuk,
    NotaRingkas,
    PemakaianBulanan,
    PeriodePemakaian,
    PerkiraanRingkas,
    ResepMasuk,
    ResepMenu,
    RingkasanMenuKasir,
    RingkasanSaranDistributor,
    RiwayatHarian,
    SaranDistributor,
    StrukMasuk,
)

rute = APIRouter(prefix="/usaha/{usaha_id}", tags=["gudang"])


def _usaha_atau_404(sesi: Session, usaha_id: int) -> Usaha:
    u = sesi.get(Usaha, usaha_id)
    if u is None:
        raise HTTPException(404, "Usaha tidak ditemukan.")
    return u


def _status(stok: Decimal, batas: Decimal) -> str:
    """Status yang ditampilkan di layar. Ambangnya sama dengan di frontend."""
    if stok <= 0:
        return "habis"
    if stok < batas:
        return "menipis"
    return "aman"


def _harga_per_satuan(harga_kemasan: int, kemasan: list[KemasanRingkas]) -> Decimal:
    """Harga per satuan simpan dari harga kemasan terbesar. Tanpa kemasan, harganya sudah per satuan."""
    if not kemasan or kemasan[-1].isi <= 0:
        return Decimal(harga_kemasan)
    return (Decimal(harga_kemasan) / kemasan[-1].isi).quantize(Decimal("0.0001"))


@rute.get("/barang", response_model=list[BarangRingkas])
def daftar_barang(usaha_id: int = Depends(usaha_saya)) -> list[BarangRingkas]:
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        barang = sesi.exec(
            select(Barang).where(Barang.usaha_id == usaha_id).order_by(Barang.nama)
        ).all()
        kemasan: dict[int, list[KemasanRingkas]] = {}
        for k in sesi.exec(
            select(Kemasan).join(Barang, Barang.id == Kemasan.barang_id)
            .where(Barang.usaha_id == usaha_id).order_by(Kemasan.isi)
        ).all():
            kemasan.setdefault(k.barang_id, []).append(KemasanRingkas(nama=k.nama, isi=k.isi))
        # Rata-rata 28 hari terakhir yang tercatat, tanpa hari tersensor stok habis.
        pakai = dict(
            sesi.exec(
                text(
                    """
                    SELECT barang_id, avg(jumlah) FILTER (WHERE NOT stok_habis)
                      FROM permintaan_harian
                     WHERE usaha_id = :u
                       AND tanggal > (SELECT max(tanggal) FROM permintaan_harian WHERE usaha_id = :u) - 28
                     GROUP BY barang_id
                    """
                ).bindparams(u=usaha_id)
            ).all()
        )
        # Terakhir terpakai per barang, dan hari acuan usaha: data simulasi berhenti
        # sebelum hari ini, jadi "sudah lama tidak terpakai" diukur dari hari
        # terakhir yang tercatat. Kalau diukur dari hari ini, semua barang lambat
        # laun terbaca tidak bergerak.
        terakhir = {
            r[0]: r[1]
            for r in sesi.exec(
                text(
                    """
                    SELECT barang_id, max((waktu AT TIME ZONE 'UTC')::date)
                      FROM pergerakan WHERE usaha_id = :u AND jenis = 'terjual'
                     GROUP BY barang_id
                    """
                ).bindparams(u=usaha_id)
            ).all()
        }
        acuan = sesi.exec(
            text("SELECT max(tanggal) FROM permintaan_harian WHERE usaha_id = :u").bindparams(u=usaha_id)
        ).scalar()
        acuan = max([t for t in [acuan, *terakhir.values()] if t is not None], default=None)
        return [
            BarangRingkas(
                id=b.id,
                nama=b.nama,
                deskripsi=b.deskripsi,
                nama_lain=list(b.nama_lain or []),
                kategori=b.kategori,
                kode_barang=b.kode_barang,
                satuan=b.satuan,
                satuan_tampil=b.satuan_tampil,
                kemasan=kemasan.get(b.id, []),
                stok=b.stok,
                batas_aman=b.batas_aman,
                batas_aman_saran=b.batas_aman_saran,
                sumber_batas_aman=str(getattr(b.sumber_batas_aman, "value", b.sumber_batas_aman)),
                hari_kirim=b.hari_kirim,
                harga_beli_terakhir=b.harga_beli_terakhir,
                harga_beli_per_satuan=_harga_per_satuan(b.harga_beli_terakhir, kemasan.get(b.id, [])),
                pemakaian_harian=Decimal(pakai.get(b.id) or 0).quantize(Decimal("0.001")),
                hari_data_terkumpul=b.hari_data_terkumpul,
                ingatkan_kedaluwarsa=b.ingatkan_kedaluwarsa,
                kedaluwarsa=b.kedaluwarsa,
                terhubung_kasir=b.terhubung_kasir,
                status=_status(b.stok, b.batas_aman),
                dicatat_manual=b.dicatat_manual,
                catatan=b.catatan,
                hari_tanpa_pemakaian=(acuan - terakhir[b.id]).days if b.id in terakhir else None,
            )
            for b in barang
        ]


@rute.get("/barang/{barang_id}/riwayat", response_model=list[RiwayatHarian])
def riwayat_barang(
    barang_id: int = Path(ge=1),
    hari: int = Query(28, ge=1, le=400),
    usaha_id: int = Depends(usaha_saya),
) -> list[RiwayatHarian]:
    """
    Pemakaian harian `hari` hari terakhir yang tercatat, untuk digambar di samping perkiraan.

    Hari tersensor (stok habis) ikut dikirim dan ditandai, tidak dibuang: grafik
    yang diam-diam melompati hari kosong membuat barang terlihat lebih stabil
    daripada kenyataannya.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        b = sesi.get(Barang, barang_id)
        if b is None or b.usaha_id != usaha_id:
            raise HTTPException(404, "Barang tidak ditemukan.")
        baris = sesi.exec(
            text(
                """
                SELECT tanggal, jumlah, stok_habis
                  FROM permintaan_harian
                 WHERE usaha_id = :u AND barang_id = :b
                   AND tanggal > (SELECT max(tanggal) FROM permintaan_harian WHERE barang_id = :b) - :h
                 ORDER BY tanggal
                """
            ).bindparams(u=usaha_id, b=barang_id, h=hari)
        ).all()
        return [RiwayatHarian(**dict(r._mapping)) for r in baris]


@rute.get("/pemakaian-bulanan", response_model=list[PemakaianBulanan])
def pemakaian_bulanan(
    periode: int = Query(12, ge=1, le=13),
    usaha_id: int = Depends(usaha_saya),
) -> list[PemakaianBulanan]:
    """
    Bahan halaman Prediksi: pemakaian tiap barang per 30 hari, lalu perkiraan 30 hari ke depan.

    Sebulan dihitung 30 hari mundur dari hari terakhir yang tercatat, bukan bulan
    kalender: bulan kalender yang baru berjalan lima hari akan terlihat sepi
    padahal datanya saja yang belum lengkap. Hari tersensor stok habis tidak
    dianggap pemakaian nol; pemakaian periode = rata-rata hari tak tersensor x 30.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        riwayat = sesi.exec(
            text(
                """
                WITH akhir AS (SELECT max(tanggal) AS t FROM permintaan_harian WHERE usaha_id = :u)
                SELECT barang_id,
                       floor((akhir.t - tanggal) / 30)::int AS k,
                       min(tanggal) AS awal, max(tanggal) AS ujung,
                       avg(jumlah) FILTER (WHERE NOT stok_habis) AS rata,
                       count(*) FILTER (WHERE NOT stok_habis) AS n
                  FROM permintaan_harian, akhir
                 WHERE usaha_id = :u AND tanggal > akhir.t - 30 * :p
                 GROUP BY barang_id, k
                 ORDER BY barang_id, k DESC
                """
            ).bindparams(u=usaha_id, p=periode)
        ).all()
        depan = sesi.exec(
            text(
                """
                WITH terbaru AS (
                    SELECT DISTINCT ON (barang_id) barang_id, jalan_id
                      FROM prediksi WHERE usaha_id = :u
                     ORDER BY barang_id, dijalankan_pada DESC
                )
                SELECT p.barang_id, sum(p.p10) AS p10, sum(p.p50) AS p50, sum(p.p90) AS p90,
                       max(p.model_nama) AS model_nama, max(p.dijalankan_pada) AS dijalankan_pada
                  FROM prediksi p JOIN terbaru t USING (barang_id, jalan_id)
                 WHERE p.tanggal_target > (SELECT max(tanggal) FROM permintaan_harian h WHERE h.barang_id = p.barang_id)
                   AND p.tanggal_target <= (SELECT max(tanggal) FROM permintaan_harian h WHERE h.barang_id = p.barang_id) + 30
                 GROUP BY p.barang_id
                """
            ).bindparams(u=usaha_id)
        ).all()
        # Uji balik bulanan dari jalan terbaru barang itu: satu baris per periode,
        # tanggal_target = hari pertama periode (lihat ml/layanan.py).
        balik = sesi.exec(
            text(
                """
                WITH terbaru AS (
                    SELECT DISTINCT ON (barang_id) barang_id, jalan_id
                      FROM prediksi WHERE usaha_id = :u
                     ORDER BY barang_id, dijalankan_pada DESC
                )
                SELECT p.barang_id, p.tanggal_target, p.p50
                  FROM prediksi p JOIN terbaru t USING (barang_id, jalan_id)
                 WHERE p.model_versi = 'lightgbm/uji-balik-bulanan'
                """
            ).bindparams(u=usaha_id)
        ).all()
        uji_balik = {(r.barang_id, r.tanggal_target): r.p50 for r in balik}
        perkiraan = {r.barang_id: r for r in depan}
        hasil: dict[int, PemakaianBulanan] = {}
        for r in riwayat:
            h = hasil.setdefault(r.barang_id, PemakaianBulanan(barang_id=r.barang_id, periode=[]))
            tengah = r.awal + (r.ujung - r.awal) / 2
            h.periode.append(
                PeriodePemakaian(
                    tanggal=tengah,
                    jumlah=(Decimal(r.rata) * 30).quantize(Decimal("0.001")) if r.rata is not None else Decimal(0),
                    hari_tercatat=r.n,
                    uji_balik=uji_balik.get((r.barang_id, r.awal)),
                )
            )
        for bid, h in hasil.items():
            f = perkiraan.get(bid)
            if f is not None:
                h.perkiraan_p10, h.perkiraan_p50, h.perkiraan_p90 = f.p10, f.p50, f.p90
                h.model_nama, h.dijalankan_pada = f.model_nama, f.dijalankan_pada
        return list(hasil.values())


@rute.get("/barang/{barang_id}/perkiraan", response_model=list[PerkiraanRingkas])
def perkiraan_barang(barang_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """
    Baca perkiraan terbaru dari tabel. **Tidak** memanggil layanan model.

    Kalau layanan model mati, endpoint ini tetap menjawab — dengan angka
    terakhir yang tersimpan, dan `tingkat_layanan` menyatakan apa adanya bahwa
    angkanya tidak segar. Itu jauh lebih baik daripada halaman yang gagal
    dibuka, dan jauh lebih jujur daripada angka segar palsu.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        baris = sesi.exec(
            text(
                """
                SELECT barang_id, tanggal_target, p10, p50, p90, model_nama,
                       tanggal_target <= (SELECT max(tanggal) FROM permintaan_harian h
                                           WHERE h.barang_id = :b) AS uji_balik,
                       model_versi, dijalankan_pada, kematangan, tingkat_layanan
                  FROM prediksi
                 WHERE usaha_id = :u AND barang_id = :b
                   -- Uji balik bulanan berisi jumlah 30 hari, bukan angka harian.
                   AND model_versi IS DISTINCT FROM 'lightgbm/uji-balik-bulanan'
                   AND jalan_id = (
                       SELECT jalan_id FROM prediksi
                        WHERE barang_id = :b ORDER BY dijalankan_pada DESC LIMIT 1
                   )
                 ORDER BY tanggal_target
                """
            ).bindparams(u=usaha_id, b=barang_id)
        ).all()
        return [PerkiraanRingkas(**dict(r._mapping)) for r in baris]


@rute.get("/barang/{barang_id}/saran", response_model=list[SaranDistributor])
def saran_distributor(barang_id: int = Path(ge=1), usaha_id: int = Depends(usaha_saya)):
    """
    Baca saran distributor dari tabel. **Tidak** memanggil layanan model.

    Baris yang sudah kedaluwarsa tetap dikembalikan, ditandai
    `kedaluwarsa: true`. Menyembunyikannya akan membuat layar kosong tanpa
    penjelasan setiap kali penjadwal terlambat — dan saran dari delapan jam
    lalu jauh lebih berguna daripada tidak ada saran sama sekali, selama
    pemilik warung tahu umurnya.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        baris = sesi.exec(
            text(
                """
                SELECT r.barang_id, r.distributor_id, r.penawaran_id,
                       d.nama AS nama_distributor, r.p_sukses, r.skor, r.alasan, r.segmen,
                       r.model_nama, r.dijalankan_pada, r.kedaluwarsa_pada,
                       (r.kedaluwarsa_pada < now()) AS kedaluwarsa
                  FROM rekomendasi_skor r
                  JOIN distributor d ON d.id = r.distributor_id
                 WHERE r.usaha_id = :u AND r.barang_id = :b
                 ORDER BY r.skor DESC
                """
            ).bindparams(u=usaha_id, b=barang_id)
        ).all()
        return [SaranDistributor(**dict(r._mapping)) for r in baris]


@rute.get("/saran-distributor", response_model=list[RingkasanSaranDistributor])
def ringkasan_saran_distributor(usaha_id: int = Depends(usaha_saya)):
    """
    Saran Mesin 2 untuk semua barang usaha ini, dirangkum per distributor.

    Skor tiap pasangan (barang, distributor) dirata-rata per distributor, dan
    dihitung berapa barang yang menempatkannya di urutan pertama. Urutannya
    mengikuti rata-rata skor. Seperti `/barang/{id}/saran`, yang dibaca hanya
    tabel; layanan model tidak dipanggil, dan saran yang sudah lewat masa
    berlakunya tetap dikirim dengan tanda `kedaluwarsa`.

    Sejak 23 Okt 2026 Mesin 2 menilai semua barang (rincian barang selalu punya
    saran), jadi yang dirangkum di sini hanya barang yang memang perlu dibeli:
    stoknya di bawah dua kali batas aman, aturan yang dulu dipakai Mesin 2
    sendiri. Layar menyebut rangkuman ini "barang yang perlu kamu beli".
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        baris = sesi.exec(
            text(
                """
                WITH r AS (
                    SELECT r.*, rank() OVER (PARTITION BY r.barang_id ORDER BY r.skor DESC) AS urut
                      FROM rekomendasi_skor r
                      JOIN barang bb ON bb.id = r.barang_id
                     WHERE r.usaha_id = :u AND r.barang_id IS NOT NULL
                       AND bb.stok < bb.batas_aman * 2
                )
                SELECT r.distributor_id, d.nama AS nama_distributor,
                       count(*) AS jumlah_barang,
                       count(*) FILTER (WHERE r.urut = 1) AS jumlah_teratas,
                       coalesce(array_agg(b.nama ORDER BY b.nama) FILTER (WHERE r.urut = 1), '{}') AS barang_teratas,
                       avg(r.skor) AS skor_rata,
                       avg(r.p_sukses) AS p_sukses_rata,
                       count(*) FILTER (WHERE r.segmen = 'sangat-layak') AS jumlah_sangat_layak,
                       min(r.model_nama) AS model_nama,
                       max(r.dijalankan_pada) AS dijalankan_pada,
                       bool_and(r.kedaluwarsa_pada < now()) AS kedaluwarsa
                  FROM r
                  JOIN distributor d ON d.id = r.distributor_id
                  JOIN barang b ON b.id = r.barang_id
                 GROUP BY r.distributor_id, d.nama
                 ORDER BY skor_rata DESC, jumlah_barang DESC, d.nama
                """
            ).bindparams(u=usaha_id)
        ).all()
        return [RingkasanSaranDistributor(**dict(r._mapping)) for r in baris]


@rute.post("/transaksi", response_model=HasilStruk)
def terima_struk(struk: StrukMasuk, usaha_id: int = Depends(usaha_saya)) -> HasilStruk:
    """
    Terima satu nota dari kasir. Aman dikirim ulang berapa kali pun.

    Alurnya, dalam satu transaksi basis data:

    1. Nota disimpan. Kalau `nomor_struk` sudah ada, berhenti di sini dan
       jawab `sudah_ada=True` — bukan galat.
    2. Tiap baris nota diterjemahkan dari nama menu ke bahan lewat
       `pemetaan_menu`. Yang tidak dikenali dilaporkan, nota tetap diterima.
    3. Untuk tiap bahan: satu baris `pergerakan` jenis `terjual` ditulis,
       `barang.stok` dikurangi, dan `permintaan_harian` hari itu ditambah.
       Ketiganya atau tidak sama sekali.

    Nota dari kasir adalah fakta yang sudah terjadi, jadi stok tercatat yang
    tidak cukup tidak membuat nota ditolak. Basis data melarang stok negatif
    (`ck_barang_stok_tak_negatif`), maka stok dipotong sampai nol, bahannya
    dilaporkan di `stok_kurang`, dan hari itu ditandai `stok_habis`: permintaan
    yang tidak tercatat utuh diperlakukan model sebagai data tersensor, bukan
    sebagai penjualan kecil. Stok yang habis padahal masih terjual berarti ada
    barang masuk yang belum dicatat.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)

        ada = sesi.exec(
            select(Transaksi).where(
                Transaksi.usaha_id == usaha_id, Transaksi.nomor_struk == struk.nomor_struk
            )
        ).first()
        if ada is not None:
            jumlah = sesi.exec(
                text("SELECT COUNT(*) FROM transaksi_baris WHERE transaksi_id = :t").bindparams(
                    t=ada.id
                )
            ).scalar_one()
            return HasilStruk(
                diterima=True, sudah_ada=True, transaksi_id=ada.id,
                baris_tercatat=int(jumlah), tak_dikenali=[],
            )

        trx = Transaksi(
            usaha_id=usaha_id,
            nomor_struk=struk.nomor_struk,
            waktu=struk.waktu,
            kasir=struk.kasir,
            sumber=struk.sumber,
        )
        sesi.add(trx)
        sesi.flush()  # butuh id-nya untuk menautkan baris

        # Pemetaan menu -> bahan, dibaca sekali untuk seluruh nota.
        peta: dict[str, list[tuple[int, Decimal]]] = {}
        for pm, pb in sesi.exec(
            select(PemetaanMenu, PemetaanMenuBahan)
            .join(PemetaanMenuBahan, PemetaanMenuBahan.pemetaan_id == PemetaanMenu.id)
            .where(PemetaanMenu.usaha_id == usaha_id)
        ).all():
            peta.setdefault(pm.nama_menu.strip().lower(), []).append((pb.barang_id, pb.takaran))

        # Tanggal dan kovariat baris permintaan harian, dengan aturan yang sama
        # dengan pembangkit data: tanggal UTC (seperti pemeriksaan konsistensi 1)
        # dan kalender dari dataset.kalender / dataset.pola.
        from dataset.kalender import hari_libur, sedang_ramadan
        from dataset.pola import pekan_gajian

        waktu = struk.waktu if struk.waktu.tzinfo else struk.waktu.replace(tzinfo=timezone.utc)
        tanggal = waktu.astimezone(timezone.utc).date()
        kalender = {
            "l": hari_libur(tanggal), "g": pekan_gajian(tanggal), "r": sedang_ramadan(tanggal),
        }

        tak_dikenali: list[str] = []
        stok_kurang: list[str] = []
        tercatat = 0
        for baris in struk.baris:
            sesi.add(
                TransaksiBaris(
                    transaksi_id=trx.id,
                    nama_menu=baris.nama_menu,
                    jumlah=baris.jumlah,
                    satuan=baris.satuan,
                    harga_jual_satuan=baris.harga_jual_satuan,
                )
            )
            tercatat += 1

            bahan = peta.get(baris.nama_menu.strip().lower())
            if not bahan:
                tak_dikenali.append(baris.nama_menu)
                continue

            for barang_id, takaran in bahan:
                b = sesi.get(Barang, barang_id)
                if b is None or b.usaha_id != usaha_id:
                    continue
                if b.dicatat_manual:
                    # Barang yang dicatat manual tidak ikut dikurangi kasir:
                    # pemiliknya yang menghitung sendiri, dan mengurangi dari
                    # dua arah akan menghitungnya dua kali.
                    continue
                pakai = Decimal(baris.jumlah) * Decimal(takaran)
                potong = min(pakai, max(Decimal(b.stok), Decimal(0)))
                habis = potong < pakai
                if habis and b.nama not in stok_kurang:
                    stok_kurang.append(b.nama)
                if potong > 0:
                    b.stok = Decimal(b.stok) - potong
                    sesi.add(b)
                    sesi.exec(
                        text(
                            """
                            INSERT INTO pergerakan
                                (usaha_id, barang_id, waktu, jenis, jumlah, stok_sesudah,
                                 keterangan, transaksi_id, oleh)
                            VALUES (:u, :b, :w, :j, :n, :s, :k, :t, :o)
                            """
                        ).bindparams(
                            u=usaha_id, b=barang_id, w=struk.waktu,
                            j=JenisPergerakan.TERJUAL.value, n=-potong, s=b.stok,
                            k="Penjualan dari struk " + struk.nomor_struk,
                            t=trx.id, o=struk.kasir or "Kasir",
                        )
                    )
                sesi.exec(
                    text(
                        """
                        INSERT INTO permintaan_harian
                            (usaha_id, barang_id, tanggal, jumlah, stok_habis,
                             hari_libur, pekan_gajian, ramadan, promo_aktif)
                        VALUES (:u, :b, :t, :n, :h, :l, :g, :r, false)
                        ON CONFLICT (usaha_id, barang_id, tanggal) DO UPDATE
                           SET jumlah = permintaan_harian.jumlah + EXCLUDED.jumlah,
                               stok_habis = permintaan_harian.stok_habis OR EXCLUDED.stok_habis
                        """
                    ).bindparams(u=usaha_id, b=barang_id, t=tanggal, n=potong, h=habis, **kalender)
                )

        sesi.commit()
        return HasilStruk(
            diterima=True, sudah_ada=False, transaksi_id=trx.id,
            baris_tercatat=tercatat, tak_dikenali=tak_dikenali, stok_kurang=stok_kurang,
        )


def _resep_usaha(sesi: Session, usaha_id: int, kunci: str | None = None) -> list[ResepMenu]:
    """Semua resep usaha ini (atau satu menu, kalau `kunci` diisi), urut nama menu."""
    baris = sesi.exec(
        text(
            """
            SELECT pm.nama_menu, b.id AS barang_id, b.nama, b.satuan, pb.takaran
              FROM pemetaan_menu pm
              JOIN pemetaan_menu_bahan pb ON pb.pemetaan_id = pm.id
              JOIN barang b ON b.id = pb.barang_id
             WHERE pm.usaha_id = :u
               AND (CAST(:k AS text) IS NULL OR lower(btrim(pm.nama_menu)) = :k)
             ORDER BY lower(pm.nama_menu), pb.id
            """
        ).bindparams(u=usaha_id, k=kunci)
    ).all()
    per_menu: dict[str, list[BahanMenu]] = {}
    for r in baris:
        per_menu.setdefault(r.nama_menu, []).append(
            BahanMenu(barang_id=r.barang_id, nama=r.nama, satuan=r.satuan, takaran=r.takaran)
        )
    return [
        ResepMenu(
            nama_menu=nama,
            bahan=bahan,
            langsung=len(bahan) == 1
            and bahan[0].takaran == 1
            and bahan[0].nama.strip().lower() == nama.strip().lower(),
        )
        for nama, bahan in per_menu.items()
    ]


@rute.get("/menu-kasir", response_model=RingkasanMenuKasir)
def ringkasan_menu_kasir(usaha_id: int = Depends(usaha_saya)) -> RingkasanMenuKasir:
    """
    Menu dari nota kasir: yang belum punya bahan, dan resep yang sudah ada.

    Menu dikenali tanpa peduli huruf besar-kecil dan spasi di tepi, sama
    seperti saat nota diproses (`terima_struk`). Menu yang belum dipasangkan
    dihitung dari seluruh notanya: tidak satu pun penjualannya memotong stok.
    """
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        belum = sesi.exec(
            text(
                """
                WITH baris AS (
                    SELECT lower(btrim(tb.nama_menu)) AS kunci, tb.nama_menu, tb.jumlah, t.waktu
                      FROM transaksi_baris tb
                      JOIN transaksi t ON t.id = tb.transaksi_id
                     WHERE t.usaha_id = :u AND NOT t.dibatalkan
                ), dipetakan AS (
                    SELECT DISTINCT lower(btrim(pm.nama_menu)) AS kunci
                      FROM pemetaan_menu pm
                      JOIN pemetaan_menu_bahan pb ON pb.pemetaan_id = pm.id
                     WHERE pm.usaha_id = :u
                )
                SELECT max(b.nama_menu) AS nama_menu, sum(b.jumlah) AS jumlah_terjual,
                       min(b.waktu) AS sejak, max(b.waktu) AS terakhir
                  FROM baris b
                 WHERE NOT EXISTS (SELECT 1 FROM dipetakan d WHERE d.kunci = b.kunci)
                 GROUP BY b.kunci
                 ORDER BY sum(b.jumlah) DESC, max(b.nama_menu)
                """
            ).bindparams(u=usaha_id)
        ).all()
        nota = sesi.exec(
            text(
                """
                SELECT max(waktu) AS terakhir,
                       count(*) FILTER (
                           WHERE (waktu AT TIME ZONE 'Asia/Jakarta')::date
                               = (now() AT TIME ZONE 'Asia/Jakarta')::date
                       ) AS hari_ini
                  FROM transaksi
                 WHERE usaha_id = :u AND NOT dibatalkan
                """
            ).bindparams(u=usaha_id)
        ).one()
        return RingkasanMenuKasir(
            belum_dipasangkan=[MenuBelumDipasangkan(**dict(r._mapping)) for r in belum],
            resep=_resep_usaha(sesi, usaha_id),
            nota_terakhir=nota.terakhir,
            nota_hari_ini=int(nota.hari_ini),
        )


def _pemetaan_menu(sesi: Session, usaha_id: int, kunci: str) -> PemetaanMenu | None:
    """Menu dikenali tanpa peduli huruf besar-kecil dan spasi di tepi, sama seperti saat nota diproses."""
    return sesi.exec(
        select(PemetaanMenu).where(PemetaanMenu.usaha_id == usaha_id).where(
            text("lower(btrim(pemetaan_menu.nama_menu)) = :k").bindparams(k=kunci)
        )
    ).first()


def _menu_jual(sesi: Session, usaha_id: int) -> list[MenuJual]:
    baris = sesi.exec(
        text(
            """
            SELECT pm.nama_menu, pm.harga_jual, pm.kategori, pm.aktif,
                   EXISTS (SELECT 1 FROM pemetaan_menu_bahan pb WHERE pb.pemetaan_id = pm.id) AS punya_resep
              FROM pemetaan_menu pm
             WHERE pm.usaha_id = :u AND pm.harga_jual IS NOT NULL
             ORDER BY pm.kategori NULLS LAST, pm.nama_menu
            """
        ).bindparams(u=usaha_id)
    ).all()
    return [MenuJual(**dict(r._mapping)) for r in baris]


@rute.get("/menu-jual", response_model=list[MenuJual])
def daftar_menu_jual(usaha_id: int = Depends(usaha_saya)) -> list[MenuJual]:
    """Menu yang berharga jual. Portal POS memakai yang aktif, Portal UMKM mengatur semuanya."""
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        return _menu_jual(sesi, usaha_id)


@rute.put("/menu-jual", response_model=MenuJual)
def simpan_menu_jual(menu: MenuJualMasuk, usaha_id: int = Depends(usaha_saya)) -> MenuJual:
    """
    Tambah menu POS, atau ubah harga, kategori, dan statusnya.

    Resepnya tidak disentuh: menu tanpa resep tetap boleh dijual, dan notanya
    masuk daftar menu yang perlu dipasangkan. Harga baru hanya berlaku untuk nota
    berikutnya, karena tiap baris nota menyimpan harganya sendiri.
    """
    nama = menu.nama_menu.strip()
    if not nama:
        raise HTTPException(422, "Nama menu belum diisi.")
    kategori = (menu.kategori or "").strip() or None
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        kunci = nama.lower()
        pm = _pemetaan_menu(sesi, usaha_id, kunci) or PemetaanMenu(usaha_id=usaha_id, nama_menu=nama)
        pm.harga_jual = menu.harga_jual
        pm.kategori = kategori
        pm.aktif = menu.aktif
        sesi.add(pm)
        sesi.commit()
        return next(m for m in _menu_jual(sesi, usaha_id) if m.nama_menu.strip().lower() == kunci)


@rute.put("/menu-kasir", response_model=ResepMenu)
def simpan_resep(resep: ResepMasuk, usaha_id: int = Depends(usaha_saya)) -> ResepMenu:
    """
    Pasangkan satu menu ke bahan-bahannya, atau ganti resep yang sudah ada.

    Hanya berlaku untuk nota BERIKUTNYA. Penjualan yang sudah lewat tidak
    ditarik ulang: memotong stok mundur untuk penjualan berminggu-minggu lalu
    akan menimpa hitungan yang mungkin sudah dikoreksi pemiliknya sendiri.
    """
    nama = resep.nama_menu.strip()
    if not nama:
        raise HTTPException(422, "Nama menu belum diisi. Tulis persis seperti di nota kasir, misalnya Kopi Susu.")
    ids = [b.barang_id for b in resep.bahan]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "Ada bahan yang tertulis dua kali. Gabungkan takarannya ke satu baris.")

    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        barang = {
            b.id: b
            for b in sesi.exec(select(Barang).where(Barang.id.in_(ids), Barang.usaha_id == usaha_id)).all()
        }
        if len(barang) != len(ids):
            raise HTTPException(404, "Sebagian bahan tidak ada di gudang usaha ini. Muat ulang daftar stok, lalu coba lagi.")
        manual = [b.nama for b in barang.values() if b.dicatat_manual]
        if manual:
            raise HTTPException(
                422,
                "%s dicatat manual, jadi stoknya tidak dikurangi kasir. Pilih bahan lain, "
                "atau ubah cara catatnya dulu di rincian barang." % ", ".join(manual),
            )

        kunci = nama.lower()
        pm = _pemetaan_menu(sesi, usaha_id, kunci)
        if pm is None:
            pm = PemetaanMenu(usaha_id=usaha_id, nama_menu=nama)
            sesi.add(pm)
            sesi.flush()
        sesi.exec(text("DELETE FROM pemetaan_menu_bahan WHERE pemetaan_id = :p").bindparams(p=pm.id))
        for b in resep.bahan:
            sesi.add(PemetaanMenuBahan(pemetaan_id=pm.id, barang_id=b.barang_id, takaran=b.takaran))
        # Bahan yang kini dipotong kasir berhenti diperingatkan "tidak berkurang otomatis".
        for b in barang.values():
            if not b.terhubung_kasir:
                b.terhubung_kasir = True
                sesi.add(b)
        sesi.commit()
        return _resep_usaha(sesi, usaha_id, kunci)[0]


@rute.get("/transaksi", response_model=list[NotaRingkas])
def nota_terbaru(
    usaha_id: int = Depends(usaha_saya), batas: int = Query(default=10, ge=1, le=50)
) -> list[NotaRingkas]:
    """Nota terbaru apa adanya, untuk dicocokkan pemilik dengan yang tercetak di kasir."""
    with Session(mesin()) as sesi:
        _usaha_atau_404(sesi, usaha_id)
        nota = sesi.exec(
            select(Transaksi)
            .where(Transaksi.usaha_id == usaha_id, Transaksi.dibatalkan == False)  # noqa: E712
            .order_by(Transaksi.waktu.desc(), Transaksi.id.desc())
            .limit(batas)
        ).all()
        if not nota:
            return []
        baris: dict[int, list[BarisNota]] = {}
        for b in sesi.exec(
            select(TransaksiBaris)
            .where(TransaksiBaris.transaksi_id.in_([n.id for n in nota]))
            .order_by(TransaksiBaris.id)
        ).all():
            baris.setdefault(b.transaksi_id, []).append(
                BarisNota(nama_menu=b.nama_menu, jumlah=b.jumlah, satuan=b.satuan)
            )
        return [
            NotaRingkas(id=n.id, nomor_struk=n.nomor_struk, waktu=n.waktu, kasir=n.kasir, baris=baris.get(n.id, []))
            for n in nota
        ]
