"""titik gudang distributor

Revisi 23 Okt 2026, Lacak Pesanan: distributor menyimpan koordinat gudangnya
supaya peta bisa menarik garis dari gudang ke tempat usaha pemesan. Keduanya
boleh kosong; peta lalu memakai titik tengah kota distributor.

ID revisi: 5e0c7a3d9b21
Turunan dari: a650ed7218eb
Dibuat: 2026-10-23
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = '5e0c7a3d9b21'
down_revision: str | None = 'a650ed7218eb'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('distributor', sa.Column('lat', sa.Float(), nullable=True))
    op.add_column('distributor', sa.Column('lng', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('distributor', 'lng')
    op.drop_column('distributor', 'lat')
