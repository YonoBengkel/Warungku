"""
Titik masuk layanan model.

    .venv-ml/Scripts/uvicorn ml.layanan:app --port 8001

Layanan ini **menulis ke tabel**, dan hanya itu. Ia tidak dipanggil saat
halaman dibuka. Portal membaca `prediksi` dan `rekomendasi_skor` lewat API,
jadi kalau layanan ini mati, halaman tetap terbuka dengan angka terakhir yang
tersimpan — dan `tingkat_layanan` pada barisnya menyatakan apa adanya bahwa
angkanya tidak segar.

Pembagian itu bukan soal kerapian arsitektur. Inferensi MOIRAI untuk 260 barang
memakan menit, bukan milidetik. Memanggilnya dari dalam permintaan HTTP berarti
halaman gudang menunggu model selesai — dan pada percobaan pertama yang gagal,
pemilik warung melihat halaman kosong, bukan angka lama yang masih berguna.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

from fastapi import BackgroundTasks, FastAPI
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import text

from warungku.basis_data import mesin
from warungku.enum import KematanganPerkiraan, TingkatLayanan

from . import penjadwal
from .data import CAKRAWALA, MIN_RIWAYAT, muat_deret

@asynccontextmanager
async def daur_hidup(_app: FastAPI):
    """Nyalakan penjadwal saat layanan mulai, matikan saat berhenti."""
    penjadwal.mulai()
    yield
    penjadwal.berhenti()


app = FastAPI(
    title="Turnify Flow — layanan model",
    version="0.1.0",
    description="Menjalankan Mesin 1, 2, dan 3; menulis hasilnya ke tabel.",
    lifespan=daur_hidup,
)

#: Diperbarui saat satu kali jalan selesai, dibaca endpoint /sehat.
_terakhir: dict[str, object] = {}


@app.get("/", include_in_schema=False)
def akar() -> RedirectResponse:
    """Alamat utama tidak punya halaman; arahkan ke dokumentasi interaktif."""
    return RedirectResponse("/docs")


@app.get("/jadwal", tags=["sistem"])
def jadwal() -> dict:
    """
    Apa yang dijadwalkan, kapan berikutnya, hasil terakhirnya.

    Ada supaya "kenapa angkanya basi?" punya jawaban tanpa membuka log.
    """
    return penjadwal.keadaan()


class PermintaanJalan(BaseModel):
    usaha_id: int | None = None
    #: "lightgbm" (bawaan sejak 16 Okt 2026, permintaan dosen pengampu), "sarima"
    #: (bawaan 12–16 Okt), "holt_winters" (ETS, bawaan 10–12 Okt), "chronos",
    #: "moirai", atau nama metode garis dasar lain. LightGBM kuantil di pekan uji:
    #: MAPE pekanan 23,0% vs SARIMA 23,4% pada semua barang, cakupan p10–p90 81,6%
    #: (ml/hasil/hasil_eksperimen_mesin1_lgbm.json).
    metode: str = "lightgbm"
    cakrawala: int = CAKRAWALA
    #: Uji balik bulanan untuk grafik bulanan (sekitar 3,5 menit untuk semua
    #: barang). Matikan untuk jalan cepat, mis. saat mencoba satu usaha.
    uji_bulanan: bool = True


class HasilJalan(BaseModel):
    jalan_id: str
    metode: str
    barang: int
    baris: int
    detik: float


def _kematangan(panjang: int) -> KematanganPerkiraan:
    """
    Seberapa jauh angka ini boleh dipercaya, ditentukan panjang riwayat.

    Kolom ini ada supaya layar bisa berkata "data belum cukup" alih-alih
    menampilkan angka yang kelihatan pasti. Perkiraan dari 20 hari riwayat dan
    dari 400 hari riwayat tampil identik di layar kalau tidak ada penanda ini,
    dan yang pertama akan dipakai mengambil keputusan belanja.

    Dikembalikan anggota enum, bukan teks. Teks lepas di sini sempat membuat
    seluruh penulisan gagal di tingkat Postgres karena nilainya tidak ada di
    tipe enumnya — dan satu-satunya cara mencegahnya terulang adalah tidak
    pernah menulis nilainya dengan tangan.
    """
    if panjang < MIN_RIWAYAT:
        return KematanganPerkiraan.BELUM_BISA
    if panjang < 120:
        return KematanganPerkiraan.KASAR
    return KematanganPerkiraan.MANTAP


#: Uji balik bulanan: berapa blok 30 hari ke belakang, dan riwayat minimum
#: sebelum titik asal supaya fitur lag dan rata-rata 28 hari sudah terisi.
BLOK_UJI_BULANAN = 12
MIN_ASAL_BULANAN = 60
VERSI_UJI_BULANAN = "lightgbm/uji-balik-bulanan"


def _jalankan_mesin1(usaha_id: int | None, metode: str, cakrawala: int, uji_bulanan: bool = True) -> HasilJalan:
    import time

    import numpy as np

    mulai = time.perf_counter()
    jalan_id = uuid.uuid4().hex[:16]
    sekarang = datetime.now(timezone.utc)

    deret = muat_deret()
    if usaha_id is not None:
        deret = [d for d in deret if d.usaha_id == usaha_id]

    if metode.startswith("chronos"):
        from .mesin1.chronos import ramal_banyak

        tugas = [(d, len(d)) for d in deret]
        ramalan = ramal_banyak(tugas, cakrawala) if tugas else []
        nama_model, versi = "amazon/chronos-2", "chronos-forecasting"
    elif metode.startswith("moirai"):
        from .mesin1.moirai import ramal_banyak

        ukuran = metode.split("_", 1)[1] if "_" in metode else "small"
        tugas = [(d, len(d)) for d in deret]
        ramalan = ramal_banyak(tugas, cakrawala, ukuran) if tugas else []
        nama_model, versi = "moirai-1.1-R-%s" % ukuran, "uni2ts"
    elif metode == "lightgbm":
        from .mesin1.lgbm import NAMA_MODEL, ramal_kuantil

        ramalan = ramal_kuantil([(d, len(d)) for d in deret], cakrawala) if deret else []
        nama_model, versi = NAMA_MODEL, "lightgbm"
    elif metode == "sarima":
        from .mesin1.dasar import holt_winters
        from .mesin1.sarima import sarima_kuantil

        # Barang yang gagal dipasangi SARIMA memakai ETS, dan itu tercatat per
        # barang di `model_nama`, bukan disamarkan sebagai SARIMA.
        ramalan, nama_per_barang = [], []
        for d in deret:
            try:
                ramalan.append(sarima_kuantil(d, len(d), cakrawala))
                nama_per_barang.append("sarima-1-0-1-0-1-1-7")
            except Exception:
                ramalan.append(holt_winters(d, len(d), cakrawala))
                nama_per_barang.append("ets-holt-winters (cadangan)")
        nama_model, versi = None, "statsmodels"
    else:
        from .mesin1.dasar import METODE

        f = METODE[metode]
        ramalan = [f(d, len(d), cakrawala) for d in deret]
        if metode == "holt_winters":
            nama_model, versi = "ets-holt-winters", "statsmodels"
        else:
            nama_model, versi = metode, "garis-dasar-0.1"

    if nama_model is not None:
        nama_per_barang = [nama_model] * len(deret)

    baris = []
    for d, r, nama_d in zip(deret, ramalan, nama_per_barang):
        t0 = d.tanggal[-1]
        matang = _kematangan(len(d))
        for i in range(cakrawala):
            baris.append(
                {
                    "usaha_id": d.usaha_id,
                    "barang_id": d.barang_id,
                    "tanggal_target": t0 + timedelta(days=i + 1),
                    "p10": float(np.round(r[0.1][i], 3)),
                    "p50": float(np.round(r[0.5][i], 3)),
                    "p90": float(np.round(r[0.9][i], 3)),
                    "jalan_id": jalan_id,
                    "model_nama": nama_d,
                    "model_versi": versi,
                    "dijalankan_pada": sekarang,
                    "kematangan": matang.value,
                    "tingkat_layanan": TingkatLayanan.SEGAR.value,
                }
            )

    # Uji balik: ramalan 14 hari terakhir yang dibuat seolah-olah dari 14 hari
    # sebelumnya (data sesudah titik itu tidak dilihat model). Disimpan di jalan
    # yang sama dengan tanggal_target <= hari terakhir data; endpoint membedakannya
    # dari ramalan ke depan lewat tanggal. Inilah garis forecast yang tumpang
    # tindih dengan garis aktual di grafik.
    if metode == "lightgbm" and deret:
        from .mesin1.lgbm import ramal_kuantil

        mundur = 14
        tugas_balik = [(d, len(d) - mundur) for d in deret if len(d) > mundur + 35]
        for (d, akhir), r in zip(tugas_balik, ramal_kuantil(tugas_balik, mundur)):
            t0 = d.tanggal[akhir - 1]
            for i in range(mundur):
                baris.append(
                    {
                        "usaha_id": d.usaha_id,
                        "barang_id": d.barang_id,
                        "tanggal_target": t0 + timedelta(days=i + 1),
                        "p10": float(np.round(r[0.1][i], 3)),
                        "p50": float(np.round(r[0.5][i], 3)),
                        "p90": float(np.round(r[0.9][i], 3)),
                        "jalan_id": jalan_id,
                        "model_nama": nama_model,
                        "model_versi": "lightgbm/uji-balik",
                        "dijalankan_pada": sekarang,
                        "kematangan": _kematangan(len(d)).value,
                        "tingkat_layanan": TingkatLayanan.SEGAR.value,
                    }
                )

    # Uji balik bulanan: garis perkiraan masa lalu di grafik bulanan. Untuk tiap
    # blok 30 hari yang sudah lewat (blok yang sama dengan endpoint
    # pemakaian-bulanan: dihitung mundur dari hari terakhir data), model
    # meramal 30 hari dari titik tepat sebelum blok itu, tanpa melihat isi
    # bloknya. Yang disimpan SATU baris per barang per blok: tanggal_target =
    # hari PERTAMA blok (hari terakhir blok paling baru bentrok dengan baris uji
    # balik harian pada kunci unik barang + tanggal + jalan), p50 = jumlah
    # perkiraan 30 hari. Hanya nilai tengah
    # yang dihitung (grafik masa lalu tidak berpita), jadi p10 dan p90 diisi
    # sama dengan p50 dan tidak bermakna. Satu titik asal sekitar 18 detik
    # untuk 898 barang.
    if metode == "lightgbm" and deret and uji_bulanan:
        from .mesin1.lgbm import ramal_kuantil

        for k in range(BLOK_UJI_BULANAN):
            tugas_blok = [
                (d, len(d) - 30 * (k + 1)) for d in deret if len(d) - 30 * (k + 1) >= MIN_ASAL_BULANAN
            ]
            if not tugas_blok:
                break
            for (d, asal), r in zip(tugas_blok, ramal_kuantil(tugas_blok, 30, taraf=(0.5,))):
                jumlah = float(np.round(r[0.5].sum(), 3))
                baris.append(
                    {
                        "usaha_id": d.usaha_id,
                        "barang_id": d.barang_id,
                        "tanggal_target": d.tanggal[asal],
                        "p10": jumlah,
                        "p50": jumlah,
                        "p90": jumlah,
                        "jalan_id": jalan_id,
                        "model_nama": nama_model,
                        "model_versi": VERSI_UJI_BULANAN,
                        "dijalankan_pada": sekarang,
                        "kematangan": _kematangan(asal).value,
                        "tingkat_layanan": TingkatLayanan.SEGAR.value,
                    }
                )

    if baris:
        from warungku.model import Prediksi

        with mesin().begin() as kon:
            # Hasil jalan sebelumnya TIDAK dihapus. `jalan_id` memisahkannya,
            # dan riwayat itulah yang membuat angka di laporan bisa dilacak
            # ulang tiga minggu kemudian saat ada yang bertanya.
            for i in range(0, len(baris), 5000):
                kon.execute(Prediksi.__table__.insert(), baris[i : i + 5000])

    hasil = HasilJalan(
        jalan_id=jalan_id, metode=metode, barang=len(deret),
        baris=len(baris), detik=round(time.perf_counter() - mulai, 2),
    )
    _terakhir["mesin1"] = hasil.model_dump()
    return hasil


@app.post("/mesin1/jalankan", response_model=HasilJalan, tags=["mesin1"])
def mesin1(p: PermintaanJalan) -> HasilJalan:
    """Jalankan Mesin 1 dan tulis ke `prediksi`. Memblokir sampai selesai."""
    return _jalankan_mesin1(p.usaha_id, p.metode, p.cakrawala, p.uji_bulanan)


@app.post("/mesin1/jadwalkan", tags=["mesin1"])
def mesin1_jadwalkan(p: PermintaanJalan, tugas: BackgroundTasks) -> dict:
    """
    Jalankan di latar. Ini jalur yang dipakai penjadwal harian.

    Dengan MOIRAI, satu kali jalan untuk seluruh barang memakan menit — lebih
    lama daripada batas waktu HTTP mana pun yang pantas. Jadi jawabannya
    dikirim segera, dan hasilnya diperiksa lewat `/sehat`.
    """
    tugas.add_task(_jalankan_mesin1, p.usaha_id, p.metode, p.cakrawala, p.uji_bulanan)
    return {"dijadwalkan": True, "metode": p.metode}


class PermintaanSaran(BaseModel):
    #: None berarti seluruh usaha.
    usaha_id: int | None = None
    #: "beta" (bawaan: Beta-Bernoulli + fuzzy), "bart", "logistik", atau "pohon".
    penaksir: str = "beta"
    #: Pencuplikan Thompson untuk eksplorasi. Di produksi ini yang diinginkan —
    #: tanpanya distributor baru tidak pernah terpilih, jadi tidak pernah punya
    #: riwayat, jadi tidak pernah terpilih. Tapi keluarannya jadi TIDAK
    #: deterministik: dua kali jalan memberi urutan berbeda. Itu bukan bug.
    thompson: bool = True


@app.post("/mesin2/jalankan", tags=["mesin2"])
def mesin2(p: PermintaanSaran) -> dict:
    """
    Nilai kandidat distributor untuk satu usaha, tulis ke `rekomendasi_skor`.

    Hanya barang yang memang perlu diisi ulang yang dinilai. Menilai seluruh
    rak setiap kali berarti menulis ratusan baris untuk barang yang stoknya
    masih penuh — dan tiap baris itu akan kedaluwarsa dalam 12 jam tanpa pernah
    dibaca siapa pun.
    """
    from .mesin2.saran import jalankan, jalankan_semua

    # Tanpa usaha_id: seluruh usaha, dengan SATU kali pelatihan. Memanggil
    # jalankan() tujuh puluh kali akan melatih model yang sama tujuh puluh kali.
    if p.usaha_id is None:
        hasil = jalankan_semua(penaksir=p.penaksir, thompson=p.thompson)
    else:
        hasil = jalankan(p.usaha_id, thompson=p.thompson, nama_model=p.penaksir)
    _terakhir["mesin2"] = hasil
    return hasil


@app.post("/mesin3/jalankan", tags=["mesin3"])
def mesin3() -> dict:
    """
    Segmentasi pelanggan tiap distributor, tulis ke `segmen_pelanggan`.

    Dijalankan untuk seluruh distributor sekaligus, bukan per distributor:
    hitungannya ringan (dua detik untuk delapan distributor) dan memisahkannya
    hanya menambah jalur yang harus dijaga tetap sama.
    """
    from .mesin3.segmentasi import jalankan as jalankan_mesin3

    hasil = jalankan_mesin3()
    _terakhir["mesin3"] = {k: v for k, v in hasil.items() if k != "per_distributor"}
    return hasil


@app.get("/sehat", tags=["sistem"])
def sehat() -> dict:
    try:
        with mesin().connect() as kon:
            n_prediksi = kon.execute(text("SELECT COUNT(*) FROM prediksi")).scalar_one()
            n_fitur = kon.execute(text("SELECT COUNT(*) FROM fitur_pesanan")).scalar_one()
            n_skor = kon.execute(text("SELECT COUNT(*) FROM rekomendasi_skor")).scalar_one()
            n_segmen = kon.execute(text("SELECT COUNT(*) FROM segmen_pelanggan")).scalar_one()
            segar = kon.execute(
                text("SELECT MAX(dijalankan_pada) FROM prediksi")
            ).scalar_one()
        basis_data = {
            "terhubung": True,
            "prediksi": int(n_prediksi),
            "fitur_pesanan": int(n_fitur),
            "rekomendasi_skor": int(n_skor),
            "segmen_pelanggan": int(n_segmen),
            "perkiraan_terakhir": segar.isoformat() if segar else None,
        }
    except Exception as e:
        basis_data = {"terhubung": False, "galat": type(e).__name__}

    return {"layanan": "ml", "basis_data": basis_data, "jalan_terakhir": _terakhir}
