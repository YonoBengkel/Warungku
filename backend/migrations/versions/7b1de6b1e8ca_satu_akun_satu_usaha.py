"""satu akun satu usaha

Batasan lama UNIQUE(pengguna_id, usaha_id) mengizinkan satu orang memiliki
banyak usaha. Keputusan pemilik proyek: satu akun satu usaha. Perhatikan
arahnya — yang dibatasi pengguna, bukan usaha; satu warung tetap boleh punya
pemilik dan beberapa pegawai.

ID revisi: 7b1de6b1e8ca
Turunan dari: d409c0ce836c
Dibuat: 2026-10-06 09:01:03.528498
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '7b1de6b1e8ca'
down_revision: str | None = 'd409c0ce836c'
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_constraint(op.f('uq_keanggotaan'), 'keanggotaan', type_='unique')
    op.create_unique_constraint('uq_keanggotaan_pengguna', 'keanggotaan', ['pengguna_id'])


def downgrade() -> None:
    op.drop_constraint('uq_keanggotaan_pengguna', 'keanggotaan', type_='unique')
    op.create_unique_constraint(op.f('uq_keanggotaan'), 'keanggotaan', ['pengguna_id', 'usaha_id'], postgresql_nulls_not_distinct=False)
