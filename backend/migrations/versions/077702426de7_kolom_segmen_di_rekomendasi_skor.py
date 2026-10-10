"""kolom segmen di rekomendasi skor

Mesin 2 kini berupa segmentasi distributor (permintaan dosen): tiap kandidat
diberi label sangat-layak, layak, atau kurang-layak dari inferensi fuzzy atas
keandalan Beta-Bernoulli dan rasio harga. Kolomnya boleh kosong supaya penaksir
lama yang tidak menghasilkan segmen tetap bisa menulis ke tabel ini.

ID revisi: 077702426de7
Turunan dari: 7b1de6b1e8ca
Dibuat: 2026-10-10 22:23:25.368199
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '077702426de7'
down_revision: str | None = '7b1de6b1e8ca'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column('rekomendasi_skor', sa.Column('segmen', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('rekomendasi_skor', 'segmen')
