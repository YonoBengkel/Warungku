"""pembayaran nota

Portal POS, tahap 3: cara bayar, diskon per nota, dan uang yang diterima pada tunai.
Uangnya hanya dicatat, tidak ada payment gateway. Nota lama dan nota dari kasir lain
tidak membawa ketiganya, jadi cara bayar boleh kosong dan diskonnya 0.

ID revisi: d5a2c9e4f1b7
Turunan dari: c3f1a8d2e7b4
Dibuat: 2026-10-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = 'd5a2c9e4f1b7'
down_revision: str | None = 'c3f1a8d2e7b4'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('transaksi', sa.Column('cara_bayar', sa.String(length=10), nullable=True))
    op.add_column('transaksi', sa.Column('diskon', sa.Integer(), server_default='0', nullable=False))
    op.add_column('transaksi', sa.Column('uang_diterima', sa.BigInteger(), nullable=True))
    op.create_check_constraint('ck_transaksi_cara_bayar', 'transaksi', "cara_bayar IS NULL OR cara_bayar IN ('tunai', 'qris', 'transfer')")
    op.create_check_constraint('ck_transaksi_diskon', 'transaksi', 'diskon >= 0')


def downgrade() -> None:
    op.drop_constraint('ck_transaksi_diskon', 'transaksi', type_='check')
    op.drop_constraint('ck_transaksi_cara_bayar', 'transaksi', type_='check')
    op.drop_column('transaksi', 'uang_diterima')
    op.drop_column('transaksi', 'diskon')
    op.drop_column('transaksi', 'cara_bayar')
