"""batal nota

Portal POS, tahap 4: alasan dan waktu pembatalan nota, serta pengajuan pembatalan
dari kasir. `transaksi.dibatalkan` sudah ada sejak skema awal; kolom ini melengkapinya.

ID revisi: e7b3d1f8a2c6
Turunan dari: d5a2c9e4f1b7
Dibuat: 2026-10-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = 'e7b3d1f8a2c6'
down_revision: str | None = 'd5a2c9e4f1b7'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('transaksi', sa.Column('alasan_batal', sa.String(length=200), nullable=True))
    op.add_column('transaksi', sa.Column('dibatalkan_pada', sa.DateTime(timezone=True), nullable=True))
    op.add_column('transaksi', sa.Column('pengajuan_batal', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('transaksi', 'pengajuan_batal')
    op.drop_column('transaksi', 'dibatalkan_pada')
    op.drop_column('transaksi', 'alasan_batal')
