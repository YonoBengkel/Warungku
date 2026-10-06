"""nilai bawaan juga di sisi basis data

Tiga puluh kolom NOT NULL punya nilai bawaan di Python tapi tidak di basis
data. Selama semua tulisan lewat ORM, cacat ini tidak terlihat; begitu ada
skrip SQL, pengimpor CSV, atau psql yang menulis tanpa menyebut kolom itu,
Postgres menolak INSERT-nya. Migrasi ini memindahkan nilai bawaannya ke tempat
yang berlaku untuk semua penulis.

ID revisi: efe02e5b8cef
Turunan dari: 438405f251bc
Dibuat: 2026-10-06 02:12:59.537995
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'efe02e5b8cef'
down_revision: str | None = '438405f251bc'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column('barang', 'hari_kirim',
               existing_type=sa.INTEGER(),
               server_default=sa.text('2'),
               existing_nullable=False)
    op.alter_column('barang', 'hari_data_terkumpul',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_nullable=False)
    op.alter_column('barang', 'ingatkan_kedaluwarsa',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('barang', 'terhubung_kasir',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('barang', 'dicatat_manual',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('distributor', 'warna',
               existing_type=sa.VARCHAR(length=10),
               server_default=sa.text("'#0f766e'"),
               existing_nullable=False)
    op.alter_column('distributor', 'terverifikasi',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('distributor', 'baru',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_nullable=False)
    op.alter_column('kontrak', 'pesanan_rutin_aktif',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('kontrak_periode', 'selesai',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('notifikasi', 'dibaca',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('notifikasi', 'butuh_tindakan',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('paket_kontrak', 'hemat_persen',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_nullable=False)
    op.alter_column('penawaran', 'aktif',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_nullable=False)
    op.alter_column('pengguna', 'aktif',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'stok_habis',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'hari_libur',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'pekan_gajian',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'ramadan',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'promo_aktif',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('pesanan', 'jumlah_bukti',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_nullable=False)
    op.alter_column('pesanan', 'dari_saran',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('pesanan', 'dari_rutin',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('pesanan', 'sudah_diulas',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('transaksi', 'sumber',
               existing_type=sa.VARCHAR(length=20),
               server_default=sa.text("'pos'"),
               existing_nullable=False)
    op.alter_column('transaksi', 'dibatalkan',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.alter_column('usaha', 'warna',
               existing_type=sa.VARCHAR(length=10),
               server_default=sa.text("'#0f766e'"),
               existing_nullable=False)
    op.alter_column('usaha', 'tingkat_verifikasi',
               existing_type=sa.VARCHAR(length=10),
               server_default=sa.text("'dasar'"),
               existing_nullable=False)
    op.alter_column('usaha', 'tampilkan_alamat',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_nullable=False)
    op.alter_column('usaha', 'tampilkan_nomor_hp',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_nullable=False)


def downgrade() -> None:
    op.alter_column('usaha', 'tampilkan_nomor_hp',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('usaha', 'tampilkan_alamat',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('usaha', 'tingkat_verifikasi',
               existing_type=sa.VARCHAR(length=10),
               server_default=None,
               existing_nullable=False)
    op.alter_column('usaha', 'warna',
               existing_type=sa.VARCHAR(length=10),
               server_default=None,
               existing_nullable=False)
    op.alter_column('transaksi', 'dibatalkan',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('transaksi', 'sumber',
               existing_type=sa.VARCHAR(length=20),
               server_default=None,
               existing_nullable=False)
    op.alter_column('pesanan', 'sudah_diulas',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('pesanan', 'dari_rutin',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('pesanan', 'dari_saran',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('pesanan', 'jumlah_bukti',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'promo_aktif',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'ramadan',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'pekan_gajian',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'hari_libur',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('permintaan_harian', 'stok_habis',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('pengguna', 'aktif',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('penawaran', 'aktif',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('paket_kontrak', 'hemat_persen',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('notifikasi', 'butuh_tindakan',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('notifikasi', 'dibaca',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('kontrak_periode', 'selesai',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('kontrak', 'pesanan_rutin_aktif',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('distributor', 'baru',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('distributor', 'terverifikasi',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('distributor', 'warna',
               existing_type=sa.VARCHAR(length=10),
               server_default=None,
               existing_nullable=False)
    op.alter_column('barang', 'dicatat_manual',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('barang', 'terhubung_kasir',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('barang', 'ingatkan_kedaluwarsa',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('barang', 'hari_data_terkumpul',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_nullable=False)
    op.alter_column('barang', 'hari_kirim',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_nullable=False)
