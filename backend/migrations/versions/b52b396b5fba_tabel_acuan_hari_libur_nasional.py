"""tabel acuan hari libur nasional

Kalender SKB 3 Menteri sebelumnya hanya hidup di `dataset/pola.py`, sehingga
satu-satunya yang bisa mengisi kolom kovariat `permintaan_harian.hari_libur`
adalah skrip Python. Skrip SQL pemeliharaan tidak bisa, dan itu berarti tabel
turunan tidak benar-benar bisa dibangun ulang dari sumbernya.

ID revisi: b52b396b5fba
Turunan dari: efe02e5b8cef
Dibuat: 2026-10-06 08:12:29.562120
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'b52b396b5fba'
down_revision: str | None = 'efe02e5b8cef'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table('hari_libur_nasional',
    sa.Column('tanggal', sa.Date(), nullable=False),
    sa.Column('nama', sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
    sa.Column('jenis', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.PrimaryKeyConstraint('tanggal')
    )


def downgrade() -> None:
    op.drop_table('hari_libur_nasional')
