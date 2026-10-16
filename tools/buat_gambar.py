"""
Bangkitkan gambar produk dan logo toko untuk frontend.

    python tools/buat_gambar.py

Diminta dosen pengampu (16 Okt 2026): katalog distributor perlu gambar produk,
dan tiap toko (70 UMKM, 8 distributor) perlu logo bergambar, bukan sekadar
inisial. Sementara belum ada foto sungguhan, gambarnya ilustrasi SVG buatan
sendiri. Keluaran:

* `frontend/public/gambar/produk/<slug>.svg` — satu ilustrasi per produk di
  `KATALOG` (30), di katalog tambahan UMKM produsen (4), dan per barang jadinya
  (2 toples sambal), digambar tangan di bawah.
* `frontend/public/gambar/logo/<slug>.svg` — logo 8 distributor (digambar
  tangan, warnanya sama dengan warna distributor di basis data) dan logo semua
  UMKM di `UMKM`. Logo UMKM dirakit dari piktogram jenis usahanya; bentuk,
  pasangan warna, dan hiasannya dipilih dari hash nama, jadi tiap toko berbeda
  tetapi hasilnya selalu sama di komputer siapa pun.
* `frontend/src/data/gambar.ts` — daftar berkas yang ada, supaya frontend tahu
  gambar mana yang tersedia tanpa meminta berkas yang tidak ada.

Mengganti ilustrasi dengan foto sungguhan cukup dengan menimpa berkasnya
(nama berkas tetap) atau mengubah ekstensi di `gambar.ts`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(AKAR / "data"), str(AKAR / "backend")]

from dataset.katalog import DISTRIBUTOR, KATALOG, UMKM  # noqa: E402
from dataset.umkm_produksi import JENIS as JENIS_PRODUSEN  # noqa: E402
from dataset.umkm_produksi import KATALOG_TAMBAHAN, NAMA_USAHA as NAMA_PRODUSEN, PRODUK_JADI  # noqa: E402
from warungku.enum import JenisUsaha  # noqa: E402

KELUAR_PRODUK = AKAR / "frontend" / "public" / "gambar" / "produk"
KELUAR_LOGO = AKAR / "frontend" / "public" / "gambar" / "logo"
DAFTAR_TS = AKAR / "frontend" / "src" / "data" / "gambar.ts"


def slug(nama: str) -> str:
    """Sama persis dengan `slugGambar` di frontend: huruf kecil, selain huruf/angka jadi '-'."""
    return re.sub(r"[^a-z0-9]+", "-", nama.lower()).strip("-")


def fnv1a(teks: str) -> int:
    h = 0x811C9DC5
    for b in teks.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def svg(isi: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{isi}</svg>\n'


# --------------------------------------------------------------------------
# Ilustrasi produk
# --------------------------------------------------------------------------
# Gaya: ubin bersudut bulat berwarna muda per kategori, benda datar dengan satu
# bayangan bawah. Warna di sini milik ilustrasi (seperti piksel foto), bukan
# token antarmuka, jadi aman di tema terang maupun gelap.

UBIN = {
    "Kopi & Teh": "#F4E9DD",
    "Susu & Olahan": "#E6F0FB",
    "Pemanis": "#FCEDF2",
    "Bahan Makanan": "#FFF3D9",
    "Protein": "#FDEAE3",
    "Kemasan": "#ECEFF4",
    "Pendukung": "#E2F5F7",
    "Produk Jadi": "#FFE7E0",
}
BAYANGAN = '<ellipse cx="32" cy="55" rx="17" ry="2.6" fill="#000" opacity=".09"/>'


def _kantong(badan: str, lipat: str, label: str, isi_label: str) -> str:
    """Kantong kemasan berlipat di atas, dipakai biji kopi."""
    return (
        f'<path d="M20 19h24l3 33a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z" fill="{badan}"/>'
        f'<path d="M20 19h24l-2-7H22z" fill="{lipat}"/>'
        f'<path d="M22 15h20" stroke="{badan}" stroke-width="1.4"/>'
        f'<rect x="22" y="27" width="20" height="18" rx="3" fill="{label}"/>{isi_label}'
    )


def _biji(cx: float, cy: float, s: float = 1.0, warna: str = "#6B3E1E", garis: str = "#3E220F") -> str:
    return (
        f'<g transform="translate({cx} {cy}) rotate(28) scale({s})">'
        f'<ellipse rx="4.6" ry="6.2" fill="{warna}"/>'
        f'<path d="M-1.4-5.4c2.6 2.4-.8 6.6 1.6 10.8" stroke="{garis}" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>'
    )


def _karung(badan: str, ikat: str, pita: str, isi: str = "") -> str:
    return (
        f'<path d="M18 22c5-4 23-4 28 0l3 28c-6 5-28 5-34 0z" fill="{badan}"/>'
        f'<path d="M23 23c1-7 17-7 18 0-5 2-13 2-18 0z" fill="{ikat}"/>'
        f'<path d="M26 16l-3-4M38 16l3-4" stroke="{ikat}" stroke-width="2" stroke-linecap="round"/>'
        f'<path d="M17 34c8 2 22 2 30 0v10c-8 2-22 2-30 0z" fill="{pita}"/>{isi}'
    )


def _kotak_teh(badan: str, tutup: str, label: str, isi: str) -> str:
    return (
        f'<path d="M16 22h32v28a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" fill="{badan}"/>'
        f'<path d="M16 22l4-7h24l4 7z" fill="{tutup}"/>'
        f'<circle cx="32" cy="37" r="9" fill="{label}"/>{isi}'
    )


def _toples(badan: str, tutup: str, label: str, isi: str) -> str:
    return (
        f'<rect x="19" y="22" width="26" height="31" rx="5" fill="{badan}"/>'
        f'<rect x="17" y="15" width="30" height="9" rx="3" fill="{tutup}"/>'
        f'<rect x="19" y="30" width="26" height="15" fill="{label}"/>{isi}'
    )


def _gelas_plastik(atas: int, tinggi_tutup: float) -> str:
    return (
        f'<path d="M19 {atas}h26l-3.5 {53 - atas}h-19z" fill="#DDEFFB" stroke="#8DB9DB" stroke-width="1.4" stroke-linejoin="round"/>'
        f'<path d="M23 {atas + 6}l2.4 {47 - atas - 8}" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>'
        f'<path d="M17 {atas}h30v-2.5a2 2 0 0 0-2-2H19a2 2 0 0 0-2 2z" fill="#B9D7EE"/>'
        f'<path d="M22 {atas - 4.5}c0-{tinggi_tutup} 20-{tinggi_tutup} 20 0z" fill="#CFE5F6" stroke="#8DB9DB" stroke-width="1.2"/>'
        f'<path d="M36 {atas - 6}l5-{atas - 12}" stroke="#E5484D" stroke-width="2.6" stroke-linecap="round"/>'
    )


PRODUK: dict[str, str] = {
    # --- Kopi & Teh ---
    "Biji Kopi Arabika": _kantong("#C99360", "#B07A45", "#FFF6EA", _biji(32, 36)),
    "Biji Kopi Robusta": _kantong("#7E5233", "#694126", "#F3E3CF", _biji(28, 37, .85, "#4A2A14", "#24130A") + _biji(36, 35, .85, "#4A2A14", "#24130A")),
    "Teh Hitam": _kotak_teh(
        "#8E2F2F", "#AD4545", "#F8E5CB",
        '<path d="M27 41c0-7 4-11 10-11 0 7-4 11-10 11z" fill="#3F7D3A"/>'
        '<path d="M28 40c2-3 4-5 7-7" stroke="#C9E3B5" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    ),
    "Teh Melati": _kotak_teh(
        "#2E7A58", "#3F946E", "#DDF1E5",
        "".join(
            f'<ellipse cx="32" cy="32.6" rx="2.6" ry="4.2" fill="#fff" stroke="#BFD9C8" stroke-width=".8" transform="rotate({k * 72} 32 37)"/>'
            for k in range(5)
        )
        + '<circle cx="32" cy="37" r="2.4" fill="#F2C94C"/>',
    ),
    "Bubuk Cokelat": _toples(
        "#5A3622", "#C9A27A", "#F3E2CC",
        '<path d="M25 43.5c1.5-6 12.5-6 14 0z" fill="#7A4A2C"/><circle cx="29" cy="40" r=".9" fill="#7A4A2C"/><circle cx="35.5" cy="39" r=".8" fill="#7A4A2C"/>',
    ),
    "Matcha Bubuk": _toples(
        "#2F6B3A", "#A7C97A", "#EAF4DD",
        '<path d="M25 43.5c1.5-6 12.5-6 14 0z" fill="#6FA84A"/>'
        '<path d="M33 37c0-4 3-6 7-6 0 4-3 6-7 6z" fill="#3E8E41"/>',
    ),
    # --- Susu & Olahan ---
    "Susu UHT Full Cream": (
        '<path d="M20 25h18v29H20z" fill="#fff"/>'
        '<path d="M38 25l7-5v29l-7 5z" fill="#CFDDEE"/>'
        '<path d="M20 25l9-10 9 10z" fill="#EEF3F9"/>'
        '<path d="M29 15l7-4.5 9 9.5-7 5z" fill="#BCD0E8"/>'
        '<path d="M28.5 15.5l7-4.6v-2l-7 4.6z" fill="#9FB9DA"/>'
        '<rect x="20" y="36" width="18" height="11" fill="#2F6FB5"/>'
        '<path d="M38 36l7-5v11l-7 5z" fill="#255C98"/>'
        '<path d="M29 38.5c-2 3-3 4.3-3 5.5a3 3 0 0 0 6 0c0-1.2-1-2.5-3-5.5z" fill="#fff"/>'
    ),
    "Susu Kental Manis": (
        '<rect x="19" y="22" width="26" height="31" rx="3" fill="#E9EEF3"/>'
        '<ellipse cx="32" cy="22" rx="13" ry="3.6" fill="#C7D0DA"/>'
        '<ellipse cx="32" cy="22" rx="10" ry="2.4" fill="#DDE3EA"/>'
        '<rect x="19" y="30" width="26" height="14" fill="#C8372D"/>'
        '<path d="M24 30c0 4 2 6 4 6s2-3 4-3 2 4 4 4 3-3 3-7z" fill="#FFF8E8"/>'
        '<path d="M19 50h26" stroke="#B9C3CE" stroke-width="1.4"/>'
    ),
    "Keju Cheddar": (
        '<path d="M11 37l26-13 15 8-26 14z" fill="#F7C948"/>'
        '<path d="M26 46l26-14v11L26 57z" fill="#E7A622"/>'
        '<path d="M11 37l15 9v11l-15-9z" fill="#F0B530"/>'
        '<ellipse cx="34" cy="31.5" rx="3" ry="1.6" fill="#E3A324"/>'
        '<ellipse cx="22" cy="37" rx="2.2" ry="1.2" fill="#E3A324"/>'
        '<ellipse cx="40" cy="44" rx="2" ry="2.6" fill="#C98714"/>'
        '<ellipse cx="18" cy="49" rx="1.8" ry="2.3" fill="#D99A1C"/>'
    ),
    # --- Pemanis ---
    "Gula Pasir": _karung(
        "#F6F6F3", "#DADAD3", "#F06D8B",
        '<rect x="35" y="42" width="10" height="10" rx="1.6" fill="#fff" stroke="#D5D5CF" stroke-width="1"/>'
        '<rect x="41" y="38" width="9" height="9" rx="1.6" fill="#fff" stroke="#D5D5CF" stroke-width="1"/>',
    ),
    "Gula Aren Cair": (
        '<rect x="18" y="20" width="28" height="34" rx="5" fill="#B5651D"/>'
        '<path d="M23 20v-5h11v5" fill="none" stroke="#8C4A12" stroke-width="3" stroke-linejoin="round"/>'
        '<rect x="38" y="13" width="6" height="7" rx="1.5" fill="#8C4A12"/>'
        '<rect x="22" y="30" width="20" height="15" rx="2" fill="#F6E1C3"/>'
        '<path d="M32 43V34M32 35l-5-3M32 35l5-3M32 38l-5-2.5M32 38l5-2.5" stroke="#5E8C31" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    "Sirup Vanila": (
        '<path d="M28 13h8v6c0 2 6 4 6 9v23a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3V28c0-5 6-7 6-9z" fill="#F1DFA8"/>'
        '<rect x="27" y="9" width="10" height="5.5" rx="1.5" fill="#6B4A2B"/>'
        '<rect x="24.5" y="32" width="15" height="14" rx="2" fill="#fff"/>'
        + "".join(f'<ellipse cx="32" cy="36" rx="1.5" ry="2.8" fill="#F5D76E" transform="rotate({k * 72} 32 38.6)"/>' for k in range(5))
        + '<circle cx="32" cy="38.6" r="1.3" fill="#C78B2E"/>'
    ),
    # --- Bahan Makanan ---
    "Beras": _karung(
        "#EAD9B5", "#CDB88E", "#5E9E4A",
        "".join(f'<ellipse cx="{x}" cy="{y}" rx="1.1" ry="2" fill="#fff" transform="rotate({r} {x} {y})"/>'
                for x, y, r in ((25, 39, 20), (29, 38, -15), (33, 39.5, 30), (37, 38, -10), (40, 40, 15), (27, 41.5, -25), (35, 41.6, 5))),
    ),
    "Minyak Goreng": (
        '<path d="M28 13h8v6l5 6v26a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3V25l5-6z" fill="#F2C230"/>'
        '<path d="M23 31h18v16H23z" fill="#fff"/>'
        '<rect x="27.5" y="9" width="9" height="5.5" rx="1.5" fill="#D64545"/>'
        '<path d="M32 33.5c-2.4 3.4-3.6 5-3.6 6.6a3.6 3.6 0 0 0 7.2 0c0-1.6-1.2-3.2-3.6-6.6z" fill="#F2C230"/>'
        '<path d="M26 22l-2 3" stroke="#FFF2B8" stroke-width="2" stroke-linecap="round"/>'
    ),
    "Tepung Terigu": _karung(
        "#FFFFFF", "#DCDCDC", "#3C78C3",
        '<path d="M32 50V30" stroke="#E2B04A" stroke-width="1.6" stroke-linecap="round"/>'
        + "".join(f'<ellipse cx="{32 + s * 2.6}" cy="{y}" rx="1.6" ry="2.6" fill="#E2B04A" transform="rotate({s * 30} {32 + s * 2.6} {y})"/>'
                  for s in (-1, 1) for y in (33, 37.5, 42))
        + '<ellipse cx="32" cy="29.5" rx="1.5" ry="2.6" fill="#E2B04A"/>',
    ),
    "Roti Tawar": (
        '<path d="M15 30c0-8 6-12 17-12s17 4 17 12c0 3-2 4-3 4v16a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3V34c-1 0-3-1-3-4z" fill="#C9822F"/>'
        '<path d="M19 31c0-6 5-9 13-9s13 3 13 9c0 2-1.5 3-2.5 3v15a2 2 0 0 1-2 2H23.5a2 2 0 0 1-2-2V34c-1 0-2.5-1-2.5-3z" fill="#F7DFAE"/>'
        '<circle cx="28" cy="38" r=".9" fill="#E3BE7E"/><circle cx="35" cy="42" r=".9" fill="#E3BE7E"/><circle cx="31" cy="46" r=".9" fill="#E3BE7E"/>'
    ),
    "Kentang Beku": (
        "".join(f'<rect x="{x}" y="{y}" width="4.2" height="24" rx="1.4" fill="{w}" transform="rotate({r} {x + 2} {y + 12})"/>'
                for x, y, r, w in ((21, 13, -12, "#F6C445"), (26, 10, -4, "#F9D25E"), (31, 11, 5, "#F6C445"), (36, 13, 13, "#F9D25E"), (29, 15, 0, "#EDB534")))
        + '<path d="M17 30h30l-4 24H21z" fill="#D9363E"/>'
        '<path d="M17 30c5 4 25 4 30 0" fill="#B92A31"/>'
        '<path d="M28 41c2.4-1.8 5.6-1.8 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'
    ),
    "Bawang Merah": (
        '<path d="M25 22c-1-4 0-7 1-9M25 22c1-3 3-5 5-6" stroke="#6E8B3D" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
        '<path d="M25 21c-8 5-10 13-6 19 2 4 10 4 12 0 4-6 2-14-6-19z" fill="#B5446E"/>'
        '<path d="M22 27c-2 4-2 8 0 11" stroke="#D97A9E" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
        '<path d="M41 29c-1-4 0-7 1-9" stroke="#6E8B3D" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
        '<path d="M41 28c-8 5-10 13-6 19 2 4 10 4 12 0 4-6 2-14-6-19z" fill="#9C3459"/>'
        '<path d="M38 34c-2 4-2 8 0 11" stroke="#C5628A" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    ),
    "Cabai Merah": (
        '<path d="M20 18c-2-3 0-6 3-6" stroke="#4E8A2E" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
        '<path d="M18 20c4-3 8-1 8 4 0 10-4 22-12 28-2 1-3 0-2-2 4-8 4-20 6-30z" fill="#D7263D"/>'
        '<path d="M18 20c3-2 6-1 7 2" stroke="#4E8A2E" stroke-width="3" fill="none" stroke-linecap="round"/>'
        '<path d="M37 21c-1-3 1-6 4-6" stroke="#4E8A2E" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
        '<path d="M35 23c4-2 8 0 8 5 0 9-6 19-14 24-2 1-3-1-2-2 5-7 7-18 8-27z" fill="#B8172D"/>'
        '<path d="M35 23c3-2 6-1 7 2" stroke="#4E8A2E" stroke-width="3" fill="none" stroke-linecap="round"/>'
        '<path d="M21 26c0 6-1 12-3 17" stroke="#F27A86" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
    ),
    # --- Protein ---
    "Telur Ayam": (
        '<path d="M10 40h44l-4 12H14z" fill="#B68D5C"/>'
        '<path d="M10 40c4 3 7 3 11 0 4 3 7 3 11 0 4 3 7 3 11 0 4 3 7 3 11 0" fill="#9E7647"/>'
        '<ellipse cx="20" cy="33" rx="6.5" ry="8.4" fill="#E2B88A"/>'
        '<ellipse cx="32" cy="31" rx="6.5" ry="8.4" fill="#D29E6C"/>'
        '<ellipse cx="44" cy="33" rx="6.5" ry="8.4" fill="#E2B88A"/>'
        '<ellipse cx="18" cy="30" rx="1.6" ry="2.6" fill="#fff" opacity=".7"/>'
        '<ellipse cx="42" cy="30" rx="1.6" ry="2.6" fill="#fff" opacity=".7"/>'
    ),
    "Ayam Potong": (
        '<path d="M35 36l9 9" stroke="#D8C9B8" stroke-width="7" stroke-linecap="round"/>'
        '<circle cx="46.5" cy="44" r="4" fill="#D8C9B8"/><circle cx="43" cy="48" r="4" fill="#D8C9B8"/>'
        '<path d="M35 36l9 9" stroke="#FBF7F1" stroke-width="4.6" stroke-linecap="round"/>'
        '<circle cx="46.5" cy="44" r="2.8" fill="#FBF7F1"/><circle cx="43" cy="48" r="2.8" fill="#FBF7F1"/>'
        '<path d="M15 18c6-7 18-6 22 2 3 6 1 12-3 16l-3 2c-5 3-11 2-15-2-5-5-6-12-1-18z" fill="#D9843F"/>'
        '<path d="M19 20c3-4 10-5 14-1" stroke="#F0B47A" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
        '<path d="M18 30c2 3 5 5 9 5" stroke="#C06F2E" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    ),
    "Daging Sapi": (
        '<path d="M14 34c0-10 9-17 21-17 9 0 16 6 16 14 0 12-12 20-24 20-8 0-13-7-13-17z" fill="#F2D3C4"/>'
        '<path d="M18 34c0-8 7-13 17-13 7 0 12 4 12 10 0 9-9 16-19 16-6 0-10-5-10-13z" fill="#C0392B"/>'
        '<path d="M26 30c4-2 9-2 12 1M24 38c4 2 9 2 13-1" stroke="#E07A6E" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
        '<circle cx="39" cy="33" r="3.2" fill="#F7EDE6"/>'
    ),
    # --- Kemasan ---
    "Gelas Plastik 16 oz": _gelas_plastik(28, 6),
    "Gelas Plastik 22 oz": _gelas_plastik(20, 6),
    "Sedotan Kertas": (
        "".join(
            f'<g transform="rotate({r} 32 50)"><rect x="{x}" y="10" width="4.4" height="34" rx="2" fill="#fff"/>'
            + "".join(f'<path d="M{x} {y}l4.4-3v3.4l-4.4 3z" fill="{w}"/>' for y in range(15, 44, 6))
            + "</g>"
            for x, r, w in ((24, -14, "#E5484D"), (29.8, 0, "#2F9E6A"), (35.6, 14, "#3C78C3"))
        )
        + '<path d="M21 40h22l-2.5 14h-17z" fill="#C8A57A"/>'
        '<path d="M21 40h22v3H21z" fill="#B48F62"/>'
    ),
    "Kantong Plastik": (
        '<path d="M24 22c0-8 4-11 8-11s8 3 8 11" fill="none" stroke="#C4CBD4" stroke-width="3" stroke-linecap="round"/>'
        '<path d="M16 22h32l2 28a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#FAFBFC" stroke="#C4CBD4" stroke-width="1.4"/>'
        '<path d="M22 28c2 6 0 14 1 20M42 28c-2 6 0 14-1 20" stroke="#DDE2E8" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
        '<circle cx="32" cy="38" r="5" fill="#E5484D" opacity=".85"/>'
    ),
    "Cup Sealer Film": (
        '<path d="M22 22h20v30H22z" fill="#E7EEF6"/>'
        '<ellipse cx="32" cy="22" rx="10" ry="4" fill="#C9D7E6"/>'
        '<ellipse cx="32" cy="22" rx="3" ry="1.3" fill="#8DA2B8"/>'
        '<ellipse cx="32" cy="52" rx="10" ry="4" fill="#D5E1EE"/>'
        '<path d="M42 30l10 4v20l-10-4z" fill="#F4F8FC" stroke="#C9D7E6" stroke-width="1"/>'
        '<circle cx="46.5" cy="39" r="2.4" fill="#F2C94C"/><circle cx="46.5" cy="46.5" r="2.4" fill="#E5484D"/>'
        '<path d="M22 30h20M22 38h20M22 46h20" stroke="#D5E1EE" stroke-width="1.2"/>'
    ),
    # --- Pendukung ---
    "Es Batu Kristal": (
        '<path d="M14 36l10-5 10 5-10 5z" fill="#E9F8FD"/><path d="M14 36l10 5v12l-10-5z" fill="#BFE7F5"/><path d="M24 41l10-5v12l-10 5z" fill="#99D7EE"/>'
        '<path d="M30 36l10-5 10 5-10 5z" fill="#E9F8FD"/><path d="M30 36l10 5v12l-10-5z" fill="#BFE7F5"/><path d="M40 41l10-5v12l-10 5z" fill="#99D7EE"/>'
        '<path d="M22 22l10-5 10 5-10 5z" fill="#F4FCFE"/><path d="M22 22l10 5v12l-10-5z" fill="#CBEEF8"/><path d="M32 27l10-5v12l-10 5z" fill="#A9DFF2"/>'
        '<path d="M25 25.5l2 1M17 39l2 1" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    "Air Mineral Galon": (
        '<rect x="27" y="9" width="10" height="6" rx="1.5" fill="#1F6FB2"/>'
        '<path d="M28 15h8v4c8 1 12 5 12 11v19a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V30c0-6 4-10 12-11z" fill="#9FD3F2"/>'
        '<path d="M16 34h32M16 44h32" stroke="#7DBBE3" stroke-width="2"/>'
        '<path d="M21 28c1-3 3-4.5 6-5" stroke="#E6F5FD" stroke-width="2" fill="none" stroke-linecap="round"/>'
        '<rect x="22" y="36.5" width="20" height="5" rx="1.5" fill="#fff" opacity=".85"/>'
    ),
    "Tisu Makan": (
        '<path d="M14 32l18-8 18 8v16l-18 8-18-8z" fill="#5BA4CF"/>'
        '<path d="M14 32l18 8 18-8" fill="none" stroke="#3F86B3" stroke-width="1.2"/>'
        '<path d="M14 32l18 8v16l-18-8z" fill="#4A93BF"/>'
        '<path d="M26 31c0-6 3-11 6-14 3 3 6 8 6 14-4 2-8 2-12 0z" fill="#fff" stroke="#DCE3EA" stroke-width="1"/>'
    ),
}


def _toples_sambal(isi: str, kilap: str, label_isi: str) -> str:
    """Toples kaca 200 ml berisi sambal, tutup kotak-kotak merah putih."""
    return (
        '<path d="M20 24h24v25a5 5 0 0 1-5 5H25a5 5 0 0 1-5-5z" fill="#F4FAFD" opacity=".9"/>'
        f'<path d="M21.5 30h21v19a3.6 3.6 0 0 1-3.6 3.6H25.1a3.6 3.6 0 0 1-3.6-3.6z" fill="{isi}"/>'
        f'<path d="M24 32c3-1 6 1 9 0s6-1 8 0" stroke="{kilap}" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
        '<rect x="18" y="15" width="28" height="10" rx="2.5" fill="#D9363E"/>'
        + "".join(f'<rect x="{18 + 4 * i}" y="{15 + (i % 2) * 5}" width="4" height="5" fill="#fff" opacity=".85"/>' for i in range(7))
        + '<rect x="24" y="36" width="16" height="11" rx="2" fill="#FFF6E5"/>'
        + label_isi
    )


PRODUK.update({
    # --- Bahan baku tambahan untuk UMKM produsen ---
    "Bawang Putih": (
        '<path d="M32 15c-1 4-1 6 0 8" stroke="#9BA88A" stroke-width="2" fill="none" stroke-linecap="round"/>'
        '<path d="M32 22c-11 2-17 10-15 19 2 8 10 12 15 12s13-4 15-12c2-9-4-17-15-19z" fill="#FDFBF7" stroke="#B9A27E" stroke-width="1.6"/>'
        '<path d="M32 23c-4 5-5 17 0 29M32 23c4 5 5 17 0 29M32 23c-9 4-13 14-9 27M32 23c9 4 13 14 9 27" stroke="#C9B28C" stroke-width="1.4" fill="none"/>'
        '<path d="M24 30c-2 4-2 9 0 13" stroke="#C9A3C4" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>'
        '<path d="M26 50c2 2 4 3 6 3s4-1 6-3" stroke="#C9B48F" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
    ),
    "Teri Nasi": (
        '<path d="M12 40h40c0 8-9 14-20 14s-20-6-20-14z" fill="#6E8FA8"/>'
        '<path d="M12 40h40" stroke="#5A7891" stroke-width="2"/>'
        + "".join(
            f'<g transform="translate({x} {y}) rotate({r})"><ellipse rx="6" ry="1.7" fill="#C9D3DC"/>'
            f'<path d="M5.5 0l3-2v4z" fill="#AEBAC6"/><circle cx="-4.2" cy="-.3" r=".6" fill="#3A4652"/></g>'
            for x, y, r in ((24, 34, -15), (34, 31, 10), (41, 36, -5), (28, 38, 8), (37, 39, -20), (20, 39, 25), (31, 27, -8))
        )
    ),
    "Garam Dapur": (
        '<path d="M19 18h26l2 34a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2z" fill="#fff" stroke="#D5DCE4" stroke-width="1.2"/>'
        '<path d="M19 18l2-5h22l2 5z" fill="#E9EEF3"/>'
        '<rect x="19" y="28" width="26" height="14" fill="#2F6FB5"/>'
        + "".join(f'<rect x="{x}" y="{y}" width="3.2" height="3.2" rx=".6" fill="#fff" transform="rotate(20 {x} {y})"/>'
                  for x, y in ((25, 32), (31, 31), (37, 33), (28, 37), (34, 37)))
    ),
    "Toples Kaca 200 ml": (
        '<path d="M20 24h24v25a5 5 0 0 1-5 5H25a5 5 0 0 1-5-5z" fill="#DDEFFB" stroke="#9CC3E0" stroke-width="1.4"/>'
        '<path d="M24 30v18" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>'
        '<rect x="18" y="15" width="28" height="10" rx="2.5" fill="#C9A227"/>'
        '<path d="M18 20h28" stroke="#A88514" stroke-width="1.2"/>'
        '<path d="M44 40h6M44 46h4" stroke="#9CC3E0" stroke-width="1.6" stroke-linecap="round"/>'
    ),
    # --- Barang jadi UMKM produsen ---
    "Sambal Bawang": _toples_sambal(
        "#C8321E", "#F07A4F",
        '<circle cx="29" cy="41.5" r="3" fill="#F3EBDD" stroke="#C9B48F" stroke-width=".8"/>'
        '<path d="M34 44c2-4 4-5 6-5" stroke="#D7263D" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
    ),
    "Sambal Goreng Teri": _toples_sambal(
        "#9E2A17", "#D9653F",
        '<g transform="translate(32 41.5)"><ellipse rx="5.5" ry="1.8" fill="#8FA3B5"/>'
        '<path d="M5 0l3-2v4z" fill="#8FA3B5"/><circle cx="-3.8" cy="-.3" r=".6" fill="#2E3A46"/></g>',
    ),
})


def gambar_produk(nama: str, kategori: str) -> str:
    return svg(f'<rect width="64" height="64" rx="14" fill="{UBIN[kategori]}"/>{BAYANGAN}{PRODUK[nama]}')


# --------------------------------------------------------------------------
# Logo distributor: digambar tangan, warna sama dengan warna di basis data
# --------------------------------------------------------------------------

_DASAR = '<rect width="64" height="64" rx="16" fill="{w}"/>'

LOGO_DISTRIBUTOR: dict[str, str] = {
    # Sumber Tani Nusantara: tunas di atas tanah, matahari pagi.
    "Sumber Tani Nusantara": _DASAR.format(w="#0f766e")
    + '<circle cx="45" cy="18" r="6" fill="#99F6E4"/>'
    '<path d="M32 49V30" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'
    '<path d="M31 37c-9 0-14-5-14-12 8 0 14 4 14 12z" fill="#fff"/>'
    '<path d="M33 31c0-8 5-13 13-13 0 8-5 13-13 13z" fill="#CCFBF1"/>'
    '<path d="M16 50h32" stroke="#99F6E4" stroke-width="3.2" stroke-linecap="round"/>',
    # Dairy Prima Jaya: botol susu.
    "Dairy Prima Jaya": _DASAR.format(w="#1d4ed8")
    + '<path d="M27 15h10v6l5 7v19a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3V28l5-7z" fill="#fff"/>'
    '<rect x="26" y="11" width="12" height="5.5" rx="1.6" fill="#BFDBFE"/>'
    '<path d="M22 37c4-3 7 2 10 0s7-3 10 0v10a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3z" fill="#BFDBFE"/>'
    '<path d="M25.5 29l2-3" stroke="#BFDBFE" stroke-width="2" stroke-linecap="round"/>',
    # Manis Sejahtera: dua kubus gula dan kilau.
    "Manis Sejahtera": _DASAR.format(w="#b45309")
    + '<path d="M31 26l10-5 10 5-10 5z" fill="#FEF3C7"/><path d="M31 26l10 5v12l-10-5z" fill="#fff"/><path d="M41 31l10-5v12l-10 5z" fill="#FCD9A1"/>'
    '<path d="M16 36l10-5 10 5-10 5z" fill="#FEF3C7"/><path d="M16 36l10 5v12l-10-5z" fill="#fff"/><path d="M26 41l10-5v12l-10 5z" fill="#FCD9A1"/>'
    '<path d="M20 12l1.8 4.6 4.6 1.8-4.6 1.8L20 24.8l-1.8-4.6-4.6-1.8 4.6-1.8z" fill="#FDE68A"/>',
    # Kemasan Andalan: kardus berselotip.
    "Kemasan Andalan": _DASAR.format(w="#4a3aa7")
    + '<path d="M14 26l18-9 18 9-18 9z" fill="#EDE9FE"/>'
    '<path d="M14 26l18 9v19l-18-9z" fill="#fff"/>'
    '<path d="M32 35l18-9v19l-18 9z" fill="#C4B5FD"/>'
    '<path d="M21.5 22.2l18 9 3.4-1.7-18-9z" fill="#8B7FD6"/>'
    '<path d="M39.5 31.2v7.4l3.4-1.7v-7.4z" fill="#7466C8"/>',
    # Es Segar Mandiri: kristal salju.
    "Es Segar Mandiri": _DASAR.format(w="#0e7490")
    + "".join(
        f'<g transform="rotate({k * 60} 32 32)"><path d="M32 32V13.5M27 17.5l5 4 5-4M28.4 24.5l3.6 2.8 3.6-2.8" '
        f'stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'
        for k in range(6)
    )
    + '<circle cx="32" cy="32" r="4" fill="#A5F3FC"/>',
    # Pangan Harian Sejati: semangkuk nasi.
    "Pangan Harian Sejati": _DASAR.format(w="#9a3412")
    + '<path d="M16 33c0-9 7-14 16-14s16 5 16 14z" fill="#fff"/>'
    + "".join(f'<ellipse cx="{x}" cy="{y}" rx="1" ry="1.9" fill="#FED7AA" transform="rotate({r} {x} {y})"/>'
              for x, y, r in ((24, 28, 20), (29, 24.5, -20), (35, 25, 25), (40, 29, -10), (31, 29.5, 10)))
    + '<path d="M13 33h38c0 10-8 17-19 17S13 43 13 33z" fill="#FED7AA"/>'
    '<rect x="25" y="49" width="14" height="3.2" rx="1.6" fill="#FED7AA"/>'
    '<path d="M18 37c3 6 8 9 14 9" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>',
    # Kopi Rakyat Merapi: gunung berasap dan sebutir kopi.
    "Kopi Rakyat Merapi": _DASAR.format(w="#166534")
    + '<path d="M8 51l17-25h8l4 6 4-4 15 23z" fill="#fff"/>'
    '<path d="M25 26h8l-2.5 6-2-2-2.5 3-2-3z" fill="#BBF7D0"/>'
    '<circle cx="27" cy="19" r="3.4" fill="#BBF7D0"/><circle cx="32" cy="15.5" r="4.2" fill="#BBF7D0"/><circle cx="37" cy="18.5" r="3" fill="#BBF7D0"/>'
    '<g transform="translate(47 15) rotate(30)"><ellipse rx="4.2" ry="5.8" fill="#FDE68A"/>'
    '<path d="M-1.2-5c2.4 2.2-.8 6 1.4 10" stroke="#166534" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>',
    # Matcha House Supply: rumah dengan daun teh di dalamnya.
    "Matcha House Supply": _DASAR.format(w="#15803d")
    + '<path d="M13 31l19-16 19 16" fill="none" stroke="#BBF7D0" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'
    '<path d="M18 30l14-11.5L46 30v19a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2z" fill="#fff"/>'
    '<path d="M24 46c0-9 6-14 16-14 0 9-6 14-16 14z" fill="#15803d"/>'
    '<path d="M26.5 44l10-9" stroke="#BBF7D0" stroke-width="1.6" stroke-linecap="round"/>',
}


# --------------------------------------------------------------------------
# Logo UMKM: piktogram jenis usaha di dalam lambang yang dipilih dari hash nama
# --------------------------------------------------------------------------
# Piktogram digambar di kotak 28x28, putih di atas warna dasar; `{a}` adalah
# warna aksen (muda) dan `{d}` warna dasar, untuk lubang dan garis dalam.

PIKTOGRAM: dict[str, str] = {
    "cangkir": '<path d="M3 11h17v7a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7z" fill="#fff"/>'
    '<path d="M20 13h1.5a3.5 3.5 0 0 1 0 7H20" fill="none" stroke="#fff" stroke-width="2.4"/>'
    '<rect x="1" y="25" width="23" height="2.6" rx="1.3" fill="{a}"/>'
    '<path d="M8.5 8c-2-2 2-3 0-6M14 8c-2-2 2-3 0-6" stroke="{a}" stroke-width="1.9" fill="none" stroke-linecap="round"/>',
    "biji": '<g transform="translate(14 14) rotate(30)"><ellipse rx="9" ry="12.5" fill="#fff"/>'
    '<path d="M-2.4-11c4.8 4.4-1.6 12 2.8 22" stroke="{d}" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>',
    "presso": '<path d="M13 1v6" stroke="{a}" stroke-width="1.8" stroke-linecap="round"/><circle cx="13" cy="1.6" r="1.8" fill="{a}"/>'
    '<rect x="5" y="6" width="16" height="3" rx="1.2" fill="{a}"/><rect x="6" y="9" width="14" height="16" rx="1.5" fill="#fff"/>'
    '<rect x="7.6" y="16" width="10.8" height="7.6" rx="1" fill="{d}" opacity=".45"/>'
    '<path d="M20 11.5h2.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H20" stroke="#fff" stroke-width="2.2" fill="none"/>'
    '<rect x="4" y="25" width="18" height="2.4" rx="1.2" fill="{a}"/>',
    "es-kopi": '<path d="M6 9h16l-2.2 18H8.2z" fill="#fff"/><path d="M7 16h14l-1.4 11H8.4z" fill="{a}"/>'
    '<rect x="5" y="6.5" width="18" height="3" rx="1.5" fill="#fff"/><path d="M16 7l3.5-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    "es-teh": '<path d="M5 5h18l-2.4 22H7.4z" fill="#fff"/>'
    '<rect x="9" y="12" width="5" height="5" rx="1" fill="{a}" transform="rotate(-12 11.5 14.5)"/>'
    '<rect x="14" y="17" width="5" height="5" rx="1" fill="{a}" transform="rotate(10 16.5 19.5)"/>'
    '<circle cx="21" cy="6" r="4.2" fill="{a}"/><circle cx="21" cy="6" r="2.4" fill="#fff"/>'
    '<path d="M12 5l-3-5" stroke="{a}" stroke-width="2" stroke-linecap="round"/>',
    "teko": '<path d="M4 13h19c0 7-4 12-9.5 12S4 20 4 13z" fill="#fff"/><path d="M8 13c0-4 2.5-6 5.5-6s5.5 2 5.5 6z" fill="#fff"/>'
    '<circle cx="13.5" cy="5" r="1.7" fill="{a}"/><path d="M22 16l5-5" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>'
    '<path d="M5 15.5c-4.2 0-4.2 6 0 6" stroke="{a}" stroke-width="2" fill="none"/><rect x="4" y="12.4" width="19" height="1.6" fill="{a}"/>',
    "botol-susu": '<path d="M10 3h8v4l3.5 4.5V25a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V11.5L10 7z" fill="#fff"/>'
    '<rect x="9.5" y="1" width="9" height="3.4" rx="1.2" fill="{a}"/><path d="M6.5 16c3-2 5 1.4 7.5 0s5-2 7.5 0V20h-15z" fill="{a}"/>',
    "matcha": '<path d="M2 15h24c0 7-5 12-12 12S2 22 2 15z" fill="#fff"/>'
    '<path d="M8 12c0-6 5-10 12-10 0 6-5 10-12 10z" fill="{a}"/><path d="M10 10.5l7-6" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
    "jus": '<path d="M6 7h16l-2.4 20H8.4z" fill="#fff"/><path d="M7 13h14l-1.6 14H8.6z" fill="{a}"/>'
    '<circle cx="20" cy="7" r="5" fill="{a}"/><path d="M20 7l-3.5-3.5M20 7h-5M20 7l-3.5 3.5" stroke="#fff" stroke-width="1.2"/>'
    '<path d="M11 7L9 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
    "mi": '<path d="M2 14h24c0 7-5 12-12 12S2 21 2 14z" fill="#fff"/>'
    '<path d="M6 14c0-4 2-4 2 0M10 14c0-5 2-5 2 0M14 14c0-4 2-4 2 0M18 14c0-5 2-5 2 0" stroke="{a}" stroke-width="1.6" fill="none"/>'
    '<path d="M15 10L26 1M19 11L27.5 4" stroke="{a}" stroke-width="2" stroke-linecap="round"/>',
    "piring": '<circle cx="14" cy="14" r="9" fill="#fff"/><circle cx="14" cy="14" r="5.6" fill="none" stroke="{a}" stroke-width="1.6"/>'
    '<path d="M1.5 4v6.5a2 2 0 0 0 4 0V4M3.5 10v15" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    '<ellipse cx="25" cy="8" rx="2.4" ry="4" fill="#fff"/><path d="M25 11v14" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    "ceret": '<path d="M7 11h13l2 14H5z" fill="#fff"/><path d="M8 11c0-3 2.5-5 5.5-5s5.5 2 5.5 5z" fill="#fff"/>'
    '<circle cx="13.5" cy="4.6" r="1.6" fill="{a}"/><path d="M21 17l5-6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'
    '<path d="M8.5 9C5 5 22 5 18.5 9" stroke="{a}" stroke-width="1.6" fill="none"/>'
    '<path d="M2 27h24" stroke="{a}" stroke-width="2.2" stroke-linecap="round"/>',
    "nasi": '<ellipse cx="14" cy="23.5" rx="13" ry="3.6" fill="{a}"/>'
    '<path d="M14 1c-2.6 0-8 13-9.4 21h18.8C22 14 16.6 1 14 1z" fill="#fff"/>'
    '<path d="M6.6 17.5c4.6 1.6 10.2 1.6 14.8 0" stroke="{a}" stroke-width="1.6" fill="none"/>'
    '<circle cx="11" cy="12" r="1" fill="{d}"/><circle cx="16" cy="9" r="1" fill="{d}"/><circle cx="15.5" cy="14" r="1" fill="{d}"/>',
    "kuali": '<path d="M2 12h24c0 6-5 10-12 10S2 18 2 12z" fill="#fff"/><path d="M26 13h2M0 13h2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'
    '<path d="M8 27c0-3 2-3 2-6M14 27c0-3 2-3 2-6M20 27c0-3 2-3 2-6" stroke="{a}" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
    '<path d="M9 9c0-2 1.5-2 1.5-4M14 9c0-2 1.5-2 1.5-4M19 9c0-2 1.5-2 1.5-4" stroke="{a}" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
    "roti": '<path d="M2 14c0-6 5-9 12-9s12 3 12 9c0 2-1 3-2 3v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8c-1 0-2-1-2-3z" fill="#fff"/>'
    '<path d="M9 9.5l2 3M14 8.5l2 3M19 9.5l2 3" stroke="{a}" stroke-width="1.8" stroke-linecap="round"/>',
    "kue": '<path d="M3 15h22v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#fff"/><path d="M3 19h22" stroke="{a}" stroke-width="2"/>'
    '<path d="M3 15c2 3 4 3 5.5 0 1.5 3 4 3 5.5 0 1.5 3 4 3 5.5 0 1.5 3 4 3 5.5 0" fill="{a}"/>'
    '<path d="M14 15V9" stroke="#fff" stroke-width="1.6"/><path d="M14 4c-1.4 1.8-2 2.8-2 3.8a2 2 0 0 0 4 0c0-1-.6-2-2-3.8z" fill="{a}"/>',
    "croissant": '<path d="M2 18c2-8 7-12 12-12s10 4 12 12c-2 2-5 1-6-1-1 4-4 5-6 5s-5-1-6-5c-1 2-4 3-6 1z" fill="#fff"/>'
    '<path d="M9 11l2.4 6M14 9.4V17M19 11l-2.4 6" stroke="{a}" stroke-width="1.8" stroke-linecap="round"/>',
    "cupcake": '<path d="M6 16h16l-2.4 10H8.4z" fill="{a}"/><path d="M10 16l.8 10M14 16v10M18 16l-.8 10" stroke="#fff" stroke-width="1.2"/>'
    '<path d="M5 16c-2-5 2-8 5-7 1-4 7-4 8 0 3-1 7 2 5 7z" fill="#fff"/><circle cx="14" cy="4" r="2.4" fill="{a}"/>',
    "toko": '<path d="M3 12h22v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#fff"/>'
    '<path d="M1 4h26l-1 8c-1.4 2-3.6 2-5 0-1.4 2-3.6 2-5 0-1.4 2-3.6 2-5 0-1.4 2-3.6 2-5 0-1.4 2-3.6 2-5 0z" fill="{a}"/>'
    '<path d="M6.2 4L5.6 11M11.4 4L11.2 11M16.6 4l.2 7M21.8 4l.6 7" stroke="#fff" stroke-width="1.4"/>'
    '<rect x="11" y="17" width="6" height="9" rx="1" fill="{a}"/>',
    "keranjang": '<path d="M7 11l5-9M21 11l-5-9" stroke="{a}" stroke-width="2.2" stroke-linecap="round"/>'
    '<rect x="1" y="10" width="26" height="4" rx="1.5" fill="#fff"/><path d="M3 14h22l-2.4 11a2 2 0 0 1-2 1.6H7.4a2 2 0 0 1-2-1.6z" fill="#fff"/>'
    '<path d="M9 17.5v6M14 17.5v6M19 17.5v6" stroke="{a}" stroke-width="2" stroke-linecap="round"/>',
    "tas": '<path d="M9 10V7a5 5 0 0 1 10 0v3" stroke="{a}" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    '<path d="M4 9h20l1.6 16a2 2 0 0 1-2 2.2H4.4a2 2 0 0 1-2-2.2z" fill="#fff"/>'
    '<path d="M10 17c1.4 2.4 6.6 2.4 8 0" stroke="{a}" stroke-width="2" fill="none" stroke-linecap="round"/>',
    "sambal": '<path d="M6 9h16v15a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#fff"/><rect x="4.5" y="4.5" width="19" height="5" rx="1.6" fill="{a}"/>'
    '<path d="M9.5 14c3-2 6 0 6 3 0 4-3 7-6 7-1 0-1-1-.4-1.6 1.4-2 1.4-5 .4-8.4z" fill="{d}"/>'
    '<path d="M10 14c0-2 1-3 3-3" stroke="{d}" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
}

PALET: dict[str, tuple[tuple[str, str], ...]] = {
    "kopi": (("#6F4E37", "#E2C3A0"), ("#4B3621", "#D9B48F"), ("#8C5A3C", "#F0D2B0"), ("#2F5D50", "#B9D9C9"), ("#7A3E2B", "#F2C6A8")),
    "minuman": (("#0E7C86", "#A5E9EE"), ("#2E7D32", "#BDE8B5"), ("#C2185B", "#F8C4D8"), ("#1565C0", "#BBDBFB"), ("#5E7F1C", "#E0F0B0")),
    "makan": (("#B23A2E", "#F7C2B8"), ("#B85600", "#FFD8A8"), ("#8E3B46", "#F2C1C8"), ("#3D6B35", "#CDE8C4"), ("#A0522D", "#F3D1B5")),
    "roti": (("#A85B17", "#F8DDB8"), ("#AD1457", "#F8C8DC"), ("#7B5E54", "#EAD8CF"), ("#B36A00", "#FFE0A3")),
    "kelontong": (("#1E5AA8", "#BFD7F5"), ("#2E7D5B", "#BFE8D3"), ("#6A3FA0", "#DCCBF2"), ("#B0412E", "#F5C9BF")),
    "produksi": (("#C62828", "#FFCDD2"), ("#BF360C", "#FFCCBC")),
}

JENIS_KE_KELOMPOK = {
    JenisUsaha.KEDAI_KOPI: "kopi",
    JenisUsaha.KEDAI_MINUMAN: "minuman",
    JenisUsaha.WARUNG_MAKAN: "makan",
    JenisUsaha.ROTI_KUE: "roti",
    JenisUsaha.WARUNG_KELONTONG: "kelontong",
}

#: Piktogram dipilih dari kata di nama dulu (yang paling cocok), baru dari hash.
_KATA: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("sambal", ("sambal",)),
    ("matcha", ("matcha",)),
    ("susu", ("botol-susu",)),
    ("es teh", ("es-teh",)),
    ("teh", ("teko", "es-teh")),
    ("minuman segar", ("jus",)),
    ("bakmi", ("mi",)),
    ("warmindo", ("mi",)),
    ("angkringan", ("ceret",)),
    ("gudeg", ("nasi",)),
    ("sego", ("nasi",)),
    ("warung makan", ("piring", "kuali")),
    ("roti", ("roti",)),
    ("bakery", ("croissant", "roti")),
    ("kue", ("kue", "cupcake")),
    ("madura", ("toko",)),
    ("sembako", ("keranjang",)),
    ("kelontong", ("tas", "toko", "keranjang")),
)
_CADANGAN = {
    "kopi": ("cangkir", "biji", "presso", "es-kopi"),
    "minuman": ("es-teh", "jus", "teko"),
    "makan": ("piring", "kuali", "nasi", "mi"),
    "roti": ("roti", "kue", "croissant", "cupcake"),
    "kelontong": ("toko", "keranjang", "tas"),
    "produksi": ("sambal",),
}

_BENTUK = (
    ('<circle cx="32" cy="32" r="31" fill="{d}"/>', 26),
    ('<rect x="1" y="1" width="62" height="62" rx="17" fill="{d}"/>', 25),
    ('<path d="M32 2l27 10v19c0 16-11 27-27 31C16 58 5 47 5 31V12z" fill="{d}"/>', 21),
    ('<path d="M32 1.5l27 15.5v30L32 62.5 5 47V17z" fill="{d}"/>', 22),
)


def logo_umkm(nama: str, kelompok: str) -> str:
    h = fnv1a(nama)
    bentuk, r = _BENTUK[h % len(_BENTUK)]
    d, a = PALET[kelompok][(h >> 3) % len(PALET[kelompok])]
    kecil = nama.lower()
    pilihan = next((p for kata, p in _KATA if kata in kecil), _CADANGAN[kelompok])
    pikto = pilihan[(h >> 11) % len(pilihan)]
    hiasan = (h >> 7) % 3
    if hiasan == 0:
        aksen = f'<circle cx="32" cy="32" r="{r}" fill="none" stroke="{a}" stroke-width="1.6" stroke-dasharray="3 3"/>'
    elif hiasan == 1:
        aksen = f'<circle cx="32" cy="32" r="{r}" fill="none" stroke="{a}" stroke-width="1.4" opacity=".7"/>'
    else:
        aksen = "".join(f'<circle cx="{x}" cy="{y}" r="1.7" fill="{a}"/>' for x, y in ((25, 51), (32, 53), (39, 51)))
    isi = PIKTOGRAM[pikto].replace("{a}", a).replace("{d}", d)
    return svg(bentuk.replace("{d}", d) + aksen + f'<g transform="translate(18 16)">{isi}</g>')


# --------------------------------------------------------------------------


def main() -> None:
    KELUAR_PRODUK.mkdir(parents=True, exist_ok=True)
    KELUAR_LOGO.mkdir(parents=True, exist_ok=True)

    produk: dict[str, str] = {}
    semua = [(p.nama, p.kategori) for p in (*KATALOG, *KATALOG_TAMBAHAN)]
    semua += [(pj.nama, "Produk Jadi") for pj in PRODUK_JADI]
    for nama, kategori in semua:
        berkas = f"{slug(nama)}.svg"
        (KELUAR_PRODUK / berkas).write_text(gambar_produk(nama, kategori), encoding="utf-8")
        produk[nama] = berkas

    logo: dict[str, str] = {}
    for d in DISTRIBUTOR:
        berkas = f"{slug(d.nama)}.svg"
        (KELUAR_LOGO / berkas).write_text(svg(LOGO_DISTRIBUTOR[d.nama]), encoding="utf-8")
        logo[d.nama] = berkas
    for nama, jenis in [(u.nama, u.jenis) for u in UMKM] + [(NAMA_PRODUSEN, JENIS_PRODUSEN)]:
        berkas = f"{slug(nama)}.svg"
        kelompok = JENIS_KE_KELOMPOK.get(jenis, "produksi")
        (KELUAR_LOGO / berkas).write_text(logo_umkm(nama, kelompok), encoding="utf-8")
        logo[nama] = berkas

    baris = [
        "/**",
        " * Daftar gambar produk dan logo toko yang tersedia di `public/gambar`.",
        " *",
        " * JANGAN DIUBAH TANGAN: ditulis oleh `tools/buat_gambar.py`.",
        " */",
        "",
        "/** Nama produk baku → berkas di `/gambar/produk/`. */",
        "export const GAMBAR_PRODUK: Record<string, string> = {",
        *(f"  {n!r}: {b!r}," for n, b in produk.items()),
        "}",
        "",
        "/** Nama toko (UMKM dan distributor) → berkas di `/gambar/logo/`. */",
        "export const LOGO_TOKO: Record<string, string> = {",
        *(f"  {n!r}: {b!r}," for n, b in logo.items()),
        "}",
        "",
    ]
    DAFTAR_TS.write_text("\n".join(baris), encoding="utf-8")
    print(f"{len(produk)} gambar produk, {len(logo)} logo toko, daftar: {DAFTAR_TS.relative_to(AKAR)}")


if __name__ == "__main__":
    main()
