"""pembayaran qr simulasi

Revisi V8 (Q178): kasir Portal POS membuat tagihan QR simulasi, lalu HP pelanggan
membuka tautan di QR itu dan tagihannya ditandai lunas. Bukan QRIS dan tidak ada
uang yang berpindah. Tabelnya hanya menyimpan tagihan, tidak mengubah tabel lain.

ID revisi: b8e2f5a1c4d7
Turunan dari: f9c4a7e2b5d8
Dibuat: 2026-11-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = 'b8e2f5a1c4d7'
down_revision: str | None = 'f9c4a7e2b5d8'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'pembayaran_qr',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('usaha_id', sa.Integer(), sa.ForeignKey('usaha.id'), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('nomor_struk', sa.String(length=60), nullable=False),
        sa.Column('jumlah', sa.BigInteger(), nullable=False),
        sa.Column('status', sa.String(length=12), nullable=False, server_default='menunggu'),
        sa.Column('dibuat_pada', sa.DateTime(timezone=True), nullable=False),
        sa.Column('kedaluwarsa_pada', sa.DateTime(timezone=True), nullable=False),
        sa.Column('lunas_pada', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cara_lunas', sa.String(length=12), nullable=True),
        sa.CheckConstraint('jumlah > 0', name='ck_pembayaran_qr_jumlah'),
        sa.CheckConstraint("status IN ('menunggu', 'lunas')", name='ck_pembayaran_qr_status'),
        sa.UniqueConstraint('token', name='uq_pembayaran_qr_token'),
    )
    op.create_index('ix_pembayaran_qr_usaha', 'pembayaran_qr', ['usaha_id', 'dibuat_pada'])


def downgrade() -> None:
    op.drop_index('ix_pembayaran_qr_usaha', table_name='pembayaran_qr')
    op.drop_table('pembayaran_qr')
