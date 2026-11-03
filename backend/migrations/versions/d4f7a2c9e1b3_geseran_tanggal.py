"""geseran tanggal data simulasi

Revisi V8 (Q180): data simulasi berakhir 5 Okt 2026, jadi Ringkasan Penjualan dan
Prediksi tampak berhenti sebulan sebelum hari ini. `dataset.geser_tanggal` menggeser
tanggalnya maju kelipatan 7 hari. Tabel satu baris ini mencatat seberapa jauh
geserannya dan id baris simulasi per tabel, supaya baris yang dibuat sesudahnya
(lewat layar atau Portal POS) tidak ikut digeser. Tidak mengubah tabel lain.

ID revisi: d4f7a2c9e1b3
Turunan dari: b8e2f5a1c4d7
Dibuat: 2026-11-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd4f7a2c9e1b3'
down_revision: str | None = 'b8e2f5a1c4d7'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        'geseran_tanggal',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('hari', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('akhir_data', sa.Date(), nullable=False),
        sa.Column('id_simulasi', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('diperbarui_pada', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('id = 1', name='ck_geseran_tanggal_satu'),
    )


def downgrade() -> None:
    op.drop_table('geseran_tanggal')
