# Bahan rebrand — Warungku → Turnify Flow

> Disiapkan semalam sesuai pesan dari Ilham (brief disusun sesi Warungku #2), 12 Oktober 2026.
> **Status: bahan saja, belum ada kode yang disentuh.** `src/` tidak diubah, tidak ada commit.
> Tiga bagian di bawah persis mengikuti tiga poin di brief: (1) inventaris teks "Warungku"
> yang terlihat pengguna, (2) acuan tata letak majoo via `design-taste-breakdown`, (3) usulan
> token warna ungu.

---

## 1. Inventaris teks "Warungku" yang terlihat pengguna

Dicari dengan `grep -rn warungku src/ index.html` (tanpa peka huruf besar/kecil), lalu dipilah
mana yang benar-benar tampil ke pengguna vs. nama internal. **18 titik terlihat pengguna**, di
7 berkas + `index.html`. Format: `path:baris`.

### Terlihat pengguna — perlu diganti

| # | Lokasi | Teks saat ini | Konteks |
|---|---|---|---|
| 1 | [index.html:17](../index.html#L17) | `<title>Warungku - Stok & Pengadaan UMKM</title>` | Judul tab peramban |
| 2 | [src/layouts/KerangkaAplikasi.tsx:91](../src/layouts/KerangkaAplikasi.tsx#L91) | `Warungku` | Nama aplikasi di rail desktop |
| 3 | [src/layouts/KerangkaAplikasi.tsx:144](../src/layouts/KerangkaAplikasi.tsx#L144) | `Warungku` | Nama aplikasi di header mobile |
| 4 | [src/pages/akun/Akun.tsx:267](../src/pages/akun/Akun.tsx#L267) | `Warungku untuk Pemilik Usaha · versi purwarupa` | Footer halaman Akun |
| 5 | [src/pages/akun/AkunKasir.tsx:88](../src/pages/akun/AkunKasir.tsx#L88) | `Warungku berdiri terpisah dari aplikasi kasirmu — kami mengurus stok gudang, kasir mengurus penjualan.` | Penjelasan di halaman Kasir |
| 6 | [src/pages/akun/AkunPratinjau.tsx:82](../src/pages/akun/AkunPratinjau.tsx#L82) | `Pembeli di Warungku sejak {tanggal}` | Kartu pratinjau profil publik |
| 7 | [src/pages/auth/Daftar.tsx:161](../src/pages/auth/Daftar.tsx#L161) | `Warungku` | Header layar Daftar |
| 8 | [src/pages/auth/DaftarLegalitas.tsx:497](../src/pages/auth/DaftarLegalitas.tsx#L497) | `Warungku` | Header layar Daftar — Legalitas |
| 9 | [src/pages/auth/DaftarUsaha.tsx:307](../src/pages/auth/DaftarUsaha.tsx#L307) | `Warungku` | Header layar Daftar — Usaha |
| 10 | [src/pages/auth/LupaSandi.tsx:341](../src/pages/auth/LupaSandi.tsx#L341) | `Warungku` | Header layar Lupa Sandi |
| 11 | [src/pages/auth/Masuk.tsx:63](../src/pages/auth/Masuk.tsx#L63) | `Selamat datang kembali di Warungku.` | Toast setelah masuk |
| 12 | [src/pages/auth/Masuk.tsx:77](../src/pages/auth/Masuk.tsx#L77) | `Masuk ke Warungku` | Judul `<h1>` layar Masuk |
| 13 | [src/pages/auth/Masuk.tsx:196](../src/pages/auth/Masuk.tsx#L196) | `Warungku` | Header layar Masuk (bagian lain) |
| 14 | [src/pages/auth/Masuk.tsx:71](../src/pages/auth/Masuk.tsx#L71) | `setSandi('warungku2024')` | Nilai yang diisi otomatis ke kolom sandi saat tombol "isi akun contoh" ditekan — bukan teks label, tapi **nilai yang bisa terlihat** kalau kolom sandinya ditoggle jadi tampak. Batas: lihat §1a. |
| 15 | [src/pages/akun/PenggunaUndang.tsx:89](../src/pages/akun/PenggunaUndang.tsx#L89) | `` `warungku.id/gabung/${kode}` `` | Tautan undangan yang ditampilkan ke pengguna |
| 16–18 | [src/pages/auth/Daftar.tsx:287,290](../src/pages/auth/Daftar.tsx#L287), [src/pages/auth/LupaSandi.tsx:432,435](../src/pages/auth/LupaSandi.tsx#L432), [src/pages/auth/Masuk.tsx:49](../src/pages/auth/Masuk.tsx#L49) | `"Contoh: warungku2024."` (5 kemunculan, 3 berkas) | Contoh kata sandi di pesan galat validasi |
| 19 | [src/pages/Hero.tsx:49](../src/pages/Hero.tsx#L49) | `Warungku` | Judul besar Landing Page |
| 20 | [src/pages/Hero.tsx:84](../src/pages/Hero.tsx#L84) | `Warungku adalah aplikasi tambahan, bukan aplikasi kasir baru.` | Paragraf Hero |
| 21 | [src/pages/Hero.tsx:86](../src/pages/Hero.tsx#L86) | `Kasir yang kamu pakai sekarang tetap jalan seperti biasa. Warungku menempel di...` | Paragraf Hero |
| 22 | [src/pages/Hero.tsx:172](../src/pages/Hero.tsx#L172) | `Warungku menandai barang yang akan habis dan menyiapkan daftar belanjanya.` | Kartu fitur Hero |
| 23 | [src/pages/Hero.tsx:228](../src/pages/Hero.tsx#L228) | `Warungku — purwarupa antarmuka, data contoh.` | Footer Hero |
| 24 | [src/pages/mulai/BatasAmanAwal.tsx:330](../src/pages/mulai/BatasAmanAwal.tsx#L330) | `Warungku` | Header alur onboarding |

**§1a — soal baris 14 (`warungku2024` di kolom sandi):** ini nilai demo yang diisi otomatis,
bukan teks label tetap. Kalau nama produk berganti, wajar nilainya ikut berganti supaya contoh
di pesan galat (poin 16–18) dan nilai yang benar-benar terisi tetap konsisten satu sama lain —
tapi ini keputusan kecil, bukan sesuatu yang menunggu keputusan pemilik proyek.

### BUKAN termasuk — nama internal, sengaja tidak didaftar untuk diganti

| Lokasi | Teks | Kenapa dikecualikan |
|---|---|---|
| [src/index.css:4](../src/index.css#L4) | `/* SISTEM DESAIN — Warungku */` | Komentar kode, tidak pernah dirender |
| [src/layouts/KerangkaAplikasi.tsx:139](../src/layouts/KerangkaAplikasi.tsx#L139) | `/* "Warungku" tidak muncul sama sekali kalau tidak di sini. */` | Komentar kode |
| [src/pages/Hero.tsx:17](../src/pages/Hero.tsx#L17), [src/pages/Hero.tsx:107](../src/pages/Hero.tsx#L107) | Komentar kode | Komentar kode |
| [src/store/aplikasi.ts:214](../src/store/aplikasi.ts#L214), [src/store/aplikasi.ts:308](../src/store/aplikasi.ts#L308) | `localStorage.getItem('warungku-tema')` / `setItem(...)` | Kunci penyimpanan browser, tidak pernah terlihat pengguna — sesuai permintaan brief, memang tidak didaftar. **Catatan teknis untuk besok:** mengganti string kunci ini membuat preferensi tema pengguna lama (yang pernah membuka aplikasi versi "Warungku") ter-reset ke bawaan terang. Dampaknya kecil (purwarupa, belum ada pengguna nyata), tapi perlu disadari saat eksekusi, bukan ditemukan belakangan. |

### Temuan tambahan — di luar cakupan teks, tapi relevan untuk besok

**[index.html:6](../index.html#L6)** — `<meta name="theme-color" content="#0f766e">`. Ini bukan
teks "Warungku", jadi sengaja tidak masuk tabel di atas, tapi nilainya hex teal mentah di luar
sistem token (`src/index.css` tidak menyentuh `index.html`). Ikut perlu diganti ke ungu merek
saat warna dipindah, kalau tidak bilah alamat di HP akan tetap teal walau seluruh UI sudah ungu.

---

## 2. Acuan tata letak — majoo.id

Diukur dengan skill `design-taste-breakdown` langsung di `https://majoo.id` (viewport 1440×900,
lalu 375×812 untuk delta mobile), via peramban bawaan. **Bukan tangkapan layar yang ditaksir —
nilai computed CSS asli.**

### Yang TIDAK bisa diukur, dan kenapa

Dasbor produk sungguhan (`dashboard.majoo.id`, termasuk "Toko Online → Pesanan Masuk" yang
disebut di `Prompt #1.md`) ada di balik login. Itu bukan aplikasi milik kita, jadi saya tidak
masuk dengan kredensial apa pun ke sana — di luar batas yang boleh saya lakukan. Sebagai
gantinya saya pakai dua sumber: landing page publik majoo (diukur langsung, computed CSS asli)
untuk skala huruf/spasi/radius/motion, dan **tangkapan layar dasbor di OneNote "Meet 2 - Kopken
→ Distributor"** (berhasil dibuka) untuk pola kepadatan tata letak layar Pesanan yang
sesungguhnya. Dua sumber ini saling melengkapi, bukan saling menggantikan.

### 2.1 Skala huruf (desktop 1440px)

| Ukuran | Dipakai untuk | Berat | Line-height | Tracking | Rasio ke step berikut |
|---|---|---|---|---|---|
| 48px | H1 hero | 600/700 | 1,17 | +0,96px | 1,333 |
| 36px | H2 section | 600 | 1,33 | — | 1,2 |
| 30px | H3 (nama kategori bisnis) | 600 | 1,2 | −0,04px | 1,25 |
| 24px | H4 | 600 | 1,33 | +0,24px | 1,2 |
| 20px | Isi besar | 400/500 | 1,5/1,2 | — | 1,111 |
| 18px | Isi tebal | 500/600 | 1,33/1,44 | — | 1,125 |
| **16px** | **Dasar — dipakai 337×, teks badan utama** | 400/600/700 | 1,38–1,5 | +0,32–0,8px | 1,067 |
| 14px | Label, nav, badan kecil | 400/600/700 | 1,29–1,71 | +0,28–0,7px | 1,167 |
| 12px | Badge, keterangan kecil | 600 | 1,33–1,67 | +0,4–0,6px | 1,2 |
| 10px | Micro-label | 600 | 1,4 | +0,4px | — |

Delta mobile (375px): H1 48px→34px (menyusut ×0,71), H2 36px→30px; **16px/14px/12px dasar
sama sekali tidak menyusut** — itu yang membuat badan teks tetap gampang dibaca di HP.
Font: `system-ui` dominan (568 kemunculan), ditimpa `Open Sans` (149) dan `Metropolis` (41)
untuk judul. Fonta ini bukan untuk ditiru persis — Warungku sudah punya Plus Jakarta Sans dan
itu tetap dipakai; yang diambil di sini polanya: **satu ukuran dasar 16px yang stabil, dan
rasio antar-step yang menyempit mendekati 1 begitu turun di bawah 18px** (hierarki tegas di
ukuran besar, nyaris rata di ukuran kecil).

### 2.2 Spasi, radius, bayangan

- **Satuan dasar tidak bulat 4px/8px murni** — nilai terbanyak adalah 12px (226×) dan 16px
  (188×), lalu 4px (132×) dan 48px (68×). Baca sebagai: 4px adalah satuan akar, tapi ritme
  yang benar-benar dipakai di lapangan melompat ke kelipatan 12–16px, bukan selalu kelipatan 8.
- **Radius besar-besar**: 50px (27×, kapsul/pill — ini yang dipakai di badge kategori warna-warni
  pada hero), 34px (22×, kartu fitur), 24px (10×, kartu umum), 12–16px (kartu kecil/isian). Tidak
  ada radius di bawah 6px yang dipakai meluas — majoo konsisten "membulat", bukan menyudut.
- **Bayangan**: dua lapis, lembut — `0 1px 2px rgba(16,24,40,.05)` untuk elevasi tipis, dan
  `0 4px 8px -2px rgba(16,24,40,.1), 0 2px 4px -2px rgba(16,24,40,.06)` untuk kartu terangkat.
  Ini pola yang **sama persis strukturnya** dengan `--shadow-1`/`--shadow-2` yang sudah ada di
  `src/index.css` — tidak perlu diubah, sudah selaras.
- **Breakpoint yang cocok**: 576 / 768 / 992 / 1200 / 1400px (Bootstrap standar — majoo
  memang dibangun di atas Bootstrap 5 dengan token kustom di atasnya, terlihat dari
  `--bs-*` dan `--mj-*` custom property yang terbaca).

### 2.3 Kepadatan layar Pesanan (dari tangkapan layar OneNote, bukan computed CSS)

Mockup laptop+HP di halaman "Distributor" OneNote menunjukkan struktur layar Pesanan:

1. **Header gelap penuh-lebar** (hampir hitam/teal-gelap) berisi nama aplikasi di kiri, tab
   navigasi di tengah, lonceng notifikasi + avatar di kanan.
2. **Baris 3 kartu ringkasan angka** tepat di bawah header (semacam KPI: total/jumlah per
   status), angka besar + label kecil — ini pola yang **sudah ada** di Warungku (mis. kartu
   ringkasan di Beranda), jadi bukan pola baru untuk diadopsi, tinggal dikonfirmasi tetap.
3. **Daftar pesanan sebagai kartu**, bukan baris tabel klasik: tiap kartu punya nama
   pemesan + badge status (pil berwarna) di baris pertama, lalu dua-tiga kolom info
   (kota/tanggal/jumlah) di baris kedua, dan tombol aksi di ujung kanan. Antar-kartu
   dipisah garis tipis, bukan kotak terpisah — kepadatan tinggi tapi tetap bisa dipindai cepat.

Catatan isi (bukan desain) yang ikut tertera di anotasi halaman itu — **sudah sesuai dengan
yang sudah dibangun** menurut memori proyek (`Beranda` distributor: sapaan + lonceng + rekap
tracking; lihat [[proyek-warungku-umkm]]), jadi tidak diulang di sini sebagai temuan baru.

### 2.4 Tiga keputusan tata letak yang perlu dikonfirmasi besok

Ini bukan hal yang saya putuskan sendiri — tata letak portal distributor Warungku sudah jadi
(lima tab: Beranda·Pesanan·Kontrak·Promo·Profil) dan sudah lolos sapuan 360px. majoo dipakai
sebagai **acuan rasa**, bukan cetak-ulang 1:1. Yang perlu diputuskan pemilik proyek sebelum
diterapkan ke kode:
1. Radius majoo jauh lebih besar (24–34px untuk kartu) dibanding token `--r-lg: 16px` /
   `--r-xl: 22px` yang berlaku sekarang. Dinaikkan mengikuti majoo, atau tetap?
2. Badge kategori majoo memakai banyak warna solid berbeda per kategori (oranye/biru/pink/ungu/
   abu/hijau/merah sekaligus di satu baris) — ini situasional-marketing, bukan pola status.
   Warungku memakai 4 warna status tetap (aman/menipis/kritis/info). Pola majoo ini **tidak
   disarankan ditiru untuk badge status** (akan melanggar konvensi "status = makna tetap, bukan
   dekorasi"), tapi bisa relevan untuk badge **kategori produk** yang memang dekoratif.
3. Kartu pesanan majoo padat (3 baris info per kartu). Warungku saat ini pakai pola serupa
   di beberapa layar — perlu dicek satu-satu mana yang perlu dirapatkan.

---

## 3. Usulan token `--c-brand*` ungu

### 3.1 Sumber warna

Warna diambil **langsung dari piksel `Logo.jpeg`** (bukan ditaksir dari mata), disampel di
kata "Turnify Flow" dan ikon toko: warna dominan **`#52329F`**, HSL `258°, 52%, 41%` — ungu-
indigo pekat. ([Logo.jpeg](../Logo.jpeg) di akar repo)

### 3.2 Token yang diusulkan

Mengikuti pola transformasi yang sudah berlaku di `src/index.css` untuk pasangan terang/gelap
token merek yang ada sekarang (teal `#0f766e` → `#2dd4bf`): hue dipertahankan, lightness
dinaikkan dan saturasi diturunkan sedikit untuk versi gelap supaya tetap menyala di atas latar
nyaris-hitam.

```css
/* :root — mode terang */
--c-brand: #52329f;        /* logo, apa adanya */
--c-brand-hover: #4b3384;
--c-brand-soft: #f0edf8;
--c-brand-soft-ink: #331579;
--c-brand-ring: #52329f33;

/* .dark — mode gelap */
--c-brand: #947bd1;
--c-brand-hover: #b9a6e7;
--c-brand-soft: #1a1132;
--c-brand-soft-ink: #ae96e9;
--c-brand-ring: #947bd140;
```

### 3.3 Verifikasi kontras (WCAG AA, dihitung — bukan ditaksir)

| Pasangan | Rasio | Ambang | Lolos? |
|---|---|---|---|
| `--c-brand` (terang) vs `text-ink-inverse` putih | 9,07∶1 | ≥4,5∶1 (teks) | ✅ |
| `--c-brand-hover` (terang) vs putih | 9,97∶1 | ≥4,5∶1 | ✅ |
| `--c-brand-soft-ink` vs `--c-brand-soft` (terang) | 11,92∶1 | ≥4,5∶1 | ✅ |
| `--c-brand` (gelap) vs `text-ink-inverse` gelap `#08121a` | 5,41∶1 | ≥4,5∶1 | ✅ |
| `--c-brand-hover` (gelap) vs `#08121a` | 8,70∶1 | ≥4,5∶1 | ✅ |
| `--c-brand-soft-ink` vs `--c-brand-soft` (gelap) | 7,13∶1 | ≥4,5∶1 | ✅ |

Semua pasangan yang benar-benar dipakai berdampingan di UI (tombol isi, badge lembut, teks di
atas keduanya, di kedua tema) lolos AA dengan margin sehat — bukan pas-pasan di angka 4,5.

### 3.4 Tidak bentrok dengan warna status yang ada

| Status | Hue | Jarak hue ke `--c-brand` (258°) |
|---|---|---|
| `--c-aman` (hijau) | 142° | 116° — aman jauh |
| `--c-menipis` (amber) | 26° | 128° (lewat 0°) — aman jauh |
| `--c-kritis` (merah) | 356° | 98° (lewat 0°) — aman jauh |
| `--c-info` (biru) | 224° | 33° — **paling dekat, tapi masih dua "slot" warna terpisah** |

Ungu dan biru `--c-info` adalah pasangan hue paling berdekatan (33°). Ini masih dianggap aman
karena peran keduanya berbeda — merek dipakai di tombol/aksen/seleksi, `--c-info` dipakai
khusus badge status, dan konvensi "status tidak pernah hanya warna" (selalu ikon+teks) sudah
berlaku duluan — tapi worth disadari, bukan disembunyikan.

### 3.5 Temuan yang TIDAK diminta, tapi perlu diketahui sebelum eksekusi

**`--c-seri-3` (warna grafik ketiga, `#4a3aa7`) nyaris warna yang sama dengan `--c-brand` yang
diusulkan.** Hue-nya cuma beda 9° (249° vs 258°), saturasi dan lightness nyaris identik — ini
BUKAN "dua warna di keluarga yang sama", ini praktis **warna yang sama** dilihat orang awam.
Begitu `--c-brand` jadi ungu dan muncul di mana-mana (tombol, link, seleksi), grafik mana pun
yang memakai slot seri ke-3 akan terlihat seperti "memakai warna merek" — membingungkan, dan
melanggar prinsip yang sudah tertulis di [[konvensi-ui-warungku]]: *"jangan memakai warna
status sebagai warna seri"* — prinsip yang sama berlakunya untuk warna merek. **Ini keputusan
untuk pemilik proyek, bukan sesuatu yang saya ubah sendiri** (mengubah `--c-seri-3` berarti
menyentuh `src/index.css`, di luar izin brief semalam): opsinya performa geser hue `--c-seri-3`
menjauh dari 258° (mis. ke arah magenta/pink ~320° atau biru-abu ~200°), lalu validasi ulang
dengan `validate_palette.js` dari skill `dataviz` supaya tiga warna seri tetap lolos pemisahan
buta-warna.

**`index.html` meta `theme-color` (`#0f766e`)** — lihat §1, perlu ikut diganti ke
`--c-brand` baru saat eksekusi, walau bukan token CSS.

---

## Yang BELUM dikerjakan malam ini (sengaja, sesuai batasan brief)

- Tidak ada perubahan di `src/` atau `index.html`.
- Tidak ada commit/push — sesuai [[alur-git-warungku]], dan brief semalam eksplisit melarang.
- Warna seri grafik (`--c-seri-3`) **tidak diubah**, cuma ditandai sebagai perlu keputusan (§3.5).
- `docs/design-spec.md` ala skill `design-taste-breakdown` sengaja **tidak** dibuat terpisah —
  brief minta satu berkas, jadi hasil pengukuran majoo digabung ke sini (§2) alih-alih dipecah.

**Yang menunggu keputusan pemilik proyek sebelum eksekusi besok:** tiga poin di §2.4 (radius,
badge kategori, kepadatan kartu), dan satu poin di §3.5 (`--c-seri-3`).
