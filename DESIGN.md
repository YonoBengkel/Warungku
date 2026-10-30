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
- **Merek:** ungu `#4a148c` (revisi 23 Okt 2026; dulu `#52329f` dari piksel logo, dan logonya
  ikut diwarnai ulang). Ungu adalah sinyal "langkah berikutnya". Ia bukan hiasan. Coral dan
  kuning hanya sorotan.
- **Mulai dari HP:** semua layar dirancang untuk lebar 360px dulu, lalu dilebarkan ke desktop.

## 2. Warna

Komponen hanya memakai kelas token (`bg-surface`, `text-ink-2`, `border-line`, ...). Hex tidak
pernah ditulis langsung di komponen. Setiap token punya pasangan tema gelap di blok `.dark`.
Kelas `dark` dipasang sekali di `App.tsx` untuk semua rute, termasuk halaman depan, Masuk, dan
Daftar; kerangka halaman tidak memasangnya sendiri.

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
| Merek | `bg-brand`, `text-brand` | `#4a148c` | `#a26ce5` | Tombol utama, tautan, cincin fokus |
| Merek lembut | `bg-brand-soft` + `text-brand-soft-ink` | `#f3ecfb` / `#3a0a73` | `#1d0f33` / `#c4a3f2` | Keadaan terpilih, tombol sekunder |
| Aksen coral | `bg-aksen` + `text-aksen-ink` | `#ff7f50` / `#111a23` | `#e9744b` / `#0b1116` | Isian sorotan: pil potongan di kartu promo berfoto, garis sorot ubin Perlu Tindakan |
| Aksen kuning | `bg-kuning` + `text-kuning-ink` | `#ffcc00` / `#111a23` | sama | Isian sorotan kecil (landing page) |
| Menu samping | `.menu-samping` + `text-samping-ink` / `text-samping-ink-2` | lavender `#f4effb` ke `#ebe3f7`, garis tepi kanan `#e2dbef` (juga membingkai tab menu aktif), teks `#3b2d5c` (9,8 sampai 10,8:1) / `#5b4c7d` (6,1 sampai 6,7:1) | `#1d1729` ke `#17121f`, teks `#ece6f7` (14,3 sampai 15,1:1) / `#b9aed0` (8,3 sampai 8,8:1) | Hanya menu samping desktop (revisi V6, Q122 dan Q130) |
| Pil menu aktif | `.penanda-samping-pil` (`--c-pil-1`, `--c-pil-2`) + `text-pil-ink` | `#ff9a3c` polos, teks `#1f1208` 8,7:1 | sama | Hanya butir menu samping yang aktif (revisi V6, Q129). Batas pil terhadap tab dan latar menu hanya sekitar 1,9:1, jadi butir aktif juga ditandai teks tebal dan `aria-current` |
| Jenis promo | `bg-promo-cuci` / `-baru` / `-anggota` / `-redup`, `.bayang-promo-*` | `#8a3408`, `#4a148c`, `#2d1258`, `#3a4854` | sama | Bayangan foto kartu promo dan tinta lencana jenisnya (revisi V5, Q107) |
| Teks di atas foto | `text-foto-ink` / `text-foto-ink-2`, `bg-foto-pil` | `#ffffff`, putih 90%, pil putih | sama | Hanya di atas foto berbayang; teks putih paling sedikit 4,8:1 di bagian bawah kartu |
| Stabilo | `.stabilo` (`--c-stabilo`) | coral 32% | coral 22% | Sapuan di bawah nama usaha di kepala Beranda (Q106) |

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
- **Di semua layar,** pemakaian aktual memakai `seri-1` dan perkiraan memakai `seri-perkiraan`:
  grafik Prediksi, grafik rincian barang, dan bar "Terpakai bulan ini / Perkiraan bulan depan"
  di Beranda.
- **Donat status pesanan** (revisi V5): Menunggu Konfirmasi `seri-2`, Disiapkan `seri-1`, Dikirim
  `seri-4` biru (`#2a78d6` terang, `#4a8fe8` gelap), draf abu-abu `line-strong`. Set itu lolos
  validator di semua pasangan dan kedua tema; tiap potongan juga tertulis di keterangannya.
- `seri-3` belum dipakai. Sebelum dipakai pertama kali, hue-nya harus digeser menjauh dari ungu
  merek (lihat bagian 10).
- `grid` dan `sumbu` dibuat redup supaya datanya yang menonjol.
- Palet baru atau seri tambahan wajib lolos `validate_palette.js` dari skill dataviz di kedua
  tema, termasuk uji pemisahan buta warna.

**Aturan warna:**
1. **Ungu penuh hanya untuk tombol utama** (dan cincin fokus). Keadaan terpilih memakai
   ungu lembut atau putih terangkat (lihat bagian 6). Menu samping desktop memakai warnanya
   sendiri (revisi V6, Q122): latar lavender, pil aktif jingga bertinta gelap, angka Keranjang
   ungu penuh, dan cincin fokus 3px sewarna teks menu. Gradien ungu pekat V5 sudah tidak dipakai.
2. **Teks di atas warna penuh** (`bg-brand`, `bg-kritis`, `bg-menipis`, `bg-info`) memakai
   `text-ink-inverse`, bukan `text-white`. Di tema gelap `text-white` di atas ungu muda hanya
   3,6:1, di bawah ambang 4,5:1.
3. **Status tidak pernah hanya warna.** Selalu ikon + teks + warna (WCAG 1.4.1).
4. **Merah hanya untuk yang genting.** Tanda wajib `*` dan pemberitahuan biasa tidak merah.
5. **Kontras minimal AA:** 4,5:1 untuk teks dan 3:1 untuk garis grafik dan bingkai isian, di
   kedua tema. Ukur hasil campurannya, jangan menaksir dari hex.
6. **Coral dan kuning hanya isian sorotan** (revisi 23 Okt). `bg-aksen` selalu berpasangan dengan
   `text-aksen-ink` (6,97:1 terang, 6,4:1 gelap), `bg-kuning` dengan `text-kuning-ink` (11,6:1).
   Keduanya tidak pernah menjadi warna teks di atas putih (coral 2,5:1, kuning 1,5:1) dan tidak
   pernah menjadi warna status. Bintang penilaian tetap `text-menipis`: kuning di atas putih
   terlalu pudar untuk membedakan bintang terisi di isian penilaian.

## 3. Tipografi

- **Huruf:** Plus Jakarta Sans 400–800 dari Google Fonts, dengan cadangan `system-ui`. Kepala
  Beranda saja memuat dua huruf tambahan (revisi V6, Q123): Schibsted Grotesk 800
  (`font-sapaan`) dan Fraunces 700 miring (`font-nama-usaha`).
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
- **Baris kepala Stok** (tambahan revisi V6): pengecualian 28px dari revisi V4 (Q83) dicabut.
  Judulnya kembali `text-judul`, dan semua kotak di baris itu (kolom cari, Habis, Menipis, Aman,
  Tambah Barang) setinggi 40px di desktop, sama dengan pil tanggal Beranda. Hurufnya mengikuti
  kotaknya: kolom cari `text-kartu` (16px di HP supaya Safari tidak memperbesar), angka chip
  `text-subjudul` dengan label `text-isi`, Tambah Barang `text-kartu`.
- **Pengecualian Beranda** (revisi V5, Q106 dan Q108, mengikuti rancangannya): sapaan
  "Selamat datang," dan nama usaha 30px di HP dan 40px di desktop. Sejak revisi V6 (Q123)
  hurufnya sama dengan gambar referensi: sapaan Schibsted Grotesk 800, nama usaha Fraunces 700
  miring (satu-satunya huruf miring yang dimuat). Angka Perlu Tindakan 30/36px, angka "hal
  menunggu keputusanmu" 36px, dan angka tengah donat 30px. Judul kartu Beranda `text-subjudul
  font-extrabold text-brand-soft-ink` (`Bagian besar`).
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
| Navigasi | Bilah bawah setinggi `--nav-h` (4,5rem) | `MenuSamping` selebar `--rail-w` (16,5rem), termasuk Keranjang dengan lencana |
| Pemberitahuan | Lonceng di bilah atas, membuka halaman pemberitahuan | Lonceng bulat yang melayang di kanan isi (`LoncengMelayang`), tetap di tempat saat digulir, dan membuka panel di bawahnya. Sejak revisi V6 (Q125, Q132) titik tengahnya sejajar dengan elemen baris kepala yang ditandai `data-sejajar-lonceng` (pil tanggal Beranda, label metode Prediksi, baris judul halaman lain); halaman tanpa tanda memakai 16px dari atas. Baris judul yang berisi di kanan memberi ruang lewat `RUANG_LONCENG` |
| Jarak atas `<main>` | `pt-4` | `lg:pt-6` |
| Jarak bawah | `<main>` `pb-[calc(var(--nav-h)+1rem)]`, ditambah `pb-4`/`pb-6`/`pb-8` akar halaman | `<main>` `lg:pb-5` (20px), akar halaman `lg:pb-0` (revisi V6, Q127) |

- **Tab navigasi:**
  - pemilik usaha: lima tab (Beranda · Stok · Prediksi · Distributor · Pesanan);
  - UMKM produsen: tab keenam Produksi sesudah Stok;
  - portal distributor: lima tab (Beranda · Pesanan · Kontrak · Promo · Pelanggan). Akun toko
    tidak lagi jadi tab (revisi V4, Q93): di desktop blok akun di kiri bawah menu samping (logo,
    nama, "Lihat akun") dengan tanda merek Turnify Flow di kiri atas, di HP logo toko di bilah
    atas. Keduanya membuka halaman akun, seperti avatar di portal usaha.
  - Tab baru di HP harus diukur ulang di 360px. Label terpanjang "Distributor" lebarnya 55,8px.
- **`KepalaHalaman`** (halaman detail) menempel tepat di bawah bilah global lewat
  `top-[var(--kepala-global)]`. Variabel itu bernilai 0 di desktop. Elemen yang digulir otomatis
  ke bawah kepala memakai `scroll-mt-[calc(var(--kepala-global,0px)_+_4.5rem)]`.
  - Sejak revisi V3 kepala ini mulai rapat ke atas (`-mt-4 lg:-mt-6`, sebesar jarak atas
    `<main>`), di posisi yang sama dengan saat menempel, jadi tidak bergeser saat digulir.
    Kepala lengket buatan sendiri (Stok di HP) mengikuti aturan yang sama.
  - Panah kembalinya mundur ke halaman sebelumnya (`useKembali`), persis tombol Back
    peramban. `kembaliKe` hanya cadangan bila halaman dibuka langsung, dan cadangan itu
    mengganti entri riwayat.
  - Tombol Batal di formulir juga memakai `useKembali`. Halaman yang muncul sesudah Simpan atau
    Kirim mengganti formulirnya di riwayat (`navigate(…, { replace: true })`), supaya Back tidak
    membuka lagi formulir yang sudah terkirim. Tombol yang menyebut tujuannya ("Kembali ke Susu &
    Olahan") tetap ke tempat yang disebutnya.
- **`BilahAksi`** (satu aksi utama, misalnya kirim pesanan) selalu di dasar layar (`fixed`),
  berapa pun panjang halamannya (revisi V3):
  - di desktop sejajar blok akun di dasar navigasi samping; di HP tepat di atas navigasi bawah,
    bukan di `bottom-0`;
  - pengganti setinggi bilah di alur halaman menjaga baris terakhir tetap terlihat, dan
    `--tinggi-bilah` mengangkat toast ke atasnya;
  - isinya selebar isi `<main>`; tombolnya berkumpul di kanan, paling lebar `max-w-md`;
  - `lebarAksi="lebar"` untuk kelompok aksi yang lebih lebar, seperti pengatur jumlah ditambah
    tombol.
- **Tidak boleh ada geseran horizontal di 360px.**
  - Tabel dan grafik lebar menggulir di dalam wadahnya sendiri.
  - Setiap grid berisi kartu diberi `[&>*]:min-w-0`.
  - Lencana panjang dibiarkan membungkus.
- **Satu kotak per bagian** (revisi 23 Okt): `Bagian` di Beranda, Dashboard distributor, rincian
  barang, dan Prediksi. Kotak putih `rounded-xl` di atas latar abu-abu mulai 640px; di HP pita
  putih selebar layar tanpa sudut, supaya lebar isinya tidak terpotong dua kali.
- **Daftar tugas Beranda** ("Yang perlu kamu urus hari ini") adalah `Korsel` di semua ukuran:
  3 kartu per halaman mulai 1280px, 2 di 1024–1279px, 1 di HP (revisi V2). Petak Perlu Tindakan
  menaruh ikon dan angka di tengah dengan nama di bawah, kisi 2 × 2 di HP.
  - Beranda distributor memakai bentuk yang sama (revisi V4, Q95): kotak "Yang perlu kamu urus
    hari ini" berisi satu kartu tugas selebar kartu korsel (atau baris hijau "Semua aman hari
    ini."), petak Rekap pesanan dan Sebaran pemesan bergaya Perlu Tindakan, dan kartu Pesanan
    terbaru bergaya `KartuPesanan`. Lima petak Rekap sebaris mulai 1024px; di HP dua kolom dengan
    petak kelima selebar dua kolom.
- **Layar acuan dasbor** (revisi V2, diubah revisi V3): dua ukuran area halaman, **1536 × 834**
  piksel CSS (laptop Ilham, 1920 × 1200 skala 125%) dan **1536 × 730** (laptop 1920 × 1080).
  - Prediksi dan Stok mengisi tinggi layar berapa pun. Halamannya setinggi layar dikurangi jarak
    atas-bawah `<main>` (`min-h-[calc(100dvh-2.75rem)]` sejak revisi V6), dan bagian bawahnya memanjang mengisi
    sisanya: tanpa gulir di 730 dan tanpa ruang kosong di 834.
  - Rincian barang (revisi V5, Q102) di desktop dua baris dan boleh digulir: tiga kartu sama
    tinggi di atas (sisa tercatat dengan sedang dikirim, batas aman, dan kedua tombolnya;
    perkiraan dengan rincian per hari tiga hari ke depan; saran distributor), lalu Tren
    pemakaian dua pertiga dan Riwayat pergerakan sepertiga (lima terakhir dan "Lihat semua").
    Di 1024 sampai 1279px dua kolom; tab Ringkasan dan Riwayat hanya di bawah 1024px. Tata
    letaknya dipilih lewat `useKueriMedia(KUERI_DESKTOP)` (`lib/media.ts`), jadi hanya satu
    susunan yang dirender.
  - Grafik yang memanjang memakai `isiTinggi` (`GrafikTren`, `GrafikBatang`); `tinggi` menjadi
    tinggi paling pendek. Gambar dan daftar yang memanjang duduk di lapisan `absolute`, supaya
    tingginya sendiri tidak menahan wadahnya.
  - Ringkasan Penjualan dan Produksi menaruh angka utamanya di layar pertama.
  - Daftar panjang di dalam dasbor menampilkan yang muat ditambah "Lihat semua ›", atau menggulir
    di kotaknya sendiri.
  - Halaman lain cukup rapi dan seimbang, boleh menggulir.
  - Halaman yang menghitung tinggi layar tidak memberi jarak bawah sendiri di desktop
    (`lg:pb-0`), karena `<main>` sudah memberinya.
- **Formulir panjang** (Tambah dan Ubah Barang, revisi V3) memakai dua kolom selebar halaman
  mulai 1024px, dengan urutan isian tetap dari atas kiri ke bawah kanan. Simpan dan Batal ada di
  `BilahAksi`, dan kolom yang belum beres disebut namanya di kiri bilah.
  - Halaman ubah dan buat promo (`PromoUbah`, revisi V4, Q91) memakai pola yang sama, bukan
    pop-up: pratinjau kartu paling atas di HP dan di atas kolom kanan di desktop, isian yang
    lebar (tingkat keanggotaan) selebar halaman di bawah kedua kolom. Aksi berbahaya
    (Akhiri Sekarang) ada di dasar halaman sebagai `bahaya-garis` dengan `Konfirmasi`, jauh
    dari Simpan.
- **Rincian pesanan mengisi layar** (revisi V4, Q88): mulai 1024px kolom kedua rincian pesanan
  memanjang, dan kotak terakhir tiap kolom memanjang sampai di atas `BilahAksi`.
- **Kotak per kelompok** (Pesanan › Kontrak, revisi V4, Q85): satu `section` per barang atau
  pemasok, tiga per baris mulai 1280px dan dua di 1024–1279px. Kepalanya logo, nama, jumlah, dan
  kewajiban per bulan; isinya satu baris per kontrak (`BarisKontrak`); kaki yang rata bawah
  memuat aksi kelompok.
- **Bagian atas beku** (`BagianAtasBeku`) di halaman daftar Distributor dan Pesanan: di desktop
  judul sampai tab/chip tetap terlihat; di HP hanya kotak cari dan tab, atau tab dan chip. Garis
  bawah muncul begitu halaman digulir.
- **Tombol selebar wadah hanya di HP:** `penuh="hp"` membuat tombol selebar wadah di HP dan
  selebar isinya mulai 640px. Tombol selebar 1.000px terbaca seperti spanduk.
- **Foto tidak dibentangkan** lebih dari sekitar 1,1 kali ukuran aslinya. Foto kecil diberi
  bentuk (kapsul, bingkai) alih-alih diperbesar, seperti foto blok distributor di halaman depan
  (390 × 260). Foto hero (1536 × 1024, sejak 27 Okt 2026) cukup besar untuk mengisi panel kanan
  hero setinggi kartunya sampai tepi kanan, dengan satu lengkung di kiri; `sizes`-nya mengikuti
  lebar gambar setelah `object-cover` (±1,5 × tinggi hero), bukan lebar panelnya.
- **Foto promo** (revisi V5, Q114) di `frontend/public/gambar/promo/`, 1080 piksel, berlisensi
  Unsplash: `cuci-gudang.jpg` oleh CHUTTERSNAP (unsplash.com/photos/BNBA1h-NgdY),
  `keanggotaan.jpg` oleh Claire Abdo (unsplash.com/photos/0gICDd3mAp4), dan `produk-baru.jpg`
  oleh Tim Mossholder (unsplash.com/photos/t14ZhuQQuxE). Selalu di bawah bayangan warna jenis
  promonya, tidak pernah polos di bawah teks.

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
| Kotak satu bagian halaman, dengan atau tanpa judul | `Bagian` (`KELAS_BAGIAN` untuk kotak serupa) |
| Deretan kartu yang digeser | `Korsel`; dengan `judul` panahnya di pojok kanan atas, `aksi` (mis. "Lihat semua") sebelum panah. Bila ada `aksi`, panahnya hilang di bawah 640px: kartu digeser jari dan titiknya menunjukkan posisi |
| Pemberitahuan di desktop | `LoncengMelayang` (revisi V5, Q99 sampai Q101): panel selebar paling banyak 25rem di bawah lonceng, berisi "Tandai semua dibaca", `TabSegmen` "Perlu tindakan" dan "Semua", paling banyak enam `BarisButir` dengan label aksinya, dan "Lihat semua" ke halaman pemberitahuan (tanpa menu samping, dengan tombol kembali). Tertutup oleh ketukan di luar, Esc (fokus kembali ke lonceng), pindah halaman, atau memilih butir. Angka lonceng = butir yang perlu tindakan, dibaca atau belum; membaca hanya menghapus titik biru. Status dibaca disimpan di peramban per akun (`lib/dibaca.ts`) |
| Penyaring dan urutan yang membuka pilihan | `MenuTarik` di perangkat bertetikus (`usePakaiMenuTarik`), `Lembar` di HP; satu keadaan buka dan satu isi untuk keduanya. Chip pemicunya memakai `bukaMenu`. Jangan taruh pemicunya di dalam wadah yang menggulir ke samping: menunya terpotong |
| Status pendek | `Lencana nada=...` dengan ikon, atau `Titik` yang selalu disertai teks |
| Kotak peringatan dan informasi | `Peringatan` (ikon dan warna mengikuti nada) |
| Rincian yang boleh tidak dibaca | `Penjelasan` (`<details>`, label bawaan "Selengkapnya") |
| Daftar kosong | `KeadaanKosong` |
| Hasil aksi | Toast lewat `tampilkanRacun(teks, nada)`; aksi massal cukup satu toast ringkasan |
| Lembar bawah dan konfirmasi | `Lembar`, `Konfirmasi` |
| Kolom isian | `Kolom`, `AreaTeks`, `Pilihan`, `PengaturJumlah`; bingkai galat lewat `kelasBingkai(galat)` |
| Nama metode analitik | `LabelMetode` di kanan judul halaman atau bagian yang dijelaskannya (revisi V2); bagian memakai `bungkus` supaya label turun ke bawah judul bila tidak muat. Nama metode saja, penjelasan 2–3 kalimat di gelembung (hover, ketuk, atau fokus), yang dirata kanan sendiri bila dari kiri ia keluar layar. LightGBM di Prediksi dan Tren, Thompson Sampling + fuzzy di saran distributor dan Rekomendasi, K-Prototypes di Pelanggan. Di halaman Distributor (desktop) label Rekomendasi duduk rata kanan di baris tab, hanya saat bagian itu tampil |
| Asal angka saran beli | `HitunganSaran`: perkiraan bulan depan dikurangi sisa, dibagi isi kemasan, dibulatkan ke atas (`jumlahBeliUntuk`, rumus yang sama dengan `rekomendasiDari`). Di Prediksi per barang bersama "Dipesan dari"; di rincian penawaran ringkas, dalam kemasan jual distributor |
| Logo toko dan gambar produk | `Avatar`, yang mencari gambar lewat `gambarUntuk(nama)` dengan huruf awal sebagai cadangan |
| Tanda merek Turnify Flow | `TandaMerek`: `logo-mark.png` di tema terang, `logo-mark-gelap.png` (ungu terang) di tema gelap |
| Lacak Pesanan | `DaftarLacak` (revisi V3): satu baris per pesanan dengan garis empat status Menunggu Konfirmasi → Disiapkan → Dikirim → Selesai, bertanggal dari riwayat; truk di antara Dikirim dan Selesai selama di jalan. Dibuka lewat `TombolLacak` (berangka) di halaman Pesanan |
| Peta satu pesanan | `PetaPesanan` di rincian pesanan selama pesanan berjalan (di atas Pembayaran atau Jejak Pesanan), memakai `PetaLacak` dan `KeteranganPeta`: Leaflet dengan ubin OpenStreetMap, dimuat malas. Posisi kiriman selalu disebut "perkiraan posisi" |
| Peta sebaran pemesan | `PetaSebaran` (revisi V4, Q87): Leaflet + OpenStreetMap lewat `buatPeta` yang sama dengan `PetaLacak`, penanda cincin bernomor per kondisi (merah utuh, jingga putus-putus, biru ganda). Bentuk cincinnya `Cincin` dan `TandaTitik` di `TandaTitik.tsx`, berkas tanpa Leaflet, supaya petak Beranda tidak memuat pustaka peta. Di desktop kolom peta setinggi layar |
| Kartu promo | `KartuPromo` (revisi V5, Q107): satu foto per jenis promo (`FotoPromo`) dengan bayangan warna jenisnya, lencana jenis pil putih (`LencanaJenisPromo`, ikon label, kilau, mahkota), judul, nama toko, pil potongan, dan tanggal. Dipakai Beranda, `/promo`, daftar promo distributor (`redup` untuk yang berakhir), dan pratinjaunya; spanduk rincian promo memakai `FotoPromo pekat`. Logo per kategori barang V4 sudah tidak dipakai, masternya diarsipkan di `docs/desain/logo-promo/`. Lencana kecil di jalur beli (`LencanaPromo`) memakai ikon jenis yang sama |
| Kepala Beranda | `KepalaSambutan` (Q106, Q123): sapaan, nama usaha miring ungu berstabilo, keterangan opsional, pil tanggal di kanan sebelah lonceng; di HP ditumpuk. Keterangan UMKM adalah baris status data kasir (`PitaDataKasir`, revisi V6, Q124 dan Q131): satu gaya untuk semua keadaan, ikon bulat 18px dari `public/gambar/status/` (centang hijau dari Ilham, seru amber, pensil ungu, info biru), teks kecil, dan tautan tebal bila ada tindakan. Tanpa pita berwarna |
| Pintasan Perlu Tindakan | `PerluTindakan` (Q108): empat ubin tanpa bingkai berikon ilustrasi dari rancangan (`public/gambar/tindakan/`), angka di samping ikon, nama di bawah; disorot: terangkat, ikon membesar, garis coral di bawah (tanpa gerak bila gerak dikurangi) |
| Daftar urusan | `KartuUrusan` dan `BarisUrusan` (Q109): angka besar "N hal menunggu keputusanmu", tiga baris teratas, "Lihat semua" membuka sisanya di kartu itu juga. Satu tombol per baris; hanya baris teratas yang tombolnya ungu penuh, dan latar merah hanya untuk baris yang genting |
| Donat status | `DonatStatus` (Q109, Q118): total di tengah, keterangan berangka di kanan (bisa jadi tautan), celah 2px antarpotongan, keterangan pembaca layar lewat `label` |
| Menu halaman akun | `Kelompok`, `BarisMenu`, `TombolPilihan` (`components/ui/menuAkun.tsx`), dipakai Akun pemilik usaha dan Akun distributor (revisi V4, Q94). Alat uji purwarupa (masuk/keluar akun simulasi, ganti peran) selalu di kotak bergaris putus paling bawah halaman akun; sejak revisi V5 (Q103) satu baris tiga kolom di desktop (pengantar, lalu dua alat) dengan tombol sejajar di dasar kolom. Simulasi turun derajat perkiraan sudah dihapus. Sejak revisi V6 (Q126) bagian Tampilan paling bawah, di bawah alat uji: Terang, Gelap, dan Keluar (`bahaya-garis`, minta konfirmasi) sebaris di semua ukuran. Akun distributor hanya Terang dan Gelap, karena keluar dari akun distributor ada di alat uji |
| Memilih satu titik di peta | `PetaPilihTitik`: ketuk peta, atau geser dengan tombol panah lalu "Pakai titik tengah peta" |
| Menu samping desktop | `MenuSamping` (revisi V5, Q111; warna dan gerak revisi V6): tanda merek, daftar utama, garis, daftar tambahan (Keranjang, Ringkasan Penjualan) dengan angka opsional, dan kartu akun putih di dasar. Penanda aktif (`.penanda-samping`) berbentuk seperti `SIdebar.html` dengan warna V6: tab sewarna latar halaman yang menyambung ke halaman, lengkung cekung 28px di atas dan bawahnya, dan pil jingga di dalamnya. Karena latar halaman nyaris sewarna lavender (ΔE 2 sampai 4), tab dan lengkungnya diberi garis 1px sewarna garis tepi menu. Penanda diukur dari butir aktif lalu digeser 420ms, dan sudah berangkat saat butir diklik, sebelum halaman berganti (Q121). Supaya pil bisa bergeser, kerangka tidak dipasang ulang saat pindah halaman: batas galat dan `Suspense` hanya membungkus isi halaman (`IsiHalaman`). Mati bila gerak dikurangi. Halaman di luar daftar (Akun) tanpa penanda. Lacak Pesanan tidak di sini sejak revisi V3 |
| Ringkasan penjualan | `TampilanRingkasan` (halaman) dan `KartuRingkasanPenjualan` (Beranda, Dashboard). Tanpa laba kotor; angka utama dibandingkan dengan periode sebelumnya yang sama panjang, dengan ikon dan kata. Di Beranda (revisi V5, butir 4A): tiga petak berikon ilustrasi Flaticon 40px (`public/gambar/penjualan/`, revisi V6, Q128) dengan chip naik (hijau) atau turun (jingga), lalu batang per hari `seri-1` dengan batang tertinggi diberi angka |

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
| Geser korsel satu halaman | 300ms, kurva keluar |
| Pil menu samping | 420ms `cubic-bezier(0.76, 0, 0.24, 1)`, berangkat saat diklik (revisi V6, Q121) |
| Menu tarik-turun: buka saat disorot / tutup saat kursor pergi | jeda 150ms / 250ms |

- **Gerak dikurangi:** dengan `prefers-reduced-motion`, semua animasi dan transisi dimatikan.
- **Fokus keyboard:** garis 2px warna merek, berjarak 2px.
- **Korsel:** bergeser per halaman, yaitu sebanyak kartu yang muat sekaligus (promo Beranda: 3 di
  desktop, 2 di tablet, 1 di HP). Panah, titik penanda, geseran jari, dan tarikan tetikus
  semuanya per halaman. Promo dan daftar tugas Beranda berputar sendiri tiap 3 detik (tugas atas
  keputusan Ilham, revisi V2).
- **Korsel otomatis tanpa tombol jeda.** Ia berhenti selamanya begitu pengguna mengambil alih, dan
  juga berhenti saat disorot, difokus, atau tabnya tersembunyi. Ini longgar terhadap WCAG 2.2.2
  (keputusan tim, 2 Oktober 2026).
- **Menu tarik-turun:** klik tetikus pada pemicu yang sudah terbuka karena disorot tidak
  menutupnya; Enter membuka dan menutup, Esc menutup dan mengembalikan fokus ke pemicu.
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
| Masuk | Login | Termasuk tombol di halaman depan (revisi 23 Okt 2026) |

- **Nama metode** tampil apa adanya lewat `LabelMetode` ("LightGBM"), tanpa "Mesin 1/2/3" dan
  tanpa diulang di kalimat deskripsi halaman. Penjelasannya di gelembung, berbahasa pemilik usaha,
  tanpa angka peluang, skor, atau nama rumus.

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

- **`seri-3` terlalu dekat dengan ungu merek:** hue-nya hanya berbeda 18° (249° lawan 267°
  sejak ungu `#4a148c`; dulu 9° dari `#52329f`).
  Sejak 20 Oktober 2026 token ini tidak dipakai di layar mana pun, karena satu-satunya
  pemakainya (bar Beranda) pindah ke `seri-1` dan `seri-perkiraan`. Hue penggantinya diputuskan
  saat ada grafik yang butuh seri ketiga, lalu palet divalidasi ulang.
- **Badge kategori berwarna-warni ala majoo** tidak dipakai untuk status. Untuk kategori produk
  belum diputuskan.

## Cara memeriksa

- **Penyapu rute di konsol peramban:** di 360px dan 1440px, tema terang dan gelap. Ia memeriksa
  crash, galat konsol, geseran horizontal, jumlah `h1`, lompatan tingkat judul, tombol ikon
  tanpa nama, dan kontras per elemen. `tsc` saja tidak cukup.
- **Tangkapan layar:** `tools/tangkap_layar.mjs` untuk membandingkan sebelum dan sesudah.
- **Palet grafik:** `validate_palette.js` (skill dataviz) untuk setiap perubahan warna seri.
