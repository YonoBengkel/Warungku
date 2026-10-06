"""tabel segmen pelanggan

Keluaran Mesin 3. Fitur RFM-nya ikut disimpan, tidak hanya nomor segmennya:
tanpa itu layar hanya bisa berkata "Pelanggan andalan" tanpa bisa menjawab
"kenapa?" — dan pertanyaan itu pasti datang dari distributor yang merasa
pelanggannya salah dikelompokkan.

ID revisi: d409c0ce836c
Turunan dari: b52b396b5fba
Dibuat: 2026-10-06 08:50:45.968796
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'd409c0ce836c'
down_revision: str | None = 'b52b396b5fba'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table('segmen_pelanggan',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('distributor_id', sa.Integer(), nullable=False),
    sa.Column('usaha_id', sa.Integer(), nullable=False),
    sa.Column('segmen', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
    sa.Column('nama_segmen', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
    sa.Column('ciri', sa.Text(), nullable=True),
    sa.Column('saran', sa.Text(), nullable=True),
    sa.Column('recency', sa.Integer(), nullable=False),
    sa.Column('frequency', sa.Integer(), nullable=False),
    sa.Column('monetary', sa.BigInteger(), nullable=False),
    sa.Column('lama_berlangganan', sa.Integer(), nullable=False),
    sa.Column('jenis_usaha', sqlmodel.sql.sqltypes.AutoString(length=30), nullable=False),
    sa.Column('kategori_utama', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
    sa.Column('jarak_ke_pusat', sa.Float(), nullable=False),
    sa.Column('jalan_id', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
    sa.Column('model_nama', sqlmodel.sql.sqltypes.AutoString(length=60), nullable=False),
    sa.Column('model_versi', sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
    sa.Column('dijalankan_pada', sa.DateTime(timezone=True), nullable=False),
    sa.Column('tanggal_acuan', sa.Date(), nullable=False),
    sa.ForeignKeyConstraint(['distributor_id'], ['distributor.id'], ),
    sa.ForeignKeyConstraint(['usaha_id'], ['usaha.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('distributor_id', 'usaha_id', 'jalan_id', name='uq_segmen_pelanggan')
    )
    op.create_index('ix_segmen_distributor', 'segmen_pelanggan', ['distributor_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_segmen_distributor', table_name='segmen_pelanggan')
    op.drop_table('segmen_pelanggan')
