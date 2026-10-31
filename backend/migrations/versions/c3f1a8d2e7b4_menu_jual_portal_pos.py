"""menu jual portal POS

Portal POS, tahap 1: pemilik mengatur harga jual, kategori, dan status aktif tiap
menu di Portal UMKM, dan POS hanya membacanya. Disimpan di `pemetaan_menu` karena
menu tanpa resep pun sudah punya tempat di sana. Harga kosong berarti menu itu
tidak dijual lewat POS.

ID revisi: c3f1a8d2e7b4
Turunan dari: 5e0c7a3d9b21
Dibuat: 2026-10-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = 'c3f1a8d2e7b4'
down_revision: str | None = '5e0c7a3d9b21'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('pemetaan_menu', sa.Column('harga_jual', sa.BigInteger(), nullable=True))
    op.add_column('pemetaan_menu', sa.Column('kategori', sa.String(length=40), nullable=True))
    op.add_column('pemetaan_menu', sa.Column('aktif', sa.Boolean(), server_default=sa.true(), nullable=False))


def downgrade() -> None:
    op.drop_column('pemetaan_menu', 'aktif')
    op.drop_column('pemetaan_menu', 'kategori')
    op.drop_column('pemetaan_menu', 'harga_jual')
