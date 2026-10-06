"""Lingkungan Alembic: membaca alamat basis data dari .env, skema dari SQLModel."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

# Impor ini yang membuat seluruh tabel terdaftar di SQLModel.metadata.
# Tanpa baris ini, autogenerate akan mengira basis datanya harus dikosongkan.
import warungku.model  # noqa: F401
from warungku.konfigurasi import alamat_basis_data

config = context.config
config.set_main_option("sqlalchemy.url", alamat_basis_data())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def jalankan_luring() -> None:
    context.configure(
        url=alamat_basis_data(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def jalankan_daring() -> None:
    bagian = config.get_section(config.config_ini_section, {})
    mesin = engine_from_config(bagian, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with mesin.connect() as koneksi:
        context.configure(
            connection=koneksi,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    jalankan_luring()
else:
    jalankan_daring()
