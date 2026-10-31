"""shift kas

Portal POS, tahap 5: buka dan tutup kas. Satu usaha hanya punya satu shift terbuka
(indeks unik sebagian). Rekap tunai, QRIS, dan transfer dibekukan saat shift ditutup,
supaya pembatalan nota sesudahnya tidak mengubah angka yang sudah dicocokkan dengan laci.

ID revisi: f9c4a7e2b5d8
Turunan dari: e7b3d1f8a2c6
Dibuat: 2026-10-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = 'f9c4a7e2b5d8'
down_revision: str | None = 'e7b3d1f8a2c6'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'shift_kas',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('usaha_id', sa.Integer(), sa.ForeignKey('usaha.id'), nullable=False),
        sa.Column('dibuka_oleh', sa.Integer(), sa.ForeignKey('pengguna.id'), nullable=True),
        sa.Column('nama_kasir', sa.String(length=120), nullable=False),
        sa.Column('dibuka_pada', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modal_awal', sa.BigInteger(), nullable=False),
        sa.Column('ditutup_pada', sa.DateTime(timezone=True), nullable=True),
        sa.Column('uang_dihitung', sa.BigInteger(), nullable=True),
        sa.Column('jumlah_nota', sa.Integer(), nullable=True),
        sa.Column('tunai', sa.BigInteger(), nullable=True),
        sa.Column('qris', sa.BigInteger(), nullable=True),
        sa.Column('transfer', sa.BigInteger(), nullable=True),
        sa.Column('tunai_diharapkan', sa.BigInteger(), nullable=True),
        sa.Column('selisih', sa.BigInteger(), nullable=True),
        sa.Column('catatan', sa.String(length=200), nullable=True),
        sa.CheckConstraint('modal_awal >= 0', name='ck_shift_modal'),
    )
    op.create_index('ix_shift_kas_usaha', 'shift_kas', ['usaha_id', 'dibuka_pada'])
    op.create_index('uq_shift_terbuka', 'shift_kas', ['usaha_id'], unique=True, postgresql_where=sa.text('ditutup_pada IS NULL'))
    op.add_column('transaksi', sa.Column('shift_id', sa.Integer(), sa.ForeignKey('shift_kas.id'), nullable=True))
    op.create_index('ix_transaksi_shift_id', 'transaksi', ['shift_id'])


def downgrade() -> None:
    op.drop_index('ix_transaksi_shift_id', table_name='transaksi')
    op.drop_column('transaksi', 'shift_id')
    op.drop_index('uq_shift_terbuka', table_name='shift_kas')
    op.drop_index('ix_shift_kas_usaha', table_name='shift_kas')
    op.drop_table('shift_kas')
