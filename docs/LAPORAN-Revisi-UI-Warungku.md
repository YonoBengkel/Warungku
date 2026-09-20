# Laporan — Revisi UI Warungku (Interface UMKM & Portal Distributor)

> Pelaksanaan `Riwayat Chat/Prompt #1 (Revisi).md`, 20 September 2026.
> Semua pekerjaan **lokal**. Tidak ada commit, tidak ada push.

---

## 1. Ringkasan

| | |
| --- | --- |
| Berkas diubah | 34 |
| Berkas baru | 12 (4.528 baris) |
| Berkas dihapus | 1 (`src/pages/akun/Langganan.tsx`) |
| Selisih pada berkas lama | +3.605 / −1.049 |
| `npm run build` (termasuk `tsc -b`) | **lolos** |
| Bundel awal | 386,7 kB (117,0 kB gzip) |
| Rute disapu | **101 rute × 360px & 1360px × tema terang & gelap** |
| Hasil sapuan | nol crash · nol galat konsol · nol geseran horizontal · tepat satu `<h1>` per halaman · nol lompatan tingkat judul · nol kegagalan kontras WCAG AA · nol tombol/tautan tanpa nama |

Setelah implementasi, seluruh perubahan ditelaah **6 pemeriksa dengan sudut pandang berbeda** (logika data, alur UMKM, portal distributor, kepatuhan spesifikasi, bahasa, kode mati). 54 temuan mentah, masing-masing disanggah **3 agen** dengan default "palsu". 18 gugur, **36 lolos** → dikelompokkan jadi **22 cacat berbeda**, semuanya diperbaiki dan diverifikasi ulang.

---

## 2. Kepatuhan pada tiga keputusan yang sudah dikunci

### K1 — "Belanja" → "Distributor", **label saja**

**Yang berubah:** `NAV.belanja` dan `JUDUL.belanja` di `src/lib/label.ts`, plus 13 teks literal yang mengetik kata "Belanja" langsung.

**Yang TIDAK berubah, sesuai perintah:** rute `/belanja` tetap · nama berkas `src/pages/belanja/*` tetap · nama variabel/komponen tetap · **tidak ada alias `/distributor`**.

Kata "Belanja" yang berarti *satu transaksi belanja* sengaja **tidak** ikut diganti: `Belanja Terkirim`, `Belanja belum dikirim: N barang`, `Periksa Belanja`, `kodeBelanja`, `saranBelanja`.

Satu tabrakan nama ikut dibereskan: halaman `/belanja` kini berjudul "Distributor" padahal sub-tabnya juga bernama "Distributor" → sub-tabnya jadi **"Cari Barang"** dan **"Daftar Distributor"** (nilai query `?tab=barang|distributor` tidak disentuh).

### K2 — Prediksi jadi tab utama ke-5

Urutan: **Beranda · Stok · Prediksi · Distributor · Pesanan**.

**Hasil pengukuran di 360px** (yang diminta diperiksa, bukan diasumsikan):

| Tab | Lebar slot | Lebar label | Terpotong | Membungkus |
| --- | --- | --- | --- | --- |
| Beranda | 72,0 px | 45,0 px | tidak | tidak |
| Stok | 72,0 px | 26,6 px | tidak | tidak |
| Prediksi | 72,0 px | 42,6 px | tidak | tidak |
| **Distributor** | 72,0 px | **55,8 px** | tidak | tidak |
| Pesanan | 72,0 px | 44,8 px | tidak | tidak |

Tiap tab **72 × 72 px** (di atas ambang 44 px). Yang disesuaikan: ukuran huruf label 0,6875rem → **0,625rem**, ikon 24 → **22**, wadah tab `flex-1 min-w-0`, `whitespace-nowrap` hanya pada span label. **Tidak ada singkatan karangan dan tidak ada teks yang dipotong.**

### K3 — Satu POS, formatnya jadi satu-satunya format

- `merekKasir` (6 merek) **dihapus** → `POS_TUNGGAL = Kasir Open POS`.
- Rute `/akun/kasir/panduan/:merek` **dihapus** → `/akun/kasir/panduan` tanpa parameter.
- Kartu "Kasir saya tidak ada di daftar" **dihapus**.
- `hubungkanKasir()` kini tanpa argumen.
- Grep `moka|olsera|pawoon|qasir|majoo` di `src/` → **nol** (kecuali penyebutan majoo.id sebagai referensi desain di dokumen).

**Format struk:** satu tipe `Transaksi` di `src/lib/types.ts`, satu komponen `src/components/domain/KartuStruk.tsx`, dipakai di **dua tempat** — Riwayat Data Kasir (`/akun/kasir?tab=riwayat`) dan riwayat pergerakan di Detail Barang. Tidak ada harga apa pun di dalam struk.

---

## 3. Tugas 1 — Interface UMKM

### 3.1 Satu database transaksi
`daftarTransaksi`: **76 struk** tersebar di 9 hari, dibangkitkan deterministik (tanpa `Math.random`). Nomor `KOP-YYMMDD-NNNN`. `Pergerakan` mendapat field wajib `transaksiId`, dan tiap pergerakan `terjual` merujuk struk hari itu.

### 3.2 Landing page (`/`)
`src/pages/Hero.tsx` — navbar + hero + dua tombol, mengacu tata letak MarketCast. **Paragraf pembuka wajib** ada di posisi paling atas: *"Warungku adalah aplikasi tambahan, bukan aplikasi kasir baru."* Tombol **"Login"** (kata yang kalian minta eksplisit) menuju `/masuk`. Pengguna yang sudah masuk diarahkan ke `/beranda`.

### 3.3 Pendaftaran
- **"Apa yang kamu jual?" tetap ada** di `/daftar/usaha`. Rencana lama di `RencanaAG#1.md` tidak diikuti.
- Langkah terakhir (`/akun/kasir?langkah=mulai`) kini berjudul persis **"Apakah kamu sudah memiliki data transaksi sebelumnya?"**, dengan **daftar konektor bergaya Claude**: Kasir Open POS · Gmail · Google Spreadsheet · Unggah berkas sendiri · Belum punya data transaksi. Tautan "Lewati untuk saat ini" tetap sebagai teks sekunder.

### 3.4 Beranda
Urutan blok dari atas: sambutan + tanggal → pita data kasir → banner akun → **slider promo** → **Perlu Tindakan** → **Yang perlu kamu urus hari ini** → **Prediksi Stok** → Pesanan Berjalan → Kuota Kontrak.

- **Sambutan:** `Selamat datang, Kopi Kita Jogja` + `Minggu, 20 September 2026`. *Catatan kalian menulis huruf kapital semua ("SELAMAT DATANG WARUNG X"); saya pakai huruf normal karena pembaca sasarannya 40+ dan teks kapital seluruhnya lebih lambat dibaca. Kalau kalian tetap mau kapital, itu satu baris.*
- **Slider promo:** 7 promo, 3 skenario. Bisa digeser (`snap-x`), template per jenis identik antar toko, yang berbeda hanya nama tokonya. Ditekan → `/promo/:id`.
- **Perlu Tindakan:** 4 ikon horizontal bergaya Shopee, badge angka merah dari data nyata (Stok Habis 1 · Stok Menipis 10 · Hampir Kedaluwarsa 3 · Kontrak Habis 1). Ditekan → `/stok?filter=…` **sudah terfilter** (diuji: badge 1 → daftar 1 baris).
- **Kartu tindakan lama dipertahankan** di bawahnya dengan judul baru. *Ini penyimpangan sadar dari prompt yang menyuruh mengganti daftar "Perlu Diurus": kartu itu satu-satunya pintu cepat ke "Barang Sudah Sampai" dan ke Lembar Pesan Cepat, dan verifikasi #10 menuntut alur intinya tetap hidup. Baris ikon adalah pintasan penyaring, kartu adalah tindakan konkret — dua hal berbeda.*
- **Prediksi Stok:** angka saran `text-[2.5rem]` vs keterangan `text-[0.8125rem]`, bar proporsi pemakaian bulan ini vs perkiraan bulan depan, tombol masuk keranjang dengan jumlah yang bisa disesuaikan.

### 3.5 Halaman Prediksi (`/prediksi`)
Tiga keadaan dalam satu halaman, dipilih query string:
1. **Bawaan** — grafik pemakaian seluruh barang + grafik perkiraan per kategori + slider kategori.
2. **`?kategori=…`** — grafik kategori itu + semua barang di dalamnya.
3. **`?barang=…`** — tren enam bulan + perkiraan, blok **"Kenapa saran ini muncul"**, keyakinan model ditulis sebagai kata, dan bilah aksi berisi pengatur jumlah + masuk keranjang.

Kejujuran yang dipasang: grafik gabungan menuliskan sendiri bahwa ia menjumlahkan satuan berbeda, jadi yang dibaca bentuk kurvanya.

### 3.6 Langganan dihapus
Berkas, rute, tipe `TierLangganan`, field `ProfilUsaha.tier`, `tier: 'dasar'` di data contoh, lencana & menu di Akun, tautan di Beranda, dan tiga kalimat hak akses di Pengguna/PenggunaUndang — semuanya bersih. Tidak ada satu pun tombol yang terkunci karena tier.

### 3.7 Pesanan: 3 tab → 2 tab
- **Pesanan** — Draf + Berjalan + Selesai, dengan chip `Semua · Berjalan · Selesai`.
- **Kontrak** — chip `Semua · Berjalan · Akan berakhir · Selesai`, sakelar `[Per barang] [Per pemasok]`, `KuotaBulanIni`, dan baris "Setiap barang punya kontrak sendiri" **dipertahankan**.
- Tautan lama `?tab=berjalan` dan `?tab=selesai` **tetap mendarat benar** (diuji).

---

## 4. Tugas 2 — Portal Distributor (dibangun dari nol)

Kerangka sendiri (`src/layouts/KerangkaDistributor.tsx`) + 7 halaman.

**Sidebar tepat 4 item:** Beranda · Pesanan · Lacak Pesanan · Profil.

**Beranda distributor:** sambutan + tanggal, kartu tindakan "6 pesanan menunggu kamu jawab", rekap 5 tahap sebagai kartu-tautan, ringkasan sebaran titik, 5 pesanan terbaru. Lonceng ber-badge ada di kepala halaman kerangka (tidak diduplikasi).

**Pesanan** (acuan majoo.id): kartu ringkasan per tahap di atas, lalu **tab** (bukan Kanban) — Menunggu Konfirmasi · Disiapkan di Gudang · Sedang Dikirim · Selesai · Ditolak.
Pada tahap pertama tiap baris punya **"Terima"** dan **"Tolak"**. "Tolak" membuka lembar berisi 5 chip alasan + catatan bebas; **alasan wajib** — tombol kirim mati sampai terisi, dan pesan validasinya memuat tiga unsur (apa yang kurang, cara memperbaiki, contoh benar). *Diuji sungguhan: menunggu 6 → 5, ditolak 2 → 3.*

**Penamaan tahap** (kalian minta diperbaiki katanya): `Perlu konfirmasi → **Menunggu Konfirmasi**`, `Gudang → **Disiapkan di Gudang**`, `Sedang diantar → **Sedang Dikirim**`, `Sudah sampai → **Selesai**` — sama persis dengan `LABEL_PESANAN` di sisi UMKM, jadi satu kejadian tidak punya dua nama tergantung siapa yang melihat.

**Lacak Pesanan:** dua keadaan **Sedang Diproses** dan **Selesai**, masing-masing mendaftar **toko**. Drill-down ke toko menampilkan **perjalanan barang** (seluruh rute, termasuk langkah yang belum terjadi) untuk yang diproses, dan **penilaian pelanggan + bukti pengantaran** untuk yang selesai.

**Peta sebaran** (acuan sigap-sppg), digambar sendiri tanpa pustaka dan tanpa jaringan:
- **Kartu hitungan di atas peta**: titik berwarna → angka → keterangan.
- **Tiga warna** sesuai catatan: **merah** belum dikonfirmasi · **oren** belum sampai · **biru** sudah sampai, bertahan **12 jam**.
- Warna **tidak pernah berdiri sendiri**: tiap status punya bentuk cincin berbeda (penuh / putus-putus / ganda) dan keterangan teks.
- **Angka jumlah pesanan tertulis di dalam tiap titik.**
- Titik bisa diklik **dan** dijangkau papan ketik (`tabIndex`, Enter/Space, `aria-label` lengkap), lalu membuka panel rincian memanjang ke bawah.
- Peta menuliskan sendiri bahwa ia gambaran sebaran, bukan peta sesungguhnya.

---

## 5. Cacat yang ditemukan telaah dan diperbaiki

### Keparahan tinggi

| # | Cacat | Perbaikan |
| --- | --- | --- |
| 1 | **Satu pesanan yang memuat dua kontrak hanya memperbarui satu kontrak.** Memesan sisa kuota k-01 dan k-02 (dua-duanya d-01) melahirkan satu pesanan berkontrak k-01 saja; stok k-02 naik tapi kuotanya tidak, dan tombol "Pesan 6 kg" tetap aktif → barang yang sudah diterima dipesan lagi. | `kirimKeranjang` memecah sub-keranjang **per `kontrakId`**. Diuji: 2 pesanan lahir (PS-…-11 dan -12), kedua kontrak naik jadi "Dalam perjalanan". |
| 2 | **Potongan promo yang tidak pernah berlaku.** Halaman promo menampilkan Rp 242.250 (coret Rp 285.000), sementara penawaran, keranjang, dan pesanan memakai Rp 285.000. | Halaman promo berhenti memalsukan harga; lencana potongan tetap, keterangannya jujur bahwa potongan diurus saat memesan. |
| 3 | **Kartu hitungan titik salah ember.** Kartu merah menulis "9 pesanan" padahal yang menunggu konfirmasi 6 — bertabrakan dengan lonceng di halaman yang sama. | `TitikPeta` mendapat `perWarna`; kartu menghitung per kondisi. Sekarang **6 / 10 / 3**, cocok persis dengan tab di halaman Pesanan. |
| 4 | **Pengajuan kontrak tidak pernah tersimpan**, padahal layarnya menulis "tersimpan sebagai bukti pengajuan". *(cacat lama, bukan dari revisi ini)* | `ajukanKontrak` kini menulis kontrak berstatus `menunggu-persetujuan`. Diuji: 6 → 7 kontrak, muncul di `/pesanan?tab=kontrak`. |

### Keparahan sedang

| # | Cacat | Perbaikan |
| --- | --- | --- |
| 5 | `kirimDraf` tidak menaikkan `dalamPerjalanan` → kuota salah setelah draf rutin dikirim | dicerminkan dari `kirimKeranjang` + penjaga status |
| 6 | Barang dinyatakan "sudah berlebih" padahal perkiraan bulan depan melebihi stoknya (b-07) | syarat `stok >= perkiraan` ditambahkan |
| 7 | `stokSesudah` lima pergerakan tulisan tangan bertentangan dengan rantainya — kolom audit tidak bisa dijumlahkan | seluruh 149 pergerakan kini ikut satu jalan-mundur; **0 baris putus** |
| 8 | "Lihat struk" menampilkan struk yang tidak memuat barang itu | label jadi "Lihat struk terakhir hari itu" + kalimat penjelas |
| 9 | Lencana "Perlu Tindakan" membuang barang yang dicatat manual, penyaring `/stok` tidak | populasi disamakan |
| 10 | "Pesan Sekarang" pada kartu barang habis selalu menuju saran belanja yang sama | tujuan mengikuti barangnya |
| 11 | **Kartu prediksi memakai foto beku `daftarBarang`** — setelah Terima Barang, kartunya masih menyuruh menambah barang yang baru diterima | dihitung dari stok hidup lewat `rekomendasiDari(b)`. Diuji: stok 3.400 → 23.400 gram membalik saran dari "tambah 17 kg" jadi "kurang 19 kg" |
| 12 | Barang berarah "cukup" tetap disodori saran beli yang sudah terisi | saran beli dibatasi ke arah "tambah" |
| 13 | Racun berbunyi "masuk keranjang" padahal jumlahnya ditimpa | kalimat menyebut jumlah akhir |
| 14 | "Atur Ulang" kasir melempar pengguna lama ke layar onboarding yang **menimpa semua batas aman** | tujuan bercabang lewat penanda `?langkah=mulai` |
| 15 | "Tandai Sedang Dikirim" justru **memundurkan** perkiraan tiba 2 hari | perkiraan lama dipertahankan kalau masih berlaku |
| 16 | Pemakaian yang dicatat manual muncul sebagai "Terjual dari kasir" | dibedakan lewat keterangannya |
| 17 | `LABEL_TITIK.merah` = "Belum di-approve" — kata Inggris **dan** nama kedua untuk status yang sama | → "Menunggu Konfirmasi" |
| 18 | `luber` 2px di Beranda dan 1px di Kontrak | `[&>*]:min-w-0` pada grid; label tombol panjang dipecah ke baris bantuan |

### Keparahan rendah

| # | Cacat | Perbaikan |
| --- | --- | --- |
| 19 | Agregat prediksi memuat barang yang halaman itu sendiri nyatakan tidak diperkirakan | disaring `layakDiperkirakan` + field `jumlahDiperkirakan` |
| 20 | "Langkah 3 dari 3" lalu "Langkah 4 dari 5" — bilah progres mundur | penyebut disamakan jadi 5 |
| 21 | Nama aplikasi hilang dari kepala halaman 360px (nama toko tertulis dua kali) | kepala halaman kini "Warungku" |
| 22 | Lacak toko menulis "Semua pesanan toko ini sudah sampai" padahal masih ada yang belum dijawab; peta mau membuka penawaran milik distributor lain | kalimat dijujurkan; penawaran disaring ke `distributorAktif` |

---

## 6. Verifikasi — yang dijalankan, bukan diasumsikan

### Otomatis
- `npm run build` (`tsc -b` + vite): **lolos**, nol galat.
- Sapuan 101 rute × 2 lebar × 2 tema = **404 pemeriksaan halaman**, semuanya bersih.

### Alur inti dijalankan sungguhan
1. `/prediksi?barang=b-01` → jumlah saran diubah 17 → 16 → masuk keranjang → keranjang menandai *"Saran sistem 17 kg · kamu ubah jadi 16 kg"* → Buat Pesanan → **PS-260920-11 terkirim**.
2. `/pesanan/ps-02/terima` → "Ya, semua sesuai" → **stok Es Batu Kristal 4 kg → 64 kg** (status Menipis → Aman), **kuota kontrak 41 → 44 karung**, "Dalam perjalanan 3" hilang, pesanan Dikirim → Selesai.
3. Beranda → ikon "Stok Habis" (badge 1) → `/stok?filter=habis` → *"Menampilkan 1 dari 18 barang · Habis"*.
4. Portal Distributor → Tolak pm-01 dengan chip alasan → menunggu 6 → 5, ditolak 2 → 3.
5. Peta `/distributor-portal/lacak/barang/pw-01` → titik "Kafe Ruang Tunggu" diklik → panel memuat 3 pesanan dengan status masing-masing.
6. Dua kontrak satu distributor → **2 pesanan** lahir, kedua kuota terbarui.
7. Ajukan kontrak → 6 → 7 kontrak, lencana "Menunggu persetujuan distributor".
8. Koreksi stok b-01 +20.000 gram → kartu prediksi berbalik dari "tambah" ke "kurang".

---

## 7. Yang sengaja TIDAK dikerjakan

1. **Potongan promo tidak dimasukkan ke model harga.** Data promo punya `potonganPersen`, tapi `Penawaran`, keranjang, dan `Pesanan` tidak punya tempat untuk harga promo. Menambahkannya berarti menyentuh tipe, store, keranjang, dan pesanan — di luar cakupan revisi ini. Yang saya tutup adalah **kebohongannya**: halaman promo tidak lagi menampilkan harga yang tidak pernah dipakai. **Ini perlu keputusan kalian.**
2. **Pemetaan menu → bahan baku tidak dibangun.** Struk yang ditempel pada riwayat pergerakan adalah struk terakhir hari itu, bukan struk penyebabnya, karena data pemetaannya memang sengaja tidak ada (`menuBelumDipasangkan`). Labelnya sudah dijujurkan.
3. **Portal Admin belum dibangun** — tidak diminta.
4. **Huruf kapital penuh pada sambutan Beranda** tidak dipakai (alasan keterbacaan, lihat 3.4).
5. **Target sentuh tautan teks di dalam prosa** (mis. "Lihat semua", "Bersihkan penyaring") dibiarkan di bawah 44px. Ini pola lama di seluruh aplikasi dan WCAG 2.5.8 memang mengecualikan tautan inline. Satu yang saya perbaiki karena kini menonjol di tab baru: pengungkap tabel pada grafik tren.

---

## 8. Berkas

**Baru (12):**
`src/pages/Hero.tsx` · `src/pages/prediksi/Prediksi.tsx` · `src/pages/promo/PromoDetail.tsx` · `src/components/domain/KartuPromo.tsx` · `src/components/domain/KartuStruk.tsx` · `src/components/domain/PetaSebaran.tsx` · `src/layouts/KerangkaDistributor.tsx` · `src/pages/distributor-portal/{Dashboard,PesananMasukDaftar,PesananMasukDetail,LacakPesanan,LacakToko,PetaSebaran,ProfilDistributor}.tsx`

**Dihapus (1):** `src/pages/akun/Langganan.tsx`

**Diubah (34):** `src/App.tsx` · `src/lib/{types,label}.ts` · `src/data/dummy.ts` · `src/store/aplikasi.ts` · `src/layouts/KerangkaAplikasi.tsx` · `src/components/grafik/GrafikTren.tsx` · `src/pages/Beranda.tsx` · `src/pages/PesanCepat.tsx` · `src/pages/akun/{Akun,AkunKasir,KasirPanduan,Pengguna,PenggunaUndang}.tsx` · `src/pages/auth/{Daftar,DaftarUsaha,DaftarLegalitas}.tsx` · `src/pages/belanja/*` (7) · `src/pages/keranjang/*` (3) · `src/pages/pesanan/{BeriPenilaian,KontrakDetail,PesananDaftar,PesananDetail}.tsx` · `src/pages/stok/{Stok,StokDetail}.tsx`

```bash
cd "D:\CODE\Project Analitika Data" && npm run dev
```
