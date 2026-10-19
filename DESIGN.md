# DESIGN.md — Turnify Flow

Acuan tampilan untuk semua kode antarmuka di `frontend/`: warna, huruf, tata letak, komponen,
kosakata, dan larangan. Fitur baru mengikuti dokumen ini supaya kedua portal tetap terasa satu
aplikasi.

- **Nilai token** tinggal di [`frontend/src/index.css`](frontend/src/index.css). Dokumen ini
  menjelaskan cara memakainya. Kalau keduanya berbeda, kodenya yang berlaku dan dokumen ini
  diperbarui.
- **Latar belakang keputusan:** ukuran majoo di
  [Brief-Rebrand-Turnify-Flow.md](docs/desain/Brief-Rebrand-Turnify-Flow.md) bagian 2,
  riwayat kurasi di [KURASI-UX-Rombak4.md](docs/desain/KURASI-UX-Rombak4.md), dan spesifikasi
  layar pemilik usaha di [IMPROVEMENT-Interface-Pemilik-Usaha.md](docs/desain/IMPROVEMENT-Interface-Pemilik-Usaha.md).
- Disusun 20 Oktober 2026 dari kode cabang `Rombak#4` (komit `722aad5`).

## 1. Karakter

- **Pengguna:** pemilik warung dan kedai, banyak yang berusia 40 tahun ke atas, memakai HP Android
  kelas menengah. Distributor lebih sering memakai laptop.
- **Rasa:** aplikasi kerja yang tenang. Padat tapi terbaca, satu langkah jelas per layar, dan
  angka yang bisa dipercaya. majoo menjadi acuan rasa, bukan cetakan untuk ditiru 1:1.
- **Merek:** ungu `#52329f`, disampel dari piksel `Logo.jpeg`. Ungu adalah sinyal "langkah
  berikutnya". Ia bukan hiasan.
- **Mulai dari HP:** semua layar dirancang untuk lebar 360px dulu, lalu dilebarkan ke desktop.

## 2. Warna

Komponen hanya memakai kelas token (`bg-surface`, `text-ink-2`, `border-line`, ...). Hex tidak
pernah ditulis langsung di komponen. Setiap token punya pasangan tema gelap di blok `.dark`.

| Peran | Token (kelas Tailwind) | Terang | Gelap | Dipakai untuk |
|---|---|---|---|---|
| Latar halaman | `bg-bg` | `#f4f6f8` | `#0b1116` | Badan halaman |
| Permukaan | `bg-surface` | `#ffffff` | `#131c24` | Kartu, lembar, bilah |
| Permukaan 2 | `bg-surface-2` | `#fafbfc` | `#18232c` | Kaki lembar, kartu ditekan |
| Cekung | `bg-sunken` | `#eef1f4` | `#0e161d` | Jalur tab, tombol halus, kerangka muat |
| Garis | `border-line` / `border-line-strong` | `#e2e6ea` / `#cbd2d9` | `#27333d` / `#3a4854` | Pemisah dan bingkai isian |
| Teks utama | `text-ink` | `#111a23` | `#eef3f7` | Judul, angka, isi penting |
| Teks kedua | `text-ink-2` | `#48545f` | `#a8b6c2` | Keterangan yang **perlu dibaca** |
| Teks ketiga | `text-ink-3` | `#5a6773` | `#7d8c99` | Keterangan yang **boleh dilewati** |
| Teks pembalik | `text-ink-inverse` | `#ffffff` | `#08121a` | Teks di atas warna penuh |
| Merek | `bg-brand`, `text-brand` | `#52329f` | `#947bd1` | Tombol utama, tautan, cincin fokus |
| Merek lembut | `bg-brand-soft` + `text-brand-soft-ink` | `#f0edf8` / `#331579` | `#1a1132` / `#ae96e9` | Keadaan terpilih, tombol sekunder |

**Status.** Ada empat warna status beserta satu netral. Masing-masing punya tiga tingkat: penuh
(`bg-aman`), lembut (`bg-aman-soft`), dan tinta (`text-aman-ink`).

| Status | Arti | Terang (penuh) |
|---|---|---|
| `aman` | Stok cukup, berhasil, selesai | `#15803d` |
| `menipis` | Perlu perhatian, stok menipis | `#b45309` |
| `kritis` | Habis, genting, aksi berbahaya | `#c1121f` |
| `info` | Informasi, pesanan yang sedang disiapkan atau dikirim | `#1d4ed8` |
| `netral` | Tanpa penilaian | `bg-netral-soft` + `text-netral-ink` |

**Grafik.** Warna grafik dipisah dari warna status dan warna merek.
- Urutan slot tetap: `seri-1` teal `#0ba393`, `seri-2` jingga `#eb6834`, `seri-3` nila
  `#4a3aa7`. Urutan ini tidak pernah diputar, supaya satu entitas selalu berwarna sama meski
  seri lain disaring keluar.
- `seri-perkiraan` (merah `#e34948`, putus-putus) dan `pita-perkiraan` hanya untuk garis dan
  rentang perkiraan Mesin 1. Token ini bukan warna status kritis.
- `grid` dan `sumbu` dibuat redup supaya datanya yang menonjol.
- Palet baru atau seri tambahan wajib lolos `validate_palette.js` dari skill dataviz di kedua
  tema, termasuk uji pemisahan buta warna.

**Aturan warna:**
1. **Ungu penuh hanya untuk tombol utama** (dan cincin fokus). Keadaan terpilih memakai
   ungu lembut atau putih terangkat (lihat bagian 6).
2. **Teks di atas warna penuh** (`bg-brand`, `bg-kritis`, `bg-menipis`, `bg-info`) memakai
   `text-ink-inverse`, bukan `text-white`. Di tema gelap `text-white` di atas ungu muda hanya
   1,9:1.
3. **Status tidak pernah hanya warna.** Selalu ikon + teks + warna (WCAG 1.4.1).
4. **Merah hanya untuk yang genting.** Tanda wajib `*` dan pemberitahuan biasa tidak merah.
5. **Kontras minimal AA:** 4,5:1 untuk teks dan 3:1 untuk garis grafik dan bingkai isian, di
   kedua tema. Ukur hasil campurannya, jangan menaksir dari hex.

## 3. Tipografi

- **Huruf:** Plus Jakarta Sans 400–800 dari Google Fonts, dengan cadangan `system-ui`.
- **Dasar:** `html` 16px dan tidak boleh dikecilkan. Kolom isian 16px supaya Safari iOS tidak
  memperbesar halaman saat kolom disentuh.
- **Enam peran ukuran.** Ukuran `text-[Nrem]` tidak dipakai lagi. Token hanya membawa ukuran
  dan jarak baris; tebal huruf ditulis di kelasnya.

| Token | Ukuran / jarak baris | Dipakai untuk | Tebal lazim |
|---|---|---|---|
| `text-judul` | 22px / 1,25 | Judul halaman akar (`h1`) | `font-extrabold` |
| `text-subjudul` | 17px / 1,35 | Judul halaman detail di `KepalaHalaman` | `font-extrabold` |
| `text-kartu` | 15px / 1,4 | Judul kartu dan bagian, tombol sedang | `font-bold` / `font-semibold` |
| `text-isi` | 14px / 1,55 | Teks badan, label, tab, chip | 400, label 600 |
| `text-kecil` | 12px / 1,45 | Keterangan kecil, cap waktu | 400–600 |
| `text-angka` | 26px / 1 | Satu angka besar (sisa stok, total) | `font-extrabold` |

- **Satu-satunya ukuran di bawah 12px:** lencana kecil dan penghitung di tab, 11px tebal.
- **Keterangan di bawah judul halaman:** `mt-1 text-isi text-ink-2 leading-relaxed max-w-[62ch]`.
- **Satu angka besar per baris.** `tabular` (tabular-nums) hanya untuk kolom angka yang harus
  sejajar vertikal, bukan untuk angka besar yang berdiri sendiri.
- **Huruf besar:** label tombol ditulis dengan Huruf Besar Tiap Kata ("Pesan Sekarang",
  "Masukkan ke Keranjang"); judul dan kalimat lain memakai huruf kalimat biasa.

**Angka dan tanggal gaya Indonesia.** Selalu lewat `frontend/src/lib/format.ts`, termasuk teks
yang dikirim backend (`ml/mesin2/saran.py`, `backend/api/produksi.py`).

| Fungsi | Contoh |
|---|---|
| `angka(n, maksDesimal)` | 1.250.000 |
| `rupiah(n)` | Rp 1.250.000 |
| `rupiahRingkas(n)` | Rp 1,25 jt. Hanya untuk kartu sempit, tidak untuk angka dasar keputusan uang |
| `angkaJumlah(n)` | 23,4 (desimal mengikuti angkanya, untuk jumlah yang dibandingkan sebaris) |
| `bintang(n)` | 4,0 (selalu satu desimal) |
| `waktuLalu(d)` | 5 menit lalu, kemarin, 12 Okt (paling kecil "1 menit") |

Harga seperti "Rp 93.000/kg" dikunci satu baris (`whitespace-nowrap`), supaya "Rp" tidak
terpisah dari angkanya di 360px.

## 4. Spasi, sudut, dan bayangan

- **Satuan:** skala spasi bawaan Tailwind (4px). Ritme yang paling sering dipakai: 12px dan
  16px (`gap-3`, `p-4`). Langkah setengah (`x.5`) yang sudah ada dibiarkan; tidak perlu
  ditambah.
- **Tepi halaman:** `px-4` di HP, `sm:px-6` mulai 640px. Lebar isi maksimal 1400px.
- **Sudut:**

  | Token | Nilai | Dipakai untuk |
  |---|---|---|
  | `rounded-sm` | 8px | Tombol kecil, lencana |
  | `rounded-md` | 12px | Tombol, kolom isian, tombol ikon |
  | `rounded-lg` | 16px | Kartu, jalur tab |
  | `rounded-xl` | 22px | Lembar (sheet) |
  | `rounded-full` | — | Chip, titik status |

  Radius majoo lebih besar (24–34px untuk kartu). Yang dipakai tetap token di atas.
- **Bayangan:** `shadow-e1` untuk kartu dan tombol penuh, `shadow-e2` untuk kartu yang
  disorot, dan `shadow-e3` untuk lembar dan toast. Token `shadow-sheet` ada di `index.css`
  tetapi belum dipakai.

## 5. Tata letak

| | HP (di bawah 1024px) | Desktop (`lg`, 1024px ke atas) |
|---|---|---|
| Bilah atas | 56px, menempel, berisi lonceng dan keranjang | Disembunyikan |
| Navigasi | Bilah bawah setinggi `--nav-h` (4,5rem) | Navigasi samping selebar `--rail-w` (16,5rem), termasuk Pemberitahuan dan Keranjang dengan lencana |
| Jarak atas `<main>` | `pt-4` | `lg:pt-6` |

- **Tab navigasi:**
  - pemilik usaha: lima tab (Beranda · Stok · Prediksi · Distributor · Pesanan);
  - UMKM produsen: tab keenam Produksi sesudah Stok;
  - portal distributor: enam tab (Beranda · Pesanan · Kontrak · Promo · Pelanggan · Profil).
  - Tab baru di HP harus diukur ulang di 360px. Label terpanjang "Distributor" lebarnya 55,8px.
- **`KepalaHalaman`** (halaman detail) menempel tepat di bawah bilah global lewat
  `top-[var(--kepala-global)]`. Variabel itu bernilai 0 di desktop. Elemen yang digulir otomatis
  ke bawah kepala memakai `scroll-mt-[calc(var(--kepala-global,0px)_+_4.5rem)]`.
- **`BilahAksi`** (satu aksi utama, misalnya kirim pesanan) menempel tepat di atas navigasi
  bawah, bukan di `bottom-0`. Di desktop tombolnya berkumpul di kanan, paling lebar `max-w-md`.
- **Tidak boleh ada geseran horizontal di 360px.**
  - Tabel dan grafik lebar menggulir di dalam wadahnya sendiri.
  - Setiap grid berisi kartu diberi `[&>*]:min-w-0`.
  - Lencana panjang dibiarkan membungkus.
- **Kisi di desktop, korsel di HP:** daftar tugas Beranda tampil dalam kisi mulai `lg` dan korsel
  satu kartu per layar di HP. Ubin pintasan berangka muncul mulai `sm`.
- **Tombol selebar wadah hanya di HP:** `penuh="hp"` membuat tombol selebar wadah di HP dan
  selebar isinya mulai 640px. Tombol selebar 1.000px terbaca seperti spanduk.

## 6. Komponen

Cari komponen yang sudah ada sebelum menulis yang baru. Komponen dasar ada di
`frontend/src/components/ui/`, dan komponen khusus aplikasi di `components/domain/`.

**Hierarki tombol** (`Tombol`, `TombolTautan`):

| Ragam | Tampilan | Kapan |
|---|---|---|
| `utama` | Ungu penuh | **Satu per layar:** langkah berikutnya yang paling mungkin |
| `sekunder` | Ungu lembut | Aksi penting kedua, misalnya Terima di kartu pesanan masuk |
| `garis` | Putih bergaris | Alternatif setara, misalnya Ikat Kontrak di samping Beli Sekali |
| `halus` / `sunyi` | Abu-abu / transparan | Aksi pelengkap di kartu dan kepala |
| `tautan` | Teks ungu | Aksi tersier, "Lihat semua" |
| `bahaya` | Merah penuh | Hanya di dalam `Konfirmasi`, untuk aksi yang tidak bisa dibatalkan |
| `bahaya-garis` | Teks dan bingkai merah | Pemicu aksi berbahaya di luar dialog |

- **Ukuran:**
  - `kecil` tampil setinggi 36px, dengan area sentuh yang diperlebar ke 44px lewat
    pseudo-element;
  - `sedang` 44px;
  - `besar` 52px.
  - `TombolIkon` berukuran 44 × 44 dan wajib punya `label`.
- **Di daftar kartu,** hanya kartu pertama yang boleh bertombol utama (`KartuTindakan utama`).
- **Saat aksi sedang dikirim,** tombolnya memakai `memuat`, supaya ketukan ganda tidak
  mengirim dua kali.
- **Label tombol pendek.** `Tombol` memakai `whitespace-nowrap`, jadi keterangan tambahan
  ditulis di baris bantuan di bawahnya.

**Keadaan terpilih ada dua, dan keduanya bukan ungu penuh:**
- **`TabSegmen`** mengganti tampilan dalam halaman. Bentuknya jalur `bg-sunken`, dengan tab
  terpilih `bg-surface shadow-e1`.
- **`Chip`** menyaring daftar. Chip terpilih memakai `bg-brand-soft text-brand-soft-ink
  border-brand`. Tombol pilihan di Akun dan Profil memakai gaya yang sama.

**Umpan balik dan isi:**

| Kebutuhan | Komponen |
|---|---|
| Kartu biasa / kartu yang seluruhnya bisa ditekan | `Kartu`, `KartuTautan` |
| Judul bagian dengan aksi di kanan | `JudulBagian` |
| Status pendek | `Lencana nada=...` dengan ikon, atau `Titik` yang selalu disertai teks |
| Kotak peringatan dan informasi | `Peringatan` (ikon dan warna mengikuti nada) |
| Rincian yang boleh tidak dibaca | `Penjelasan` (`<details>`, label bawaan "Selengkapnya") |
| Daftar kosong | `KeadaanKosong` |
| Hasil aksi | Toast lewat `tampilkanRacun(teks, nada)`; aksi massal cukup satu toast ringkasan |
| Lembar bawah dan konfirmasi | `Lembar`, `Konfirmasi` |
| Kolom isian | `Kolom`, `AreaTeks`, `Pilihan`, `PengaturJumlah`; bingkai galat lewat `kelasBingkai(galat)` |
| Nama metode analitik | `KeteranganMetode`, sekali per halaman (Mesin 1 di Prediksi, Mesin 2 di saran distributor dan Belanja, Mesin 3 di Pelanggan) |
| Logo toko dan gambar produk | `Avatar`, yang mencari gambar lewat `gambarUntuk(nama)` dengan huruf awal sebagai cadangan |

**Ikon** dibuat sendiri di `frontend/src/icons/`: garis 1,75px, kotak 24px, dan selalu
`aria-hidden`. Maknanya dibawa oleh teks di sebelahnya. Pustaka ikon tidak dipakai, demi
ukuran bundel.

## 7. Gerak dan interaksi

| Gerak | Durasi dan kurva |
|---|---|
| Perubahan warna dan bayangan | 150ms |
| Lembar naik | 260ms `cubic-bezier(0.22, 1, 0.36, 1)` |
| Muncul halus | 220ms dengan kurva yang sama |
| Latar memudar | 180ms |

- **Gerak dikurangi:** dengan `prefers-reduced-motion`, semua animasi dan transisi dimatikan.
- **Fokus keyboard:** garis 2px warna merek, berjarak 2px.
- **Korsel Beranda di HP:** tanpa tombol jeda. Ia berhenti selamanya begitu pengguna mengambil
  alih, dan juga berhenti saat disorot, difokus, atau tabnya tersembunyi. Ini longgar terhadap
  WCAG 2.2.2 (keputusan tim, 2 Oktober 2026).
- **Kerangka pemuatan** (`.skeleton`, `Kerangka`, `KerangkaBaris`) dipakai selama data dimuat
  di koneksi lambat.

## 8. Suara dan kosakata

- **Sapaan dan bahasa:** Bahasa Indonesia dengan sapaan "kamu". Komentar kode juga berbahasa
  Indonesia.
- **Kata yang tidak boleh tampil di layar:** "error", "server", "API", "timeout",
  "sinkron gagal".
- **"Berhasil"** hanya ditulis sesudah ada balasan. Bedakan "Tersimpan" dan "Terkirim".
- **Pesan kesalahan** memuat tiga hal: apa yang salah, cara memperbaikinya, dan contoh yang benar.
- **Fakta dulu, penjelasan dilipat.** Kalimat yang tampil cukup satu, paling panjang sekitar
  90 huruf. Cara membaca grafik, alasan saran, dan data yang dipakai model masuk ke `Penjelasan`.
  Halaman Bantuan dan halaman depan boleh panjang.
- **Satu kata untuk satu aksi:**

| Pakai | Jangan | Catatan |
|---|---|---|
| Beli Sekali | Beli Lepas | Pasangannya Ikat Kontrak |
| Pesan, Pesan Sekarang | — | Hanya untuk mengirim pesanan atau membuka saran distributor |
| Masukkan ke Keranjang | Pesan Sekarang | Untuk aksi yang hanya mengisi keranjang |
| Periksa & Kirim | Buat N Pesanan | Langkah dari Keranjang |
| Terima Barang | — | Satu-satunya tempat stok bertambah |
| Koreksi Stok | — | Penyesuaian hitungan |
| Segera Kedaluwarsa | Hampir kedaluwarsa | |
| Kontrak Akan Berakhir | Kontrak Habis | |
| distributor | pemasok | |
| filter | saringan, saring | |

- **Nama metode** tampil apa adanya ("Mesin 1 · LightGBM"), tetapi kalimat penjelasnya memakai
  bahasa pemilik usaha.

## 9. Larangan

Pola di bawah ini pernah menjadi cacat di proyek ini.

1. Hex atau `text-white` di komponen. Pakai token dan `text-ink-inverse`.
2. Dua tombol ungu penuh di satu layar, atau ungu penuh sebagai tanda terpilih.
3. Status yang hanya berupa warna, atau warna status dan warna merek yang dipakai sebagai
   warna seri grafik.
4. Ukuran teks `text-[Nrem]` baru. Pakai enam token di bagian 3.
5. Keterangan yang perlu dibaca ditulis dengan `text-ink-3`.
6. Dua kelas warna bingkai pada satu elemen. Di Tailwind yang menang adalah urutan di CSS hasil
   build, jadi bingkai merah galat pernah tidak tampil. Pakai `kelasBingkai`.
7. `whitespace-nowrap` pada lencana atau label panjang, atau item grid tanpa `min-w-0`. Keduanya
   melebarkan halaman di 360px.
8. Elemen `sr-only` di dalam wadah gulir yang tidak `relative`. Elemen itu lolos dari wadahnya.
9. Angka gaya Inggris ("4.8", "2029"), termasuk teks yang datang dari backend.
10. Dua widget yang menghitung hal yang sama dengan rumus berbeda. Lencana Beranda dan filter
    di layar tujuan harus membaca populasi yang sama.
11. Harga coret tanpa `sumber: 'promo'`, dan harga yang tidak lewat `usePenentuHarga()`.
12. Stok yang bertambah di luar layar Terima Barang.
13. Isian massal yang menyalin data khas per pesanan (resi, penerima, catatan) ke pesanan
    pemesan lain.
14. Paragraf panjang yang tampil terbuka di layar kerja.

## 10. Yang masih terbuka

- **`seri-3` terlalu dekat dengan ungu merek:** hue-nya hanya berbeda 9° (249° lawan 258°).
  Grafik dengan seri ketiga bisa terbaca "berwarna merek". Pilihannya adalah menggeser hue
  `seri-3` lalu memvalidasi ulang palet. Belum diputuskan.
- **Badge kategori berwarna-warni ala majoo** tidak dipakai untuk status. Untuk kategori produk
  belum diputuskan.
- **Tombol "Login" di halaman depan** tetap berbahasa Inggris, sesuai catatan pemilik proyek
  di kode.

## Cara memeriksa

- **Penyapu rute di konsol peramban:** di 360px dan 1440px, tema terang dan gelap. Ia memeriksa
  crash, galat konsol, geseran horizontal, jumlah `h1`, lompatan tingkat judul, tombol ikon
  tanpa nama, dan kontras per elemen. `tsc` saja tidak cukup.
- **Tangkapan layar:** `tools/tangkap_layar.mjs` untuk membandingkan sebelum dan sesudah.
- **Palet grafik:** `validate_palette.js` (skill dataviz) untuk setiap perubahan warna seri.
