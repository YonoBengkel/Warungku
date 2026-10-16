"""
Bentuk badan permintaan dan jawaban. Terpisah dari model tabel, dengan sengaja.

Model tabel punya kolom yang tidak boleh sampai ke luar (hash kata sandi) dan
kolom yang tidak diisi klien (`stok_sesudah`, dihitung server). Kalau model
tabel dipakai langsung sebagai skema API, keduanya bocor: yang pertama ke
pembaca, yang kedua ke penulis — dan penulis yang bisa menentukan
`stok_sesudah` sendiri berarti buku besarnya bisa dikarang dari luar.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class BarisStruk(BaseModel):
    nama_menu: str = Field(min_length=1, max_length=120)
    jumlah: Decimal = Field(gt=0)
    satuan: str = Field(min_length=1, max_length=20)
    #: Fakta dari struk. Tidak pernah dipakai menghitung stok.
    harga_jual_satuan: int | None = None


class StrukMasuk(BaseModel):
    """
    Satu nota dari kasir.

    `nomor_struk` adalah **kunci idempotensi**, bukan sekadar keterangan. Kasir
    yang kehilangan jaringan akan mengirim ulang nota yang sama, dan tanpa
    kunci ini stok warung berkurang dua kali untuk satu penjualan. Keunikannya
    dijaga oleh basis data (UNIQUE usaha_id + nomor_struk), bukan oleh
    pemeriksaan di kode — pemeriksaan di kode selalu bisa dilewati dua
    permintaan yang datang bersamaan.
    """

    nomor_struk: str = Field(min_length=1, max_length=60)
    waktu: datetime
    kasir: str | None = Field(default=None, max_length=60)
    sumber: str = Field(default="pos", max_length=20)
    baris: list[BarisStruk] = Field(min_length=1)


class HasilStruk(BaseModel):
    diterima: bool
    #: True kalau nota ini sudah pernah masuk. Bukan galat: justru tanda
    #: pengiriman ulang berhasil ditangkis.
    sudah_ada: bool
    transaksi_id: int
    baris_tercatat: int
    #: Nama bahan yang tidak dikenali. Bukan galat juga — menu baru di kasir
    #: lebih sering daripada yang diduga, dan menolak seluruh nota karena satu
    #: menu belum dipetakan akan membuat pemilik warung berhenti memakai
    #: sinkronisasi sama sekali.
    tak_dikenali: list[str]


class KemasanRingkas(BaseModel):
    nama: str
    isi: Decimal


class BarangRingkas(BaseModel):
    """
    Satu barang di gudang, dengan bentuk yang sama dengan `Barang` di frontend.

    `pemakaian_harian` dihitung dari 28 hari terakhir di `permintaan_harian`,
    tanpa hari yang tersensor stok habis: hari itu penjualannya nol karena
    barangnya tidak ada, bukan karena tidak ada yang membeli.
    """

    id: int
    nama: str
    deskripsi: str | None = None
    nama_lain: list[str] = []
    kategori: str = ""
    kode_barang: str = ""
    satuan: str
    satuan_tampil: str | None = None
    kemasan: list[KemasanRingkas] = []
    stok: Decimal
    batas_aman: Decimal
    batas_aman_saran: Decimal = Decimal(0)
    sumber_batas_aman: str = "sistem"
    hari_kirim: int = 2
    #: Harga per KEMASAN (Rp 148.000 per kg), seperti tersimpan di tabel.
    harga_beli_terakhir: int = 0
    #: Harga per SATUAN SIMPAN (Rp 148 per gram) = harga kemasan / isi kemasan terbesar.
    #: Inilah yang dikalikan dengan jumlah pemakaian; mengalikan harga kemasan dengan gram
    #: membuat nilai pemakaian seribu kali lipat.
    harga_beli_per_satuan: Decimal = Decimal(0)
    pemakaian_harian: Decimal = Decimal(0)
    hari_data_terkumpul: int = 0
    ingatkan_kedaluwarsa: bool = False
    kedaluwarsa: date | None = None
    terhubung_kasir: bool = False
    status: str
    dicatat_manual: bool
    catatan: str | None = None


class RiwayatHarian(BaseModel):
    """Pemakaian satu barang pada satu hari. `stok_habis` berarti angkanya tersensor."""

    tanggal: date
    jumlah: Decimal
    stok_habis: bool


class PerkiraanRingkas(BaseModel):
    barang_id: int
    tanggal_target: date
    p10: Decimal
    p50: Decimal
    p90: Decimal
    model_nama: str
    model_versi: str
    dijalankan_pada: datetime
    kematangan: str
    tingkat_layanan: str
    #: True untuk ramalan uji balik (tanggal sudah lewat): ramalan yang dibuat dari
    #: 14 hari sebelum data terakhir, untuk dibandingkan dengan pemakaian sebenarnya.
    uji_balik: bool = False


class SaranDistributor(BaseModel):
    """
    Satu kandidat distributor beserta alasannya.

    `kedaluwarsa_pada` ikut dikirim, tidak disembunyikan. Skor Mesin 2
    bergantung pada harga dan stok yang bisa berubah hari itu juga; frontend
    perlu bisa berkata "angka ini dihitung tadi pagi" alih-alih menampilkannya
    seolah baru.
    """

    barang_id: int
    distributor_id: int
    penawaran_id: int
    nama_distributor: str
    p_sukses: float
    skor: float
    alasan: str | None
    #: "sangat-layak", "layak", atau "kurang-layak". Kosong untuk skor dari
    #: penaksir lama yang tidak menghasilkan segmen.
    segmen: str | None = None
    model_nama: str
    dijalankan_pada: datetime
    kedaluwarsa_pada: datetime
    kedaluwarsa: bool


class PesananMasuk(BaseModel):
    """Satu pesanan dilihat dari sisi distributor."""

    id: int
    nomor: str
    usaha_id: int
    nama_usaha: str
    kota: str
    dibuat_pada: datetime
    status: str
    status_bayar: str
    ongkos_kirim: int | None
    perkiraan_tiba: datetime | None
    dari_saran: bool
    sudah_diulas: bool
    jumlah_baris: int
    nilai: int


class RingkasanSegmen(BaseModel):
    """Satu segmen pelanggan beserta rata-rata RFM anggotanya."""

    segmen: str
    nama_segmen: str
    ciri: str | None
    saran: str | None
    jumlah: int
    rata_recency: int
    rata_frequency: int
    rata_monetary: int
    dijalankan_pada: datetime
    tanggal_acuan: date


class PelangganTersegmen(BaseModel):
    """
    Satu pelanggan di dalam sebuah segmen.

    `jarak_ke_pusat` ikut dikirim: anggota berjarak jauh adalah pelanggan yang
    "dipaksa masuk" ke segmen terdekat. Menampilkannya mencegah layar terdengar
    lebih yakin daripada yang pantas.
    """

    usaha_id: int
    nama_usaha: str
    kota: str
    segmen: str
    nama_segmen: str
    recency: int
    frequency: int
    monetary: int
    lama_berlangganan: int
    jenis_usaha: str
    kategori_utama: str
    jarak_ke_pusat: float


class PeriodePemakaian(BaseModel):
    #: Titik tengah periode 30 hari, dipakai sebagai label bulan di grafik.
    tanggal: date
    #: Perkiraan pemakaian 30 hari: rata-rata hari yang tidak tersensor dikali 30.
    jumlah: Decimal
    hari_tercatat: int


class PemakaianBulanan(BaseModel):
    """
    Pemakaian satu barang per periode 30 hari (terlama dulu), ditambah perkiraan
    30 hari ke depan dari Mesin 1.

    `p10`/`p90` di sini adalah jumlah p10 dan p90 harian. Jumlah kuantil harian
    lebih lebar daripada kuantil jumlahnya, jadi pita ini sengaja konservatif.
    """

    barang_id: int
    periode: list[PeriodePemakaian]
    perkiraan_p10: Decimal | None = None
    perkiraan_p50: Decimal | None = None
    perkiraan_p90: Decimal | None = None
    model_nama: str | None = None
    dijalankan_pada: datetime | None = None


# --------------------------------------------------------------------------
# Pesanan (Tahap 3: jalur tulis)
# --------------------------------------------------------------------------
class BarisPesananBaru(BaseModel):
    penawaran_id: int
    #: Dalam satuan jual penawaran (dus, kg, karung), bukan satuan simpan.
    jumlah: Decimal = Field(gt=0)
    #: Kontrak aktif yang dipakai baris ini. Harga kontrak menggantikan harga katalog,
    #: dan pesanan tidak pernah mencampur dua kontrak (satu pesanan, satu kontrak).
    kontrak_id: int | None = None


class PesananBaru(BaseModel):
    """
    Satu keranjang. Baris dari distributor berbeda dipecah menjadi satu pesanan
    per distributor, semuanya dengan `kode_belanja` yang sama.
    """

    baris: list[BarisPesananBaru] = Field(min_length=1)
    catatan_untuk_distributor: str | None = Field(default=None, max_length=500)
    #: Pesanan yang lahir dari saran Mesin 1/Mesin 2, untuk mengukur kegunaannya.
    dari_saran: bool = False


class BarisPesananLengkap(BaseModel):
    id: int
    penawaran_id: int
    barang_id: int | None
    nama: str
    jumlah: Decimal
    satuan: str
    harga_satuan: int
    harga_normal: int | None
    promo_id: int | None
    isi_per_satuan: Decimal
    jumlah_diterima: Decimal | None
    alasan_selisih: str | None
    catatan_penerimaan: str | None


class JejakPesananLengkap(BaseModel):
    waktu: datetime
    status: str
    keterangan: str | None


class PesananLengkap(BaseModel):
    """Satu pesanan lengkap dengan baris dan jejaknya. Bentuk yang sama dibaca kedua portal."""

    id: int
    nomor: str
    usaha_id: int
    nama_usaha: str
    #: Profil singkat pemesan, untuk kartu pemesan di portal distributor.
    usaha_jenis: str = ""
    usaha_kota: str = ""
    usaha_alamat: str = ""
    usaha_nomor_hp: str = ""
    usaha_lat: float | None = None
    usaha_lng: float | None = None
    distributor_id: int
    nama_distributor: str
    kontrak_id: int | None
    dibuat_pada: datetime
    status: str
    status_bayar: str
    ongkos_kirim: int
    perkiraan_tiba: datetime | None
    jumlah_bukti: int
    dari_saran: bool
    dari_rutin: bool
    catatan_untuk_distributor: str | None
    sudah_diulas: bool
    kode_belanja: str | None
    alasan_tolak: str | None
    kirim_kurir: str | None
    kirim_pengantar: str | None
    kirim_nomor_resi: str | None
    kirim_diterima_oleh: str | None
    kirim_waktu_sampai: datetime | None
    kirim_catatan: str | None
    baris: list[BarisPesananLengkap]
    jejak: list[JejakPesananLengkap]


class BarisPenerimaan(BaseModel):
    baris_id: int
    #: Dalam satuan jual, sama dengan `jumlah` di baris pesanan.
    jumlah_diterima: Decimal = Field(ge=0)
    alasan_selisih: str | None = Field(default=None, pattern="^(kurang|lebih|rusak|kualitas-beda|salah-barang)$")
    catatan: str | None = Field(default=None, max_length=500)


class Penerimaan(BaseModel):
    """Hasil hitung barang di tempat. Satu baris per baris pesanan."""

    baris: list[BarisPenerimaan] = Field(min_length=1)


class KonfirmasiPesanan(BaseModel):
    #: Kosong berarti perkiraan tiba yang dihitung saat pesanan dibuat tetap berlaku.
    perkiraan_tiba: datetime | None = None


class TolakPesanan(BaseModel):
    alasan: str = Field(min_length=3, max_length=500)


class KirimPesanan(BaseModel):
    kurir: str | None = Field(default=None, max_length=120)
    pengantar: str | None = Field(default=None, max_length=120)
    nomor_resi: str | None = Field(default=None, max_length=60)


class SampaiPesanan(BaseModel):
    diterima_oleh: str | None = Field(default=None, max_length=120)
    catatan: str | None = Field(default=None, max_length=500)


# --------------------------------------------------------------------------
# Katalog (Tahap 4)
# --------------------------------------------------------------------------
class DistributorKatalog(BaseModel):
    """Profil distributor untuk pembeli. Rating dihitung dari tabel `ulasan`, bukan diketik."""

    id: int
    nama: str
    kota: str
    deskripsi: str | None
    warna: str
    kategori: list[str]
    area_kirim: list[str]
    terverifikasi: bool
    baru: bool
    sejak: date
    alamat_gudang: str | None
    nomor_hp: str | None
    jam_operasional: str | None
    minimum_pesanan: int
    rating: float | None
    jumlah_ulasan: int
    jumlah_umkm_pengulas: int
    jumlah_pesanan_selesai: int
    aspek_ketepatan: float | None
    aspek_jumlah: float | None
    aspek_kondisi: float | None


class PenawaranKatalog(BaseModel):
    id: int
    distributor_id: int
    nama: str
    kategori: str
    satuan: str
    harga_satuan: int
    kemasan_nama: str
    kemasan_isi: Decimal
    satuan_isi: str
    stok_tersedia: Decimal
    stok_diperbarui_pada: datetime
    keterangan: str | None
    aktif: bool
    #: Barang di gudang usaha pemanggil yang bertambah kalau penawaran ini dibeli.
    barang_id_terkait: int | None


class UsahaRingkas(BaseModel):
    id: int
    nama: str
    jenis_usaha: str
    kota: str
    alamat: str


class PaketKontrakRingkas(BaseModel):
    id: int
    penawaran_id: int
    distributor_id: int
    kode: str
    durasi_bulan: int
    kuota_min_per_bulan: Decimal
    harga_satuan: int
    hemat_persen: int
    ketentuan_kuota_kurang: str | None
    ketentuan_berhenti: str | None


class Katalog(BaseModel):
    usaha: UsahaRingkas
    distributor: list[DistributorKatalog]
    penawaran: list[PenawaranKatalog]
    paket: list[PaketKontrakRingkas] = []
    promo: list["PromoLengkap"] = []


class UlasanPublik(BaseModel):
    id: int
    distributor_id: int
    nama_usaha: str
    kota_usaha: str
    rating: int
    isi: str | None
    waktu: datetime
    nomor_pesanan: str
    aspek_ketepatan_waktu: int
    aspek_jumlah_sesuai: int
    aspek_kondisi_barang: int
    #: Untuk label sistem "N pesanan · pelanggan sejak ...". Tidak bisa diubah penulis ulasan.
    jumlah_pesanan_penulis: int
    pelanggan_sejak: date | None


# --------------------------------------------------------------------------
# Kontrak (Tahap 5)
# --------------------------------------------------------------------------
class PeriodeKontrak(BaseModel):
    #: "YYYY-MM"
    periode: str
    kuota: Decimal
    diterima: Decimal
    selesai: bool


class KontrakLengkap(BaseModel):
    """Satu kontrak, dibaca kedua portal. `status` dihitung saat dibaca (akan-berakhir, selesai)."""

    id: int
    usaha_id: int
    nama_usaha: str
    usaha_jenis: str
    usaha_kota: str
    usaha_alamat: str
    usaha_nomor_hp: str
    distributor_id: int
    penawaran_id: int
    paket_id: int | None
    barang_id: int | None
    nama_barang: str
    durasi_bulan: int
    kuota_min_per_bulan: Decimal
    harga_satuan: int
    satuan: str
    mulai: datetime
    berakhir: datetime
    status: str
    dalam_perjalanan: Decimal
    ketentuan_kuota_kurang: str | None
    pesanan_rutin_aktif: bool
    pesanan_rutin_berikutnya: date | None
    alasan_ditolak: str | None
    pengajuan_berhenti_waktu: datetime | None
    pengajuan_berhenti_alasan: str | None
    jawaban_berhenti_waktu: datetime | None
    jawaban_berhenti_disetujui: bool | None
    jawaban_berhenti_alasan: str | None
    periode: list[PeriodeKontrak]


class AjukanKontrak(BaseModel):
    paket_id: int


class AlasanWajib(BaseModel):
    alasan: str = Field(min_length=3, max_length=500)


class JawabBerhenti(BaseModel):
    setuju: bool
    #: Wajib kalau menolak: pemilik usaha berhak tahu kenapa ia tetap terikat.
    alasan: str | None = Field(default=None, max_length=500)


class PesananRutin(BaseModel):
    aktif: bool


class KatalogDistributor(BaseModel):
    """Penawaran dan paket kontrak milik satu distributor, untuk portalnya sendiri."""

    penawaran: list[PenawaranKatalog]
    paket: list[PaketKontrakRingkas]
    promo: list["PromoLengkap"] = []


class SimpanPaket(BaseModel):
    penawaran_id: int
    kode: str = Field(min_length=1, max_length=30)
    durasi_bulan: int = Field(ge=1, le=36)
    kuota_min_per_bulan: Decimal = Field(gt=0)
    harga_satuan: int = Field(gt=0)
    hemat_persen: int = Field(default=0, ge=0, le=100)
    ketentuan_kuota_kurang: str | None = None
    ketentuan_berhenti: str | None = None


# --------------------------------------------------------------------------
# Promo (Tahap 5)
# --------------------------------------------------------------------------
class TingkatPromo(BaseModel):
    nama: str = Field(min_length=1, max_length=60)
    syarat: str | None = None
    manfaat: str | None = None


class PromoLengkap(BaseModel):
    id: int
    distributor_id: int
    jenis: str
    judul: str
    keterangan: str | None
    berakhir: datetime | None
    potongan_persen: int | None
    penawaran_ids: list[int]
    tingkat: list[TingkatPromo]


class SimpanPromo(BaseModel):
    jenis: str = Field(pattern="^(cuci-gudang|produk-baru|membership)$")
    judul: str = Field(min_length=3, max_length=120)
    keterangan: str | None = None
    berakhir: datetime | None = None
    #: Kosong untuk promo yang tidak memotong harga (mis. produk baru).
    potongan_persen: int | None = Field(default=None, ge=1, le=90)
    penawaran_ids: list[int] = []
    tingkat: list[TingkatPromo] = []


Katalog.model_rebuild()
KatalogDistributor.model_rebuild()
