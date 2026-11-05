"""kontrak dari variasi demo

Audit 5 Nov 2026: `dataset.variasi_demo` memasang ulang kontrak contoh dengan menghapus SEMUA
kontrak usaha, termasuk yang dibuat lewat layar. Kolom ini menandai kontrak buatan variasi, jadi
hanya itu yang dibuang. Data dasar tidak punya kontrak, jadi semua baris yang sudah ada dianggap
milik variasi. Kontrak yang dibuat sesudah migrasi ini tidak pernah ditandai.

ID revisi: a1c5e9f27d40
Turunan dari: d4f7a2c9e1b3
Dibuat: 2026-11-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c5e9f27d40'
down_revision: str | None = 'd4f7a2c9e1b3'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('kontrak', sa.Column('dari_variasi', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute('UPDATE kontrak SET dari_variasi = true')


def downgrade() -> None:
    op.drop_column('kontrak', 'dari_variasi')
