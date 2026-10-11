# Dokumen Improvement — Interface Pemilik Usaha (VERSI FINAL)

Ruang lingkup: HANYA interface Pemilik Usaha. Dokumen ini adalah spesifikasi implementasi UI — nama layar, label tombol, isi kartu, urutan langkah, dan keadaan kosong/error di dalamnya bersifat mengikat.

---

## 1. Ringkasan Eksekutif

Rancangan lama menyusun aplikasi mengikuti bentuk database, bukan mengikuti pertanyaan harian pemilik warung. Tiga hal patah, dan ketiganya jalan buntu fungsional, bukan soal rasa.

**Lingkaran datanya terbuka.** Seluruh sitemap lama hanya menjelaskan stok BERKURANG. Tidak ada satu pun layar yang membuat stok BERTAMBAH ketika kiriman distributor tiba. Akibatnya berantai: angka gudang hanya bisa turun selamanya, peringatan "stok tipis" terus berbunyi untuk barang yang karungnya sudah ada di gudang, progres kuota kontrak tidak pernah bergerak, dan payload historis ke microservice ML tidak pernah punya catatan pemasukan.

**Pesanan tidak punya rumah.** Setelah "Konfirmasi Pesanan", pesanan masuk ruang hampa. Pertanyaan harian pemilik warung bukan "berapa prediksi penjualan saya" melainkan "kopi saya jadi dikirim hari ini nggak?" — dan notifikasi bukan tempat menyimpan daftar kerja.

**Tujuh fitur yatim.** Rancangan menyatakan "menu disederhanakan jadi 3" tapi mendaftar 6 halaman. Profil UMKM, pengaturan notifikasi, RBAC Kasir vs Manajer, tiering Default/Premium, Mode Resep vs Barang Utuh, Tentang Aplikasi, dan Pusat Bantuan tidak punya tab yang menampungnya. Fitur tanpa pintu masuk sama dengan fitur yang tidak dibangun.

Di atas ketiganya, layar yang paling sering dibuka dirancang dengan pola desktop (tabel 4 kolom, grafik garis sebagai elemen pertama) untuk pengguna yang memegang HP 360px sambil melayani pembeli.

**Bentuk barunya:** empat tab datar — **Beranda · Stok · Belanja · Pesanan** — plus tiga ikon tetap di kepala halaman: lonceng **Pemberitahuan**, **Keranjang**, avatar **Akun**. Total 51 rute, semuanya datar per entitas. Beranda berubah dari galeri grafik jadi daftar "Perlu Diurus" yang tiap barisnya punya satu tombol tindakan. Stok jadi daftar keputusan satu kolom; kategori turun pangkat jadi chip filter; halaman "Kategori > Produk" dibubarkan karena harga jual memang milik POS eksternal. Kontrak tidak diberi tab sendiri melainkan jadi segmen tengah tab Pesanan, dikelompokkan per barang, karena progres kuotanya secara harfiah dihitung dari pesanan. Alur inti ditutup rapat: prediksi → pemberitahuan → Lembar Pesan Cepat → Keranjang → Pesanan → **Terima Barang** → stok naik → kuota kontrak naik.

Kedalaman sitemap diputuskan oleh satu aturan yang bisa diuji, bukan oleh selera: **sebuah lembar (bottom sheet) hanya diberi rute kalau ada sesuatu di luar layar induknya yang menautinya.** Koreksi Stok dapat rute karena kartu tugas Data Kasir dan pita stok minus menautinya; Atur Resep tidak, karena ia hanya bisa dicapai dari dalam Detail Barang. Aturan ini menjaga navigasi tetap dangkal tanpa membuat tautan notifikasi menabrak layar yang tidak punya alamat.

---

## 2. Masalah Struktural pada Rancangan Lama

**M-1. "Muncul fitur dari 3 pilihan Page" tapi sitemapnya 6 halaman.** Pesanan dan Profil & Pengaturan tidak punya pintu masuk. Tujuh fitur yatim; siklus hidup pesanan hidup hanya sebagai efek samping push.

**M-2. Tidak ada layar untuk pesanan yang sudah dikirim.** Pertanyaan paling sering pemilik warung tidak punya jawaban di layar mana pun.

**M-3. Tidak ada satu pun layar yang membuat stok BERTAMBAH.** Lingkaran data terbuka (§1).

**M-4. "Pengaturan notifikasi" ada, daftar notifikasi tidak ada.** Di Android kelas menengah dengan koneksi tidak stabil, push pasti ada yang terlewat. Satu push terlewat = satu rekomendasi ML hilang permanen.

**M-5. "Grafik Prediksi Penjualan" sebagai elemen pertama Dashboard.** Objek paling lambat dimuat, paling lambat dipahami, dan paling tidak bisa ditindaklanjuti menempati tempat paling berharga; satu-satunya hal yang butuh keputusan hari ini terdorong ke bawah lipatan.

**M-6. "Tabel bahan baku (nama, sisa stok, kategori)".** Tidak muat di 360px; tanpa pencarian, filter, maupun sortir, barang yang habis tenggelam di tengah 40–80 baris alfabetis.

**M-7. "Kategori > Produk (Stok, Harga, Jumlah)".** Kategori jadi level navigasi → koreksi stok gula darurat 4 lapis ketukan, plus biaya salah tebak kategori ("susu UHT itu Minuman atau Bahan Dingin?"). Kolom "Harga" bertabrakan dengan keputusan final bahwa harga jual dikelola di POS eksternal.

**M-8. "Riwayat log sinkronisasi POS" di dalam Inventori.** Mencampur jawaban bisnis ("kenapa gula saya berkurang 5 kg?") dengan daftar kegagalan API; tab Stok terasa seperti alat teknisi.

**M-9. Registrasi 7 kolom satu layar.** Dua kolom bernama nyaris identik tanpa merujuk dokumen yang bisa dikenali, dan mayoritas warung sasaran tidak punya NIB. Berhenti di kolom ke-5 = seluruh isian hilang karena akun belum pernah dibuat; user yang gagal tidak meninggalkan jejak untuk dihubungi.

**M-10. "Sinkronisasi" sebagai satu langkah.** Isinya Base URL dan API Key — mustahil diisi pemilik warung. Segmen terbesar tidak memakai kasir digital, jadi satu-satunya jalan keluar mereka "Lewati untuk saat ini" berujung aplikasi kosong selamanya.

**M-11. "Marketplace: Kontrak" sebagai saudara "Eksplorasi".** Mencampur akuisisi (sesekali, eksploratif) dengan pemantauan komitmen berulang; pemilik harus masuk layar promosi untuk mengecek kewajibannya.

**M-12. "1 kontrak = 1 barang" tanpa lapisan pengelompokan.** Kafe dengan kopi+susu+gula dari satu distributor memegang 3 kartu kembar, dan tidak ada layar yang menjawab "bulan ini saya wajib ambil apa saja dari Pak Budi?".

**M-13. "Pelaku usaha langsung memilih salah satu jenis kontrak."** Satu ketukan melahirkan kewajiban 3 bulan yang tidak boleh diputus, sementara angka TOTAL komitmen (240 × 3 = 720 karung) tidak pernah muncul di layar mana pun.

**M-14. Default keranjang dari prediksi dengan tombol plus/minus.** Saran model bisa 250 pcs; menekan + 250 kali mustahil. Distributor menjual per dus isi 24, jadi angka satuan pakai akan ditolak setelah dikonfirmasi.

**M-15. Keranjang draft digambarkan tunggal.** Satu rekomendasi mingguan bisa terikat 3 kontrak di 2 distributor; satu tombol "Konfirmasi Pesanan" diam-diam melahirkan beberapa pesanan dengan ongkir dan jadwal berbeda.

**M-16. "Review Distributor" tanpa layar penulis dan tanpa aturan siapa boleh menulis.** Kalau tombolnya ada di profil distributor, rating bisa dipalsukan akun boneka — padahal rating adalah satu-satunya dasar memilih pemasok untuk komitmen yang tidak bisa diputus.

**M-17. Verifikasi Admin tanpa tempat tinggal di UI.** Tidak ada penyataan status, tidak ada tempat memberi tahu apa yang salah kalau ditolak, tidak ada keputusan tentang apa yang boleh dipakai selama menunggu.

---

## 3. Struktur Navigasi Baru

### 3.1 Bilah utama — tepat 4 item

| # | Label | Ikon | Rute akar | Menjawab |
|---|---|---|---|---|
| 1 | **Beranda** | rumah | `/beranda` | "Hari ini saya harus ngapain?" |
| 2 | **Stok** | kardus | `/stok` | "Sisa gula saya berapa?" |
| 3 | **Belanja** | toko | `/belanja` | "Siapa yang jual gula, berapa?" |
| 4 | **Pesanan** | truk | `/pesanan` | "Pesanan saya sudah dikirim belum?" |

**Kepala halaman global (semua tab), 3 ikon:** lonceng **Pemberitahuan** (badge hanya menghitung yang butuh tindakan), **Keranjang** (badge jumlah baris), avatar **Akun**.

**Kenapa 4, bukan 3 atau 5.** Dengan 3 tab, Pesanan jadi sub-tab di dalam Belanja: pertanyaan paling sering butuh 3 ketukan, melewati katalog penuh gambar yang berat di koneksi buruk, plus dua lapis bilah tab bertumpuk di 360px. Dengan 5 tab (Kontrak sendiri), fitur yang dibuka sebulan sekali mengambil 20% slot permanen dan label mulai terpotong. Yang ditambah dari angka 3 bukan halaman fitur baru melainkan **kotak keluar**.

**Aturan pemisah wajib:** tab **Belanja** TIDAK PERNAH menampilkan pesanan sendiri; tab **Pesanan** TIDAK PERNAH menampilkan katalog. Ikon toko vs truk dipilih agar kontras bentuknya jelas di layar berkontras rendah. **Desktop memakai item dan rute yang sama persis** sebagai side nav; dilarang menambah menu khusus desktop.

### 3.2 Aturan rute yang mengikat implementasi

1. **Rute datar per entitas, lepas dari posisi navigasi.** `/kontrak/:id` dan `/penawaran/:id` berdiri sendiri walau dirender di dalam tab. Memindahkan menu nanti tidak mematikan tautan notifikasi lama.
2. **Tiap rute punya peta ke tab induk.** Membuka `/kontrak/:id` dari notifikasi menyorot tab Pesanan; kalau tumpukan riwayat kosong, Kembali membawa ke `/pesanan`, bukan keluar aplikasi.
3. **Filter dan kata kunci ditulis ke query string** — `/stok?filter=hampir-habis`, `/belanja?cari=gula`, `/pesanan?tab=kontrak` — supaya kartu Beranda cukup jadi tautan, bukan logika khusus.
4. **Lembar diberi rute HANYA bila ada tautan dari luar layar induknya.** `/stok/:id/koreksi` dan `/stok/:id/batas-aman` punya rute; Atur Resep, Unggah Bukti Transfer, dan dialog Batalkan Pesanan tidak.

### 3.3 Kamus label — dikunci, satu berkas string

| Istilah lama | Label di layar |
|---|---|
| Dashboard | **Beranda** |
| Inventori Gudang | **Stok** |
| Marketplace Distributor | **Belanja** (judul dalam halaman: "Belanja Stok dari Distributor") |
| Sinkronisasi API POS | **Hubungkan Aplikasi Kasir** (setup) / **Data dari Kasir** (berjalan) |
| Riwayat Log Sinkronisasi | **Riwayat Data Kasir** |
| Reorder Point | **Batas Aman** (+ teks bantu tetap: "Kalau stok turun sampai angka ini, kami kirim pengingat.") |
| SKU | **Kode Barang (opsional)** |
| keranjang draft | **Lembar Pesan Cepat** (komponennya) / **"Belanja belum dikirim"** (keadaan tersimpannya) |
| Mode Resep / Barang Utuh | **Cara Hitung Stok** → pertanyaan "Apa yang Anda jual?" |
| prediksi | **Perkiraan** di semua layar operasional |

**Sengaja tidak dilunakkan:** **Distributor** (tercetak di kontrak) dan **Kontrak** (aturannya memang mengikat; "Langganan" akan menyesatkan). Untuk alasan yang sama, komponen kuota bernama **Kuota Bulan Ini**, bukan "Target Beli per Bulan" — "target" menyiratkan sasaran yang boleh meleset, sedangkan kuota adalah kewajiban kontraktual. Judul komponen selalu disertai teks bantu "minimal ambil per bulan".

### 3.4 Pemetaan fitur brief → lokasi (tidak ada fitur yatim)

Login → `/masuk`. Registrasi 7 kolom → `/daftar` + `/daftar/usaha` + `/daftar/legalitas`. Pendaftaran Berhasil → dihapus, jadi banner Beranda. Sinkronisasi API POS + riwayat log → `/akun/kasir`. Stok/gudang → `/stok`. Kategori → chip filter + `/stok/kategori`. Produk (Stok, Harga, Jumlah) → `/stok/:id` **tanpa kolom harga jual**. Penyesuaian manual → `/stok/:id/koreksi`. Mode Resep/Barang Utuh → `/daftar/usaha` + `/akun/jenis-usaha`. Dashboard Prediksi → blok ke-5 `/beranda` + grafik penuh `/stok/:id`. Notifikasi Peringatan & Rekomendasi → `/notifikasi`. "Pesan sekarang"/keranjang otomatis → `/pesan-cepat/:idSaran` + `/keranjang`. Marketplace → `/belanja`. Distributor List + List Produk → `/distributor/:id`. Kontrak A–E → `/penawaran/:id/kontrak`. Kontrak aktif + progres kuota → `/pesanan?tab=kontrak` + `/kontrak/:id`. "Buat Pesanan Rutin" → `/kontrak/:id/rutin`. Review Distributor → `/pesanan/:id/ulasan` + `/akun/ulasan`. Profil UMKM (Bio IG) → `/akun/profil`. Verifikasi Admin → banner + `/akun/profil` + `/akun/data-usaha`. Pengaturan notifikasi → `/akun/notifikasi`. RBAC → `/akun/pengguna`. Tiering → `/akun/langganan`. Otomasi pembayaran Premium → komponen pengganti di blok Pembayaran `/pesanan/:id`. Tentang Aplikasi + Pusat Bantuan → digabung jadi `/akun/bantuan`.

---

## 4. Sitemap & Hierarki Layar

```
/masuk                             Masuk
/daftar                            Daftar — Buat Akun (1/3)
  /daftar/usaha                    Tentang Usaha Anda (2/3)
  /daftar/legalitas                Data Legalitas (3/3)
/lupa-sandi                        Lupa Kata Sandi                (P1)
/mulai/batas-aman                  Kapan Kami Harus Mengingatkan Anda?

[TAB 1] /beranda                   Beranda

[TAB 2] /stok                      Stok
  /stok/baru                       Tambah Barang
  /stok/:id                        Detail Barang (Ringkasan · Resep* · Riwayat)
    /stok/:id/ubah                 Ubah Barang
    /stok/:id/koreksi              Koreksi Stok
    /stok/:id/batas-aman           Atur Batas Aman
    /stok/:id/rapor                Rapor Perkiraan                (P2)
  /stok/pemakaian                  Catat Pemakaian Harian
  /stok/hitung                     Hitung Stok                    (P1)
    /stok/hitung/ringkasan         Ringkasan Hasil Hitung         (P1)
  /stok/kategori                   Kelola Kategori                (P2)

[TAB 3] /belanja                   Belanja (?tab=barang|distributor)
  /distributor/:id                 Profil Distributor
    /distributor/:id/ulasan        Ulasan Distributor             (P1)
  /penawaran/:id                   Detail Penawaran
    /penawaran/:id/kontrak         Pilih Paket Kontrak
    .../kontrak/:paket             Rincian Paket Kontrak
    .../kontrak/:paket/tinjau      Periksa Kesepakatan

[TAB 4] /pesanan                   Pesanan (Berjalan · Kontrak · Selesai)
  /pesanan/:id                     Detail Pesanan
    /pesanan/:id/terima            Terima Barang
    /pesanan/:id/ulasan            Beri Penilaian                 (P1)
  /kontrak/:id                     Rincian Kontrak
    /kontrak/:id/rutin             Atur Pesanan Rutin             (P2)
  /mitra/:id                       Kerja Sama dengan Distributor  (P1)

[HEADER] /notifikasi               Pemberitahuan
[HEADER] /keranjang                Keranjang
  /keranjang/ringkasan             Ringkasan Sebelum Kirim
  /keranjang/selesai               Pesanan Dibuat
[OVERLAY] /pesan-cepat/:idSaran    Lembar Pesan Cepat

[HEADER] /akun                     Akun
  /akun/profil                     Profil Usaha (+ status verifikasi)
    /akun/profil/pratinjau         Lihat sebagai Distributor      (P2)
  /akun/data-usaha                 Data Usaha & Legalitas
  /akun/kasir                      Data dari Kasir
                                   (Sambungan · Perlu Dibereskan · Riwayat)
    /akun/kasir/panduan/:merek     Panduan Sambungkan Kasir
    /akun/kasir/pasangkan/:idMenu  Pasangkan Menu ke Bahan        (P1)
  /akun/jenis-usaha                Cara Hitung Stok               (P1)
  /akun/notifikasi                 Pengaturan Pengingat           (P1)
  /akun/pengguna                   Pengguna & Hak Akses           (P2)
    /akun/pengguna/undang          Tambah Pengguna                (P2)
  /akun/langganan                  Langganan                      (P2)
  /akun/ulasan                     Ulasan Saya                    (P2)
  /akun/bantuan                    Bantuan & Tentang Aplikasi     (P1)
```

`/akun/kasir` dipakai dua kali dengan satu komponen: dengan `?langkah=mulai` ia merender kerangka onboarding (bar progres, "Lewati untuk saat ini", rantai ke langkah berikutnya); tanpa parameter itu ia merender kerangka pengaturan. Tidak ada rute `/mulai/sumber-data` terpisah.

---

## 5. Perbaikan Per Modul

### 5.1 Onboarding & Sumber Data Penjualan

**Registrasi tiga langkah, maksimal 4 kolom per langkah.** Bar progres tipis + "Langkah 1 dari 3", tombol utama lengket di bawah, setiap "Lanjut" menyimpan ke server (bukan penyimpanan lokal).

- **`/daftar` — "Buat Akun".** Hanya **Nomor HP** + **Kata Sandi**. Akun langsung tercipta berstatus profil belum lengkap, sehingga user yang terputus bisa masuk lagi dan nomornya sudah bisa dihubungi. Layar Masuk juga berbasis Nomor HP, tab kedua "Pakai Email".
- **`/daftar/usaha` — "Tentang Usaha Anda".** Nama Usaha, Alamat Usaha (+ tombol "Ambil lokasi saat ini"), Nama Pemilik, Email (*opsional*). Di layar yang sama, pertanyaan bisnis **"Apa yang Anda jual?"** — tiga kartu besar: **"Makanan & minuman racikan"** ("Stok dihitung dari bahan bakunya"), **"Barang kemasan siap jual"** ("Stok dihitung per buah"), **"Dua-duanya"**. Kata "resep", "BOM", "mode" tidak pernah muncul. Jawaban hanya menentukan bentuk default form Tambah Barang, tidak mengunci akun.
- **`/daftar/legalitas` — "Data Legalitas".** Kolom **"Nomor Induk Berusaha (NIB)"** (numerik 13 digit; teks bantu "13 angka dari sistem OSS, tercetak di lembar NIB Anda"; tautan "Di mana nomor ini?" membuka gambar contoh dengan posisi nomor dilingkari), kolom **"NPWP Usaha (opsional)"**, dan kotak centang target sentuh besar **"Usaha saya belum punya NIB"** yang menggantinya dengan unggah 1 foto tampak depan tempat usaha. Tombol sekunder **"Isi nanti"** harus terlihat sebagai tombol, bukan tautan kecil. Hasilnya dua lencana: **Terverifikasi** dan **Terverifikasi Dasar**. Foto KTP sengaja tidak diminta di MVP.

Setelah langkah 3, user langsung diantar ke `/akun/kasir?langkah=mulai`. **Layar "Pendaftaran Berhasil" dihapus** — satu-satunya tugasnya mengantar ke langkah berikutnya; kalimat "akun sedang diperiksa" pindah ke banner Beranda yang memang harus hidup berhari-hari.

**`/akun/kasir` — "Dari mana data penjualan Anda?"** Tiga kartu besar:

1. **"Saya pakai aplikasi kasir"** → grid logo → `/akun/kasir/panduan/:merek`: panduan 3 langkah bergambar, SATU kolom kode dengan tombol **"Tempel"** besar, tombol **"Uji Koneksi"**. Hasil uji harus bercerita, bukan "Sukses": *"Tersambung ke Kasir XYZ. Ditemukan 128 barang dan penjualan 30 hari terakhir. Mau kami masukkan sekarang?"* + tombol "Ya, masukkan sekarang". Gagal: *"Kode sambungan ditolak oleh sistem kasir Anda. Salin ulang kode dari menu Pengaturan > Integrasi, lalu coba lagi."* + "Coba Lagi".
2. **"Kasir saya tidak ada di daftar"** → satu kolom nama aplikasi (ditampung untuk prioritas integrasi), lalu diarahkan ke kartu 3. Impor CSV dengan pemetaan kolom **ditunda** — itu produk tersendiri untuk segmen terkecil.
3. **"Saya belum pakai kasir digital"** → mode **Catat Pemakaian Harian** (`/stok/pemakaian`): daftar barang + satu kolom angka "terpakai hari ini" + Simpan, tersimpan sebagai koreksi stok bersumber-manual. Batas tegas agar tidak tumbuh jadi POS bayangan: **satu kolom angka per barang, tidak boleh pernah menampilkan rupiah, tidak boleh punya kolom kedua.**

"Lewati untuk saat ini" tetap ada sebagai teks sekunder di bawah ketiga kartu — bukan tombol setara.

**`/mulai/batas-aman` — "Kapan kami harus mengingatkan Anda?"** Daftar barang dengan kolom "ingatkan kalau sisa kurang dari ___", **sudah terisi saran otomatis**, satuan tercetak di sebelah kolom, tombol **"Pakai semua saran"** di atas supaya selesai satu ketukan. Ditempatkan di onboarding karena inilah satu-satunya momen daftarnya baru terisi dari impor kasir dan perhatian user masih di sana; aksi massal yang bersembunyi di balik chip filter tidak akan pernah disentuh pengguna baru. Aksi massal yang sama tetap ada di Stok sebagai jalur perbaikan permanen — satu komponen, dua pintu masuk. **Tanpa layar ini, notifikasi stok tipis tidak pernah berbunyi dan user menyimpulkan fiturnya bohong.**

**Verifikasi Admin — mode Jelajah Terbatas.** Banner di baris paling atas Beranda, bisa diciutkan jadi satu baris tapi tidak bisa ditutup:
- Kuning: "Akun sedang diperiksa. Kami kabari lewat WhatsApp begitu selesai." + "Lihat status" → `/akun/profil`.
- Merah: "Data usaha perlu diperbaiki" + daftar berbulir alasan Admin + "Perbaiki Data" → `/akun/data-usaha` yang membuka **HANYA kolom yang ditolak**.
- Hijau: "Akun terverifikasi", sekali tayang.

Selama menunggu, yang jalan penuh: Beranda, Stok, Data dari Kasir, Profil, dan seluruh penjelajahan Belanja. Yang dikunci hanya dua tombol yang mengikat pihak ketiga — **"Ajukan Kontrak"** dan **"Buat Pesanan"** — keduanya **tetap terlihat**, abu dengan gembok kecil; ditekan memunculkan bottom sheet "Fitur ini aktif setelah akun diverifikasi" + "Cek Status".

**Aturan pesan error di seluruh onboarding — tiga unsur wajib** (apa yang salah, cara memperbaiki, contoh benar): *"Nomor HP harus diawali 08 dan berisi 10–13 angka. Contoh: 081234567890."* Isian tidak pernah dihapus saat error.

### 5.2 Beranda & Perkiraan

**Urutan tumpuk Beranda mobile dikunci sebagai spesifikasi:**

1. **Pita Data Kasir** — 32px, satu baris, bukan kartu. Hijau menyusut jadi teks abu: "Data kasir masuk 10 menit lalu". Kuning melebar: "Belum ada data baru dari kasir sejak kemarin 09.10. Angka stok di bawah mungkin sudah tidak sesuai." + "Cek Koneksi Kasir". Biru: "Aplikasi kasir belum tersambung — stok tidak berkurang otomatis · Hubungkan". Abu: "Anda mencatat pemakaian manual · Catat hari ini".
2. **Banner status akun** — hanya bila perlu (tiga keadaan §5.1).
3. **"Perlu Diurus"** — maksimal 5 kartu tindakan, diurut paling mendesak: stok tipis, saran belanja, kuota kontrak kurang, kontrak akan berakhir, pesanan menunggu dikonfirmasi penerimaannya, pesanan belum dibayar. **Satu tombol besar per kartu dan hanya satu:** "Pesan Sekarang" → `/pesan-cepat/:idSaran`; "Barang Sudah Sampai" → `/pesanan/:id/terima`; "Lihat Kontrak" → `/kontrak/:id`; "Atur batas aman" → `/stok/:id/batas-aman`. Kosong → satu baris "Semua aman hari ini", bukan blok kosong bergambar.
4. **"Pesanan Berjalan"** — maksimal 3 baris + "Lihat semua".
5. **"Perkiraan Kebutuhan Minggu Depan"** — dimuat belakangan dengan skeleton, didahului satu kalimat manusia ("Kopi diperkirakan habis 4 hari lagi"), lalu tabel ringkas 3 baris, lalu **sparkline 40px tanpa sumbu**. Grafik garis penuh hanya di Detail Barang dan kolom kanan Beranda desktop.
6. **Pita draft** bila ada: "Belanja belum dikirim: 5 barang · Lanjutkan".

**Aturan tegas:** Beranda tidak pernah memiliki data sendiri; tiap blok adalah cermin Stok/Pesanan/Kontrak dan selalu punya tautan ke sumber aslinya. Tidak boleh ada fitur yang hanya bisa diakses dari Beranda.

**Dilarang di Beranda:** kartu omzet, untung, margin, atau nilai rupiah *penjualan* — harga jual ada di POS eksternal (final), jadi angka apa pun pasti salah. Nilai rupiah *pengadaan* tetap wajib muncul di Belanja, Keranjang, Pesanan, dan Kontrak.

**Kartu Perkiraan — 3 state kematangan, ditentukan per BARANG:**
- **State A (0–13 hari)** — lencana abu **"Belum bisa diperkirakan"**. **Tidak ada angka prediksi sama sekali.** Isi: "Susu UHT — sisa 12 L · rata-rata pakai 4 L/hari (7 hari terakhir)", bar "Data terkumpul 6 dari 14 hari — perkiraan mulai muncul 8 hari lagi", tombol "Atur batas aman". Ini yang membuat peringatan stok tipis jalan sejak hari ke-1 tanpa ML sama sekali.
- **State B (14–27 hari)** — lencana kuning **"Perkiraan masih kasar"**, rentang sengaja dilebarkan.
- **State C (≥28 hari)** — lencana hijau **"Perkiraan cukup mantap"**.

Di state B dan C, kartu memakai 3 baris tetap: (1) satu-satunya angka besar dan satu-satunya elemen yang bisa ditekan — "Stok susu cukup untuk ±4 hari"; (2) teks kecil abu "Perkiraan pakai 3 hari ke depan: 18–26 liter"; (3) lencana keyakinan dalam bahasa awam, bukan persentase atau interval statistik. Rentang tidak pernah jadi kolom input. Angka 14 hari dipilih karena menutup dua siklus akhir pekan penuh.

**Isolasi kegagalan di tingkat KARTU, bukan halaman.** (a) Ada cache → tampilkan + stempel waktu wajib "Perkiraan terakhir dibuat kemarin, 06.00", kuning bila >24 jam. (b) Tidak ada cache tapi ada riwayat → hitungan rata-rata 7 hari di backend utama, berlabel eksplisit **"Hitungan sederhana — bukan perkiraan pintar"**, tidak pernah memakai lencana hijau/kuning. (c) Tidak ada apa-apa → hanya kartu itu berisi "Perkiraan belum bisa ditampilkan sekarang" + "Coba lagi". Di ketiga tingkat, peringatan stok tipis, Stok, Belanja, Pesanan, dan Kontrak tetap hidup penuh. **Kata terlarang di layar mana pun: "error", "server", "API", "timeout", "sinkron gagal".**

**Rapor Perkiraan** (`/stok/:id/rapor`, P2) — kalimat tebal "Dari 14 hari terakhir, perkiraan kami meleset kurang dari 1 liter di 11 hari", lalu 7 baris terakhir: tanggal | Perkiraan 20 L | Kenyataan 22 L | centang/seru. **Hari kehabisan stok ditandai otomatis** ("Stok habis — penjualan hari ini tidak dihitung") dan tanggalnya dikeluarkan dari payload historis ke ML; tanpa ini model belajar bahwa permintaan turun padahal barangnya yang tidak ada. Baris akurasi di Beranda ("Minggu lalu perkiraan kami tepat 8 dari 10 kali") **baru ditayangkan bersama layar ini** — baris yang menaut ke layar yang belum ada adalah jalan buntu.

### 5.3 Stok

**Daftar keputusan, bukan tabel.** Baris-kartu satu kolom tinggi minimal **88px**, tanpa geser horizontal:
- Baris 1: nama barang (16px/600, maks 2 baris) kiri; **angka sisa 24px/700** kanan, satuan kecil di bawahnya. Aturan yang tidak boleh dilanggar: **hanya satu angka boleh besar dalam satu baris.**
- Baris 2: meter tipis 4px (sisa terhadap batas aman) + chip berwarna **DAN berteks** — "Aman" / "Menipis" / "Habis" / "Kebanyakan" — diikuti angka konkret: "Menipis · sisa 3,5 kg · cukup ±2 hari".
- Baris 3 hanya bila relevan: "Kedaluwarsa 3 hari lagi · 4 liter", chip kuning "Belum terhubung ke menu", chip abu "Tidak bergerak 30 hari", lencana kecil "Kontrak" yang menaut ke `/kontrak/:id`.
- Angka kedua yang TERPISAH dan tidak pernah dijumlahkan: "Sisa: 4 kg · Sedang dikirim: 25 kg (tiba ± 14 Sep)", bisa ditekan ke detail pesanannya.
- Ketuk = Detail Barang. Titik-tiga = Koreksi Stok, Pesan, Atur batas aman.

**Kepala lengket:** kolom cari + tiga angka yang bisa ditekan sebagai filter ("Habis 2 · Menipis 5 · Aman 31") + chip filter geser `[Perlu dibeli] [Menipis] [Segera kedaluwarsa] [Batas aman belum diatur] [Tidak bergerak] [Kategori ▾]` + tombol Hitung Stok. **Kategori turun pangkat jadi chip filter, bukan folder**; pengelolaan daftarnya `/stok/kategori`, hanya dicapai dari tautan "Kelola" di dalam chip Kategori.

**Sortir bawaan "Paling genting dulu":** Habis → Menipis → Segera kedaluwarsa → Batas aman belum diatur → sisanya A–Z. Pilihan lain (Nama A–Z, Terakhir berubah) di tombol sortir eksplisit, pilihannya disimpan.

**Pencarian toleran.** Cocokkan awalan kata mana pun, abaikan huruf besar dan spasi, plus kolom **"Nama lain / sebutan di warung"** (boleh banyak nilai) yang ikut dicari — pemilik mengetik "gulaku", "skm", "telor". Saat mengetik nama baru yang mirip: baris inline "Sudah ada 'Gula Pasir'. Maksud Anda ini?" + "Pakai yang sudah ada" — duplikat merusak stok sekaligus prediksi. Hasil cari nihil → **"Tambah '<kata>' sebagai barang baru"**, bukan layar kosong.

**Satu Satuan Pakai per barang; kemasan beli sebagai lapisan.** Angka disimpan HANYA dalam satuan pakai (gram, kg, ml, liter, pcs, butir, lembar, ikat). Di Tambah Barang ada blok opsional "Beli dalam kemasan?": "1 [dus ▾] isi [24] pcs" + "Tambah kemasan lain". Di daftar Stok angka besar SELALU satuan pakai; baris kecil kedua "= 3 dus + 2 pcs" hanya muncul bila kemasan terisi. Mengubah isi kemasan setelah ada riwayat membuka dialog: **"Stok yang sudah tercatat tidak dihitung ulang."**

**Batas aman hibrida.** Di Detail Barang, baris "Batas aman" berisi angka + badge sumber yang selalu terlihat: **"Disarankan sistem"** (biru) atau **"Diatur sendiri"** (abu). Ketuk → `/stok/:id/batas-aman`: saran dalam kalimat, bukan rumus — *"Disarankan 8 kg. Biasanya habis 2 kg per hari, dan barang ini sampai 3 hari setelah dipesan."* Dua tombol: "Pakai saran ini" / "Atur sendiri", plus kolom **"Biasanya barang sampai berapa hari?"**. Filter "Batas aman belum diatur" punya tombol aksi massal **"Pakai saran sistem untuk semua barang ini"**. Kalau ML mengusulkan perubahan ≥30% pada nilai "Diatur sendiri": jangan ubah diam-diam, jangan kirim push — banner tenang "Belakangan barang ini lebih cepat habis. Naikkan batas aman jadi 12 kg?" dengan "Ya" / "Biarkan".

**Koreksi Stok beralasan sekali-ketuk** (`/stok/:id/koreksi`), tiga langkah dalam satu lembar: (1) dua tombol besar "Stok berkurang" / "Stok bertambah"; (2) grid 2 kolom alasan berikon — Berkurang: "Basi / kedaluwarsa", "Rusak / pecah / tumpah", "Susut saat diolah", "Dipakai sendiri", "Hilang", "Diretur ke distributor", "Salah catat sebelumnya"; Bertambah: "Barang datang belum tercatat", "Retur dari pelanggan", "Salah catat sebelumnya", "Pindahan dari gudang lain"; "Alasan lain" paling bawah dan mewajibkan teks; (3) jumlah + foto opsional. Semantik yang terlihat di UI: "Salah catat" tidak dihitung kerugian; "Basi / Rusak / Hilang / Susut" dihitung kerugian memakai harga beli terakhir dan muncul di Detail Barang sebagai "Kerugian bulan ini: Rp 84.000"; **semua alasan non-penjualan ditandai agar dikeluarkan dari data permintaan ke microservice ML** — kalau susut terbaca sebagai permintaan, rekomendasi restok terus membesar dan barang makin banyak yang basi. Di Detail Barang ada blok "Kenapa stok berkurang bulan ini": batang kecil terpisah Terjual / Basi / Rusak / Susut.

**Hitung Stok** (`/stok/hitung`, P1). Layar penuh dari tombol di kepala Stok. Pilih cakupan (Semua / Per kategori / Hanya yang menipis / Pilih sendiri) — cakupan kecil penting karena warung tidak punya waktu opname total. Satu barang per layar, satu input angka besar dengan papan angka. **Angka sistem disembunyikan di balik "Lihat catatan sistem" sebelum diisi, lalu otomatis terungkap sesudahnya** ("Catatan sistem 12 kg · Selisih −2 kg"). Progres "8 dari 24 barang" + "Simpan dulu, lanjut nanti"; draft bertahan offline. `/stok/hitung/ringkasan`: "Selisih ditemukan pada 6 barang · Total nilai selisih Rp 312.000" + satu tombol "Terapkan hasil hitung"; semua selisih masuk riwayat sebagai SATU kelompok beralasan "Hasil hitung fisik".

**Stok minus tidak pernah tampil negatif:** "0 kg (catatan kurang 3 kg)" + "Hitung fisik sekarang" → `/stok/hitung` dengan cakupan barang itu saja.

**Kedaluwarsa: catat tanggal, jangan lacak batch.** Sakelar per barang "Ingatkan tanggal kedaluwarsa", MATI secara bawaan, disarankan menyala untuk Susu, Daging, Sayur, Roti. Bila menyala, tiap penambahan stok meminta satu kolom tanggal + jumlah, dengan pintasan "Sama dengan kiriman sebelumnya". Tidak ada pemecahan stok per batch di database: karena pengurangan dari kasir bersifat agregat (final), sistem tidak akan pernah tahu batch mana yang dipakai — batch hanya menghasilkan presisi palsu sambil mengubah tiap penerimaan jadi formulir panjang.

**Riwayat pergerakan berbahasa bisnis** (tab di Detail Barang): "Terjual dari kasir −5 kg", "Masuk dari Pesanan #PS-240913-07 +25 kg" (bisa diketuk balik ke pesanannya), "Koreksi manual: basi −2 kg", kelompok "Hasil hitung fisik". Log teknis tidak pernah muncul di sini.

**Barang yang memang tidak dijual langsung** (gas, tisu, kemasan) punya sakelar "Barang ini memang dicatat manual": chip peringatan hilang permanen dan barang dikecualikan dari data permintaan ML.

### 5.4 Belanja & Kontrak

**`/belanja`** dibuka dengan kolom cari, placeholder "Cari barang, misal: gula pasir". Hasil dirender di layar yang sama (`/belanja?cari=gula`) sebagai **kartu penawaran: 1 barang × 1 distributor**, sejajar dengan aturan 1 kontrak = 1 barang. Isi kartu tepat 5 baris: "Gula Pasir — karung 50 kg" / "Rp 14.000/kg" / "CV Sinar Jaya · Sidoarjo" / "Stok distributor: 1.200 kg" / satu lencana ("Mitra kamu" atau "Ada kontrak 1–5 bulan"). Filter cukup 3 chip: Kota, Stok tersedia, Tersedia kontrak. Segmen kedua "Distributor" (`?tab=distributor`) tetap ada untuk jalur rujukan, dan nama distributor di kartu selalu bisa diketuk. Thumbnail 56×56px lazy-load dengan fallback huruf awal — teks harus selalu terbaca tanpa gambar. Distributor baru tidak pernah ditampilkan "0,0 bintang": lencana netral **"Distributor Baru · belum ada ulasan · bergabung Ags 2026"**, ditempatkan di bagian terpisah "Distributor Baru di Kota Anda", bukan diurutkan berdasarkan rating.

**`/distributor/:id`.** Header rating bukan satu angka melainkan konteks: **"4,6 · 38 ulasan dari 26 UMKM · 412 pesanan selesai"** dengan 3 sub-rating: **Ketepatan waktu kirim · Jumlah sesuai pesanan · Kondisi barang**. Daftar penawaran di bawahnya. Menggantikan tombol tulis ulasan: teks status **"Anda bisa menulis ulasan setelah pesanan Anda selesai."**

**`/penawaran/:id`.** Dua tombol yang sengaja dibedakan bobotnya: **"Ikat Kontrak"** (utama, penuh) dan **"Beli Sekali"** (sekunder, bergaris), dengan satu baris pembanding di atasnya: *"Beli sekali Rp 14.000/kg — Harga kontrak mulai Rp 12.500/kg"*. Wajib menampilkan stok distributor terkini dan kelipatan pemesanan ("1 dus = 24 pcs").

**`/penawaran/:id/kontrak` — Pilih Paket Kontrak.** Pita atas: "Pemakaianmu sekitar 280 kg/bulan (rata-rata 3 bulan terakhir, Jun–Agu 2026)". Kalau kasir belum tersambung, pita berganti jadi stepper besar "Kira-kira berapa kamu pakai per bulan?" dan hasilnya ditandai "perkiraan kamu" — jangan sembunyikan layar pembandingnya, ini justru kondisi paling umum. Badan: mobile = 5 kartu geser, desktop = tabel 5 kolom, baris selalu sama dan berurutan: **Durasi · Minimal ambil per bulan · TOTAL wajib diambil selama kontrak · Harga per satuan · Hemat dibanding beli sekali · Perkiraan total belanja**. Tiap kartu diberi satu kalimat vonis berwarna: "Pas — kuota 240 masih di bawah pemakaianmu 280" (hijau) / "Ketat — kuota 300 di atas pemakaianmu" (kuning) / "Murah tapi lama — kamu terikat 5 bulan" (abu). Satu kartu boleh dilabeli **"Paling pas buat kamu"** dengan alasan satu baris, dan **tidak pernah terpilih otomatis**. Catatan tetap: "Kalau bulan ramai dan bulan sepi kamu beda jauh, ambil durasi lebih pendek."

**`/penawaran/:id/kontrak/:paket` — Rincian Paket Kontrak.** Layar penuh, bukan modal. Urut dari atas: (1) blok besar **"Total Komitmen Anda"** — `Rp 21.600.000`, baris hitung terbaca `240 kg × Rp 30.000 × 3 bulan`, lalu `Kewajiban tiap bulan: Rp 7.200.000`; (2) baris "Dibanding pemakaian Anda" + chip Aman / Pas / Di atas pemakaian; (3) akordeon "Kalau kuota tidak terpenuhi" — teksnya dari **satu kolom data kontrak yang diisi distributor/admin**, bukan dari UI; kosong → "Distributor belum mencantumkan ketentuan ini."; (4) akordeon "Kalau ingin berhenti di tengah jalan"; (5) footer lengket: total + **"Lanjut Tinjau"**.

**`/penawaran/:id/kontrak/:paket/tinjau` — Periksa Kesepakatan.** Ringkasan gaya kuitansi 6 baris besar, dengan Total Komitmen **diulang di sini**, tidak hanya di layar sebelumnya. Kalau sudah ada kontrak aktif untuk barang yang sama, sisipkan kartu kuning: "Kamu sudah punya kontrak untuk gula pasir" + daftar kontrak berjalan + hitungan sebaris *"Sekarang 240 kg/bulan → kalau kontrak ini jalan jadi 540 kg/bulan. Pemakaianmu sekitar 300 kg/bulan."* dengan dua batang pembanding. **Jangan memblokir** — secara bisnis ini sah — tapi tambahkan centang khusus.

Di bawah ringkasan, **3 kotak centang terpisah** (satu centang gabungan DILARANG): (1) "Saya wajib mengambil minimal 240 kg setiap bulan"; (2) "Kontrak ini berjalan 3 bulan sampai 12 Des 2026 dan tidak bisa saya batalkan sendiri di tengah jalan"; (3) "Total yang wajib saya ambil selama kontrak 720 kg"; plus centang keempat bila ada tumpang tindih. Tombol **"Ajukan Kontrak"** mati sampai semua tercentang. **Jangan pakai tekan-tahan atau ketik-nama-untuk-konfirmasi** — pola asing untuk literasi digital menengah-rendah; kekuatan buktinya dari jejak tersimpan (waktu, akun, versi teks kontrak) + salinan ringkasan ke WhatsApp/email.

Setelah itu status **"Menunggu persetujuan distributor"** dengan tombol "Batalkan pengajuan" dan kalimat tegas: *"Setelah distributor menyetujui, kontrak tidak bisa dibatalkan sendiri."* Ini satu-satunya jendela batal dalam sistem dan harus dinyatakan eksplisit.

### 5.5 Pesanan, Keranjang & Penerimaan

**`/pesan-cepat/:idSaran` — satu komponen untuk tiga pintu masuk.** Tombol "Pesan Sekarang" di kartu Beranda, tombol di baris Pemberitahuan, dan pita draft **wajib membuka komponen yang sama**. Tiga varian BARIS:
- **Varian A — ada kontrak:** jumlah terisi otomatis; di bawah nama distributor ada baris kecil abu berisi alasan pemilihan: "Dipilih karena kuota kontrak bulan ini kurang 70 kg" atau "Dipilih karena harga termurah: Rp 12.000/kg". Urutan default yang dipakai dan ditulis: (1) kontrak aktif yang kuotanya belum terpenuhi, (2) kalau semua aman, harga terendah. Tautan "Ganti pemasok" membuka daftar maksimal 5 baris.
- **Varian B — tanpa kontrak, ada pemasok:** 2–3 kandidat dengan harga per satuan dan sisa stok; dua tombol: "Pesan sekali ini" (default) dan "Lihat kontrak".
- **Varian C — tanpa pemasok:** jangan tampilkan stepper. "Belum ada distributor yang memasok Gula Pasir di daerah Anda" + "Catat pembelian manual" → `/stok/:id/koreksi`. Barang varian C tidak memicu notifikasi rekomendasi, cukup masuk peringatan stok.

Empat lapis per baris: konteks stok ("Sisa 8 liter · diperkirakan habis Kamis"); **stepper melangkah sesuai kelipatan jual distributor** dengan dua label (angka besar "3 dus", teks kecil "= 36 liter"), berhenti bila melebihi sisa stok distributor; chip **"Kenapa segini?"** yang membuka maksimal 3 bullet berbasis fakta yang bisa diperiksa sendiri ("Akhir pekan lalu pemakaian susu naik 40%", "Sisa stok 12 liter, kiriman CV Sinar Jaya biasanya datang 2 hari") — **kalau bullet tidak tersedia, chip TIDAK ditampilkan; frontend tidak boleh mengarang alasan**; dan baris kuota untuk barang berkontrak. Tombol kedua: **"Ingatkan nanti"** (Besok pagi / 3 hari lagi / Kalau makin menipis).

**`/keranjang` — sub-keranjang per distributor.** Tiap sub-keranjang: kepala berisi nama distributor + perkiraan tiba, baris-baris barangnya, subtotal Rp, dan tautan sekunder "Simpan sub-keranjang ini untuk nanti". Tiap baris diberi chip hijau **"Kontrak"** (jumlah default = sisa kuota bulan ini, harga mengikuti kontrak) atau chip abu **"Beli Lepas"**, plus label kecil di bawah stepper yang tidak pernah hilang: "Saran sistem: 12 kg" → "Saran sistem 30 L · kamu ubah jadi 24 L" begitu diutak-atik, plus chip **"Kembalikan ke saran"**. Barang rekomendasi tanpa pemasok masuk grup terakhir **"Belum ada pemasok tetap"** + "Cari Distributor" → `/belanja?cari=<nama barang>`.

**Kejujuran pemecahan pesanan.** Tepat di atas tombol: *"5 barang akan dikirim sebagai 3 pesanan ke 3 distributor"*, dan tombol utama menyebut angkanya: **"Buat 3 Pesanan"** — satu tombol, bukan satu per sub-keranjang.

**`/keranjang/ringkasan`.** Baca-saja: subtotal per distributor, total keseluruhan, kalimat **"Pembayaran dilakukan di luar aplikasi, langsung ke distributor"**, lalu "Buat 3 Pesanan". Tombol kirim **tidak boleh menempati posisi yang sama** dengan "Nanti saja" di langkah sebelumnya. Tombol dikunci 3 detik dan permintaan membawa **kunci idempoten** sehingga tap ganda tidak pernah melahirkan pesanan kedua.

**`/keranjang/selesai`.** Daftar nomor pesanan yang terbentuk, kode induk belanja ("Belanja #0912-01"), status per distributor, dan tombol "Kirim ulang" **hanya pada baris yang gagal** — kegagalan sebagian tidak boleh memaksa mengulang seluruh keranjang. Tombol utama "Lihat Pesanan Saya".

**Draft tidak hilang.** Menutup lembar (geser turun, Kembali, Esc) menyimpan draft dan memunculkan pita Beranda "Belanja belum dikirim: 5 barang · Lanjutkan". Offline: lembar tetap bisa dibuka dengan banner "Tidak ada internet — pesanan disimpan dan dikirim otomatis saat tersambung"; jumlah yang sudah diubah disimpan lokal dengan penanda "Tersimpan di HP, belum dikirim". **Kata "berhasil" dilarang muncul sebelum balasan server** — hanya "Tersimpan" lawan "Terkirim". Toast "sistem belajar dari penyesuaianmu" dilarang: MVP tidak punya loop retraining.

**`/pesanan`** — tiga segmen **[Berjalan · Kontrak · Selesai]**, badge angka pada Berjalan. Kartu: nama distributor, ringkasan ("Kopi Robusta 25 kg + 2 barang lain"), chip status pendek (**Draf · Menunggu Konfirmasi · Disiapkan · Dikirim · Selesai · Batal**), perkiraan tiba, penanda oranye "belum dibayar".

**Segmen Kontrak** dikelompokkan **per BARANG** secara bawaan: judul grup "Kopi Biji — 2 kontrak aktif" + agregat permanen "Kewajiban kontrak: 540 kg/bulan dari 2 kontrak". **Judul kartu adalah NAMA BARANG besar** ("Gula Pasir — 50 kg/karung"), nama distributor turun jadi baris kedua kecil. Toggle **[Per barang] [Per pemasok]** mengubah pengelompokan tanpa layar baru; di mode Per pemasok, header grup membawa tombol **"Pesan sekaligus ke CV Sinar Jaya"** yang mengisi satu sub-keranjang berisi baris dari semua kontrak aktif dengan distributor itu (jumlah bawaan = sisa kuota bulan ini). Penamaan kontrak dilarang pakai kode teknis — pakai "Gula Pasir — 3 bulan". Risiko disalahartikan sebagai kontrak gabungan dijinakkan dengan menulis eksplisit "3 kontrak berjalan" dan satu baris **"Setiap barang punya kontrak sendiri"**.

**`/pesanan/:id`.** Urut dari atas: nomor pesanan pendek yang bisa disalin (PS-240913-07, untuk dikirim via WhatsApp), baris "Diperbarui 5 menit lalu" + tarik-untuk-segarkan, lalu **dua jalur sejajar dengan bentuk visual berbeda** — atas: garis waktu pengiriman 4 langkah; bawah: blok kotak **"Pembayaran"** berlabel netral **"Dicatat di luar aplikasi"** dengan status Belum Dibayar · Bukti Terkirim · Sudah Dikonfirmasi Distributor, tombol "Unggah Bukti Transfer" (boleh lebih dari satu file untuk DP), tombol teks "Tandai sudah dibayar tunai" untuk COD ke sopir, dan satu baris bantuan wajib: *"Aplikasi hanya menyimpan catatan dan bukti. Pembayaran dilakukan langsung ke distributor."* **Aturan keras: status pembayaran tidak pernah menonaktifkan tombol mana pun, termasuk "Barang Sudah Sampai".** Untuk Premium, komponen di kotak yang sama diganti, tata letaknya identik.

Satu tombol aksi utama yang berubah menurut status: Draf/Menunggu Konfirmasi → "Batalkan Pesanan" (dialog chip alasan: Salah jumlah · Salah barang · Sudah tidak butuh · Terlalu lama). Disiapkan/Dikirim → **"Barang Sudah Sampai"**, pembatalan turun jadi tautan teks "Ajukan Pembatalan" + keterangan jujur "Barang mungkin sudah disiapkan. Distributor akan mengonfirmasi dulu." Selesai → tidak ada pembatalan. **Jangan pernah menampilkan tombol mati tanpa keterangan.** Terakhir, baris jejak privasi: "Distributor ini bisa melihat alamat & nomor HP Anda (terbuka 12 Sep karena pesanan ini)."

**`/pesanan/:id/terima` — Terima Barang.** Aturan data yang mengikat: **stok bertambah HANYA saat pemilik menekan "Barang Sudah Sampai", sebesar jumlah yang ia akui diterima**; sistem tidak pernah menutup pesanan otomatis. Layar: daftar item dengan jumlah pesanan tercetak besar dan **dianggap benar secara default**, lalu satu tombol primer lebar **"Ya, semua sesuai"** — sekali ketuk selesai (jalur 80% kasus). Tiap baris punya tautan kecil **"Jumlahnya beda / barang rusak"** yang baru memunculkan stepper + chip alasan (Kurang · Lebih · Rusak/Bocor · Kualitas beda · Salah barang) + catatan + "Ambil Foto" dengan kompresi agresif. Setelah ada koreksi, tombol berubah jadi **"Terima dengan catatan"** + ringkasan jujur "Stok yang akan ditambahkan: Kopi 20 kg (dari 25 kg dipesan)"; pesanan tetap maju ke "Selesai (ada catatan)" — **jangan pernah macet di Dikirim**, karena satu-satunya jalan keluar user kalau macet adalah tidak menekan apa pun sehingga stok tak pernah masuk. Kolom tanggal terima default hari ini tapi bisa dimundurkan; itulah tanggal transaksi masuk inventori.

Setelah konfirmasi: stok bertambah, pesanan pindah ke Selesai, progres kuota kontrak bertambah, lahir entri riwayat yang bisa diketuk balik ke pesanannya, dan muncul ajakan sekali-tayang **"Beri Penilaian untuk distributor ini"** → `/pesanan/:id/ulasan`. Inilah satu-satunya pintu masuk menulis ulasan. Setiap ulasan wajib membawa label sistem yang tidak bisa diedit penulis: **"Terverifikasi · 4 pesanan · pelanggan sejak Mar 2026"**. Karena ajakan itu bisa ditutup, `/akun/ulasan` menyediakan jalur pemulihan.

**Pencegahan pesanan dobel.** Kartu stok tipis di Beranda punya state ketiga — badge biru **"Sudah dipesan, sedang dikirim"**. Lembar Pesan Cepat mengurangi usulannya dan menulis alasannya: "Saran 30 kg, dikurangi 25 kg yang sedang dikirim → 5 kg". Pesanan yang Batal wajib menghapus jumlahnya dari angka "Sedang dikirim" dan memunculkan lagi peringatan stok tipis.

**`/kontrak/:id`.** Judul nama barang + distributor; komponen Kuota Bulan Ini; "Kurang 20 kg · sisa 9 hari" + konversi awam "20 kg = 1 karung lagi"; tombol "Pesan 20 kg"; tanggal berakhir + total wajib selama kontrak; **satu baris "Kalau kuota tidak terpenuhi: …"** dari kolom data kontrak (satu-satunya tempat konsekuensi ditulis); tab Dokumen berisi salinan ringkasan + jejak waktu dan versi teks; tombol "Ajukan Penghentian (perlu persetujuan distributor)"; indikator "Pesanan rutin: aktif, berikutnya 20 Sep"; teks bantu tetap **"Kuota bertambah setelah pesanan selesai diterima."**

**`/kontrak/:id/rutin` (P2).** Barang terkunci (1 kontrak = 1 barang), jumlah per pengiriman (default dari kuota minimum), jadwal berbentuk chip (Tiap minggu · Tiap 2 minggu · Tiap tanggal … tiap bulan). H-2 sebelum jadwal, sistem membuat pesanan berstatus **Draf** + notifikasi "Pesanan rutin Kopi Robusta 25 kg siap dikirim ke CV Sinar Jaya. Cek dulu?". Kalau tidak ditanggapi, draf **tetap draf** dan naik jadi kartu menonjol di Beranda — tidak pernah terkirim sendiri. Plus tombol jeda **"Libur dulu bulan ini"**.

**Catatan selisih berhenti sebagai catatan + foto di dalam pesanan.** Penyelesaiannya terjadi di luar aplikasi lewat telepon — konsisten dengan keputusan final bahwa pembayaran ada di luar sistem, dan jauh lebih murah daripada modul retur yang tidak akan terpakai di MVP.

### 5.6 Pemberitahuan

`/notifikasi` dibuka dari lonceng di kepala halaman — bukan tab. Daftar persisten, belum dibaca ditebalkan, kepala tanggal (Hari Ini / Kemarin / Minggu Ini), chip filter berhitungan **[Semua · Stok · Saran Belanja · Pesanan · Kontrak]** — Saran Belanja dipisahkan karena hanya kategori itu yang punya aturan daur hidup berbeda. Baris seragam: ikon kategori berwarna, judul tebal satu baris, detail satu baris, waktu relatif, titik biru, satu tombol tindakan per kategori. "Tandai semua sudah dibaca" di kanan atas — **tanpa "hapus semua"**.

| Jenis notifikasi | Membuka |
|---|---|
| Stok tipis / Saran belanja | `/pesan-cepat/:idSaran` di atas layar aktif |
| Pesanan dikirim / sampai | `/pesanan/:id` |
| Kuota kontrak kurang / kontrak akan berakhir | `/kontrak/:id` |
| Aplikasi kasir gagal tersambung | `/akun/kasir` |
| Akun sudah diverifikasi | `/beranda` dengan banner hijau |

**Empat aturan anti-banjir yang terlihat di UI:**
1. **Satu barang = satu notifikasi aktif.** Kondisi memburuk memperbarui isinya ("sisa 2 hari" → "sisa 1 hari") dan menaikkannya, bukan membuat baris baru.
2. **Begitu barang itu dipesan**, barisnya jadi pasif: chip hijau "Sudah dipesan · tiba ± 2 hari", tombol berubah "Lihat pesanan", dan barang dibisukan sampai pesanan Selesai atau Dibatalkan.
3. Tombol kedua di Lembar Pesan Cepat: **"Ingatkan nanti"**.
4. Saran belanja dikirim **sekali pukul 07.00** berjudul "Belanja hari ini: 5 barang perlu dipesan" yang membuka satu lembar berisi kelimanya. Peringatan Stok (sisa ≤ 1 hari) dikecualikan dan tetap seketika. Jam dipatok tetap di MVP.

Notifikasi saran belanja **tidak hilang setelah dibaca** — hidup sampai draftnya dipesan atau dilewati, dengan tombol sekunder "Lewati minggu ini". Notifikasi yang tidak relevan lagi tidak dihapus, hanya diredupkan tanpa tombol. **Badge lonceng hanya menghitung yang butuh tindakan**, supaya angkanya punya arti.

### 5.7 Akun (Profil & Pengaturan)

`/akun` adalah daftar satu kolom bertarget sentuh besar: **Profil Usaha · Data Usaha & Legalitas · Data dari Kasir · Cara Hitung Stok · Pengaturan Pengingat · Pengguna & Hak Akses · Langganan · Ulasan Saya · Bantuan & Tentang Aplikasi · Keluar.**

**`/akun/profil`.** Foto tempat usaha, nama, jenis usaha, bio (gaya Bio IG), kota. Lencana Terverifikasi / Terverifikasi Dasar. **Blok Status Verifikasi** dengan garis waktu 3 langkah (Dikirim → Diperiksa → Selesai); kalau ditolak, alasan spesifik dalam bahasa manusia + "Perbaiki dan Kirim Ulang" → `/akun/data-usaha`. Layar verifikasi terpisah sengaja tidak dibuat: banner butuh tujuan, dan tujuan terbaiknya adalah tempat user juga bisa langsung memperbaiki.

**Privasi kontak — default keras, satu cara melihatnya.** Bagian **"Yang Dilihat Distributor"** + tombol nyata **"Lihat sebagai Distributor"** → `/akun/profil/pratinjau`. Dua kolom dipisahkan tegas: selalu terlihat (nama usaha, jenis usaha, kota/kecamatan, foto & bio, lencana verifikasi) vs tertutup sampai ada transaksi (**Alamat lengkap**, **Nomor HP**), dengan sakelar dua pilihan saja — bawaan **"Terbuka setelah saya memesan"** | alternatif "Terbuka untuk semua distributor". Satu kalimat konsekuensi, bukan istilah privasi: *"Meski disembunyikan, barang tetap bisa dikirim — alamat otomatis terbuka begitu Anda membuat pesanan."*

**`/akun/kasir` — tiga tab: Sambungan · Perlu Dibereskan · Riwayat.** Tab Perlu Dibereskan berisi kartu tugas berbahasa manusia dengan satu tombol aksi: *"Menu 'Es Kopi Susu' terjual 23x tapi belum dipasangkan ke bahan — stok tidak berkurang"* → "Pasangkan sekarang" (`/akun/kasir/pasangkan/:idMenu`); *"Penjualan pukul 12.40 masuk 2 kali"* → sistem SUDAH mengabaikan salinan berdasarkan ID transaksi, tombol sekundernya "Ternyata memang 2 transaksi"; *"Satuan tidak cocok: kasir mencatat 'porsi', bahan memakai gram"* → "Tentukan 1 porsi = … gram". Tab Riwayat: ringkasan harian "13 Sep · 148 transaksi masuk · 2 diabaikan (salinan)" dengan detail teknis terlipat — bukan baris per-request. Semua ini keluar dari tab Stok; yang tinggal di Stok hanyalah pita peringatan di atas daftar yang menaut ke sini, supaya gejalanya terlihat di tempat gejala muncul tanpa mengubah Stok jadi alat teknisi.

**`/akun/jenis-usaha`.** Tiga kartu yang sama dengan registrasi langkah 2. Jawaban hanya menentukan BENTUK DEFAULT form Tambah Barang, **tidak mengunci akun**: racikan/dua-duanya memunculkan tab "Resep" di Detail Barang, barang kemasan menyembunyikannya. Karena resep memang opsional per barang (final), tidak ada data yang perlu dimigrasi; peringatan yang ditampilkan: resep yang sudah diisi berhenti dipakai untuk mengurangi stok tapi **TIDAK dihapus**.

**`/akun/pengguna` (P2).** Dua peran sebagai dua kartu berisi daftar "Boleh" / "Tidak boleh" dalam kalimat, bukan matriks izin. **Kasir**: lihat stok, koreksi stok, hitung stok, terima barang. **Manajer**: semua, termasuk buat pesanan, ajukan kontrak, ubah pengaturan.

**`/akun/langganan` (P2).** Dua kartu: **Default** (mencatat pesanan, pembayaran di luar aplikasi) vs **Premium** (+ otomasi pembayaran). Kartu Premium tidak boleh muncul sebagai banner di Beranda — hanya di sini dan di blok Pembayaran detail pesanan.

**`/akun/bantuan`.** Satu layar, bukan dua: "Kenapa stok saya tidak berkurang?", "Kenapa butuh 14 hari sebelum ada perkiraan?", "Kenapa kuota kontrak belum bertambah padahal sudah pesan?", kontak WhatsApp, versi aplikasi, ketentuan layanan. **Ini satu-satunya tempat kata "prediksi" dan penjelasan cara kerja model boleh muncul.**

---

## 6. Keputusan Desain Besar & Trade-off

**KD-1. Empat tab; Akun di balik avatar, bukan tab kelima.** *Trade-off:* target sentuh menyempit dari ~33% ke 25% lebar layar — diterima karena 25% dari 360px masih 90px, jauh di atas 48px. Risiko "Belanja" vs "Pesanan" terasa kembar diredam aturan pemisah §3.1.

**KD-2. Kedalaman sitemap diputuskan oleh satu aturan, bukan selera.** Lembar diberi rute hanya bila ada tautan dari luar layar induknya. Hasilnya 51 rute: cukup dangkal untuk terasa sederhana, cukup beralamat agar tiap tautan notifikasi mendarat. *Trade-off:* menuntut disiplin saat menambah fitur — tiap lembar baru harus ditanya "ada yang menautinya dari luar?" sebelum diberi rute.

**KD-3. Rute datar per entitas, termasuk `/penawaran/:id` dan `/distributor/:id` yang TIDAK bersarang di bawah `/belanja`.** Penawaran (1 barang × 1 distributor) adalah entitas yang sama dengan kartu yang diketuk, dan menjadikannya entitas memendekkan rute kontrak dari enam segmen jadi empat. *Trade-off:* menambah penanganan state tab-aktif di kode.

**KD-4. Stok bertambah HANYA lewat "Terima Barang".** *Trade-off:* satu tugas manual tambahan — diringankan dengan pra-isi jumlah penuh, jalur satu ketukan "Ya, semua sesuai", dan kartu pengingat di Beranda.

**KD-5. Q-1 diselesaikan lewat dua lapis pengelompokan, tanpa menyentuh aturan bisnis.** Lapis 1 (P0): segmen Kontrak dikelompokkan per BARANG + toggle [Per barang] [Per pemasok] yang memberi tombol "Pesan sekaligus ke <distributor>" pada header grup. Lapis 2 (P1): `/mitra/:id` sebagai drill-down dari header grup — bukan simpul navigasi paralel. *Trade-off:* untuk MVP "Pesan sekaligus" tetap melahirkan beberapa pesanan di belakang layar, ditampilkan sebagai SATU grup belanja ("Belanja #0912-01"); model data "1 pesanan banyak baris" ditunda ke setelah MVP.

**KD-6. Q-2 ditangani satu komponen netral "Kuota Bulan Ini".** Bar dua segmen (Sudah diterima / Dalam perjalanan), tiga status netral **Aman / Perlu Dikejar / Kurang**, tombol "Pesan 20 kg". Empat aturan pengunci: kata "melanggar/denda/gagal/penalti/dibatalkan/blokir" DILARANG; konsekuensi hanya di Rincian Kontrak dari kolom data kontrak; **tombol pesan tidak boleh dinonaktifkan dengan alasan kuota**; kalau nanti diputuskan memblokir cukup menambah status keempat "Terkunci" + banner. **Kuota hanya bertambah setelah pesanan Selesai.** *Trade-off:* memisahkan "sudah diterima" vs "dalam perjalanan" menuntut status pesanan per baris dikaitkan ke kontrak — pekerjaan data, bukan tampilan.

**KD-7. Pengikatan kontrak tetap dua langkah (Rincian → Periksa Kesepakatan).** Menggabungkannya jadi satu layar menghasilkan ketidakkonsistenan yang tidak bisa dipertahankan: aplikasi menuntut langkah baca-saja untuk pesanan Rp 300.000 tapi tidak untuk komitmen Rp 21.600.000 yang tidak bisa dibatalkan. Yang dipangkas adalah langkah ketiga. Total Komitmen tampil di **kedua** layar. *Trade-off:* satu ketukan tambahan pada alur yang memang jarang.

**KD-8. Satu tombol "Buat N Pesanan", bukan tombol per sub-keranjang.** Kalimat yang menyebut angka sudah menghilangkan kejutan yang jadi alasan memecah tombol, sedangkan tiga tombol memaksa tiga konfirmasi untuk satu niat belanja. *Trade-off:* pengguna yang ingin mengirim sebagian memakai "Simpan untuk nanti" — tautan sekunder, bukan tombol kirim kedua.

**KD-9. Layar batas aman masuk onboarding (P0), bukan hanya aksi massal di Stok.** Tanpa batas aman seluruh rantai notifikasi mati. *Trade-off:* satu layar tambahan di onboarding — diringankan karena kolomnya sudah terisi saran dan "Pakai semua saran" menyelesaikannya satu ketukan.

**KD-10. Kategori dibubarkan sebagai level navigasi.** *Trade-off:* daftar datar perlu digulir; imbalannya koreksi stok cukup 2 ketukan dan tidak ada barang "hilang" karena salah tebak kategori.

**KD-11. Grafik turun dari Beranda; rupiah penjualan dilarang di Beranda.** *Trade-off:* kartu omzet jauh lebih impresif untuk demo/sidang; dikompensasi sparkline 40px + kalimat ramalan di layar pertama dan grafik penuh di Detail Barang serta kolom kanan Beranda desktop.

**KD-12. Perkiraan sebagai rentang dengan lencana kematangan; angka ML dilarang mengisi kuota kontrak.** Prediksi mingguan tidak sah jadi dasar komitmen 3 bulan. *Trade-off:* rentang harus datang dari microservice sebagai interval prediksi, bukan ditempel ±15% di frontend.

**KD-13. Ulasan hanya dari pesanan Selesai, dengan jalur pemulihan di `/akun/ulasan`.** *Trade-off:* masalah awal dingin; dikompensasi lencana netral "Distributor Baru" dan bagian "Distributor Baru di Kota Anda", bukan urutan berdasarkan rating.

**KD-14. Sengaja TIDAK dibuat di MVP:** impor CSV dengan pemetaan kolom; pelacakan batch/lot kedaluwarsa; modul retur/RMA; kalender Ramadan/hajatan; chip konversi kemasan otomatis tanpa data distributor; escrow atau pembayaran dalam aplikasi di jalur Default.

---

## 7. Sistem Desain & Aturan Responsif

### 7.1 Token warna status
Tiap status wajib tiga lapis: **IKON + TEKS + WARNA**.

| Token | Hex teks | Hex latar | Ikon | Dipakai untuk |
|---|---|---|---|---|
| `status/aman` | `#15803D` | `#F0FDF4` | centang dalam lingkaran | Stok aman, kuota Aman |
| `status/tipis` | `#B45309` | `#FFF7ED` | segitiga seru | Stok menipis, kuota Perlu Dikejar |
| `status/habis` | `#B91C1C` | `#FEF2F2` | lingkaran bergaris silang | Stok habis, kuota Kurang |
| `status/kedaluwarsa` | `#C2410C` | `#FFF7ED` | jam | Segera kedaluwarsa |
| `status/jalan` | `#1D4ED8` | `#EFF6FF` | truk | Sedang dikirim, Sudah dipesan |
| `status/netral` | `#475569` | `#F1F5F9` | — | Tidak bergerak, informasi |
| `aksi/utama` | `#0F766E` | — | — | Tombol primer |

`#F59E0B` dilarang untuk teks di atas putih (±2,1:1). Teks/latar minimal **4,5:1**; ikon dan garis batas minimal **3:1**.

### 7.2 Tipografi
Basis 16px. **Angka stok dan jumlah 24px/700** — satu-satunya angka yang boleh besar dalam satu baris. Nama barang 16px/600 (bukan 18px: dengan angka 24px di kanan, nama 18px ikut berebut perhatian dan aturan "satu angka besar" jadi tumpul). Judul layar 20px/700. Teks isi 16px/400. Teks bantu & satuan 13px/400 `status/netral`. Chip 13px/600, huruf normal. Tidak ada teks di bawah 12px. Tabel apa pun berubah jadi kartu bila lebar efektif < 640px; layar harus tetap utuh saat ukuran huruf Android dinaikkan.

### 7.3 Spacing & target sentuh
Skala 4px (4/8/12/16/24/32). Padding layar dan kartu 16px; jarak antar kartu 12px; antarblok 24px. **Target sentuh minimal 48×48px**, jarak antar tombol berlawanan akibat minimal 12px. Tinggi baris daftar minimal **88px** (Stok, Belanja), **72px** (Pemberitahuan, Pesanan). Tombol primer di bottom sheet: 52px, lebar penuh, lengket di bawah.

### 7.4 Format angka & waktu
`<Uang>` → **"Rp 27.500"** (awalan Rp + spasi, titik ribuan, tanpa sen); "Rp 1,2 jt" hanya di sumbu grafik, angka yang akan dikonfirmasi wajib penuh. `<Jumlah>` → desimal **koma** ("1,5 kg"), ribuan **titik** ("1.200 pcs"). **Satuan SELALU menempel di sebelah angka**, tidak pernah hanya di kepala kolom. Input: `inputmode="numeric"`, pemisah ribuan otomatis, "Rp" tercetak mati di dalam kolom. Waktu: <1 jam "12 menit lalu" · hari ini "hari ini 14.32" · kemarin "kemarin 09.10" · 2–6 hari "3 hari lagi (Sab, 20 Sep)" · ≥7 hari "20 Sep 2026". Untuk yang mengikat kontrak, tanggal absolut jadi teks utama: "Berakhir 30 Sep 2026 · tinggal 17 hari". Bulan: Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des.

### 7.5 Komponen yang harus dibangun (14, dipakai ulang bukan disalin)
Bilah Navigasi (4 item) · Kepala Halaman (3 ikon) · **Pita Data Kasir** (4 keadaan, 32px, selalu 1 baris) · **Baris Daftar** (satu komponen, isi berbeda di Stok dan Belanja) · **Chip Status** (ikon+teks+warna dari satu sumber token) · **Stepper Jumlah** (tombol 48×48 dipisahkan kolom angka; angka di tengah bisa diketuk membuka papan angka dengan isi lama terpilih; tahan-tekan mempercepat setelah 500ms; **langkah mengikuti kelipatan jual distributor**; pill satuan pcs↔dus dengan baris bantu "= 72 pcs"; chip wajib **"Kembalikan ke saran (250)"**) · **Kartu Tindakan** (Beranda) · **Kuota Bulan Ini** (bar dua segmen) · **Kartu Perkiraan** (3 state × 3 tingkat turun derajat) · **Lembar Pesan Cepat** (3 varian baris, tiga pintu masuk) · **Kartu Pesanan** · **Bottom Sheet** (maks 70% tinggi layar, daftar menggulir di tengah, footer lengket) · **Banner Status Akun** (3 keadaan, bisa diciutkan, tidak bisa ditutup) · **Keadaan Kosong Berguna**.

### 7.6 Aturan responsif
- **< 768px (potret, patokan utama):** bottom nav 4 slot; satu kolom; tidak ada tabel; filter jadi chip geser horizontal yang membuka bottom sheet dengan tombol lengket "Terapkan (12 hasil)"; **badan halaman tidak boleh pernah bergeser horizontal** — grafik dan tabel lebar menggulir di dalam wadahnya sendiri.
- **768–1023px:** Stok tetap daftar, Beranda dua kolom; side nav.
- **≥ 1024px:** side nav 4 item **sama persis**, rute identik. Divergensi disengaja: Stok kembali jadi tabel yang bisa diurutkan (+ kolom kategori, terakhir berubah, batas aman, nilai rupiah) dengan panel kanan master-detail; Belanja jadi rail filter kiri 280px + grid 3 kolom; Beranda jadi grid 12 kolom — kiri 4 "Perlu Diurus" dengan gulir sendiri, kanan 8 grafik penuh + tabel kontrak. **Mobile = daftar keputusan, desktop = tabel kerja.** Bottom sheet menjadi modal dengan isi identik.
- **Performa:** daftar > 100 baris divirtualisasi; placeholder memakai skeleton berbentuk baris 88px (bukan spinner di tengah); pustaka grafik **hanya dimuat di Beranda dan Detail Barang**.

---

## 8. Prioritas Implementasi

**P0 — tanpa ini ada jalan buntu, bukan sekadar rasa kurang.** Kerangka 4 tab + kepala 3 ikon + peta rute datar ke tab induk; `/masuk`; registrasi 3 langkah dengan akun tercipta di langkah 1; `/akun/kasir` 3 kartu sumber data termasuk Catat Pemakaian Harian; `/akun/kasir/panduan/:merek`; `/stok/pemakaian`; `/mulai/batas-aman` + "Pakai semua saran"; `/beranda` dengan urutan blok terkunci + Pita Data Kasir; `/stok`, `/stok/baru`, `/stok/:id`, `/stok/:id/ubah`, `/stok/:id/koreksi`, `/stok/:id/batas-aman`; `/belanja`, `/distributor/:id`, `/penawaran/:id` dan tiga layar kontraknya; `/pesan-cepat/:idSaran` (3 varian baris) + kunci 3 detik + kunci idempoten; `/keranjang`, `/keranjang/ringkasan`, `/keranjang/selesai`; `/pesanan`, `/pesanan/:id`, **`/pesanan/:id/terima`**; `/kontrak/:id` + komponen Kuota Bulan Ini; `/notifikasi` + peta perilaku + aturan 1 barang = 1 notifikasi aktif; Kartu Perkiraan 3 state + 3 tingkat turun derajat; mode Jelajah Terbatas; `/akun`, `/akun/profil`, `/akun/data-usaha`.

`/akun/data-usaha` masuk P0 karena verifikasi yang ditolak tidak punya jalan keluar lain; tanpa layar itu, akun yang datanya ditolak mentok permanen.

**P1 — dipakai di bulan pertama, aplikasi tetap utuh tanpanya.** `/lupa-sandi`; `/stok/hitung` + `/stok/hitung/ringkasan` (naik dari P2 karena tombol "Hitung fisik sekarang" pada stok minus harus punya tujuan sejak P1); tab "Perlu Dibereskan" + `/akun/kasir/pasangkan/:idMenu` (butuh backend mengklasifikasi kegagalan ke kategori terbatas **dan** menyimpan payload gagal untuk diproses ulang — tanpa proses ulang, membereskan pemetaan tidak memperbaiki stok yang telanjur salah); blok Pembayaran + unggah bukti; `/pesanan/:id/ulasan`; `/distributor/:id/ulasan`; `/mitra/:id`; `/akun/jenis-usaha`; `/akun/notifikasi`; `/akun/bantuan`; riwayat pergerakan barang berbahasa bisnis; chip kedaluwarsa.

**P2 — ditunda tanpa merusak struktur.** `/stok/:id/rapor` (prasyarat snapshot perkiraan harian per barang harus mulai ditulis di P0 walau layarnya P2; baris akurasi di Beranda ditayangkan bersama layar ini); `/kontrak/:id/rutin`; `/stok/kategori`; `/akun/profil/pratinjau`; `/akun/pengguna` + `/akun/pengguna/undang`; `/akun/langganan`; `/akun/ulasan`; impor CSV; keranjang multi-kontrak satu-pesanan; antrean offline penuh.

---

## 9. Pertanyaan yang Masih Terbuka untuk Pemilik Proyek

1. **Q-2 — kuota tidak terpenuhi: blokir atau peringatan?** UI sudah netral sehingga rilis tidak terhambat, tapi kolom "Kalau kuota tidak terpenuhi" harus diisi seseorang — distributor saat membuat paket, atau Admin sebagai aturan seragam? Kalau tidak ada yang mengisi, barisnya akan selalu berbunyi "Distributor belum mencantumkan ketentuan ini" dan pemilik usaha menandatangani kewajiban tanpa tahu konsekuensinya.
2. **Apakah pesanan boleh dibuat tanpa kontrak ("Beli Sekali")?** Menentukan apakah model data menerima `contract_id` kosong. Kalau semua pesanan wajib berkontrak, seluruh alur notifikasi mati untuk pengguna baru.
3. **Berapa hari data minimum sebelum perkiraan ditampilkan?** Dokumen ini memakai 14 hari dan angka itu tercetak di layar. Kalau ambangnya berbeda per barang, label berubah jadi "8 dari 12 barang Anda sudah siap diprediksi".
4. **Apakah microservice ML bisa mengeluarkan interval prediksi (rentang), atau hanya satu titik?** Kalau hanya titik, rentang **tidak boleh** dikarang di frontend.
5. **Ada SLA verifikasi Admin?** Banner saat ini berbunyi "Kami kabari lewat WhatsApp begitu selesai" karena tidak boleh menjanjikan "1×24 jam" tanpa SLA.
6. **Apakah "Terverifikasi Dasar" (foto tempat usaha, tanpa NIB) boleh mengambil kontrak?** Kalau NIB diwajibkan, segmen terbesar tidak akan pernah lolos registrasi.
7. **Siapa mengisi kelipatan pemesanan (1 dus = berapa satuan pakai)?** Tanpa kolom wajib di sisi distributor, stepper tetap menebak dan jumlah bisa ditolak setelah dikonfirmasi.
8. **Apakah "Pesan sekaligus ke satu distributor" boleh tetap menghasilkan beberapa pesanan di belakang layar untuk MVP?** Ya = biaya sedang, tampil sebagai satu grup belanja. Tidak = perubahan model data berbiaya besar yang harus masuk jadwal sekarang.
9. **Default privasi kontak: tertutup sampai memesan, atau terbuka untuk semua distributor?** Default tertutup melindungi pengguna tapi menghilangkan prospek keluar dari distributor.
10. **Untuk Premium: otomasi pembayaran mengganti isi blok Pembayaran, atau menambah alur baru?** Tata letak sudah disiapkan untuk penggantian komponen di kotak yang sama.


---

## Lampiran A: Sitemap final (tabel rute)

| Rute | Nama layar | Induk | Prioritas | Tujuan |
| --- | --- | --- | --- | --- |
| `/masuk` | Masuk | - | P0 | Autentikasi berbasis Nomor HP, identitas nyata segmen ini |
| `/daftar` | Daftar — Buat Akun (1/3) | - | P0 | Menciptakan akun di langkah pertama supaya user yang terputus tidak hilang tanpa jejak |
| `/daftar/usaha` | Tentang Usaha Anda (2/3) | /daftar | P0 | Identitas usaha + menentukan bentuk default form Tambah Barang lewat pertanyaan bisnis, bukan istilah teknis |
| `/daftar/legalitas` | Data Legalitas (3/3) | /daftar | P0 | Mengambil NIB bila ada, dengan jalur 'Terverifikasi Dasar' bagi warung tanpa NIB |
| `/lupa-sandi` | Lupa Kata Sandi | - | P1 | Pemulihan akses lewat OTP ke nomor HP |
| `/mulai/batas-aman` | Kapan Kami Harus Mengingatkan Anda? | - | P0 | Mengisi batas aman massal supaya notifikasi stok tipis bisa berbunyi sejak hari ke-1 |
| `/beranda` | Beranda | - | P0 | Menjawab 'hari ini saya harus ngapain?' dengan daftar tindakan; tidak pernah memiliki data sendiri |
| `/stok` | Stok | - | P0 | Satu daftar DATAR semua barang gudang, diurut paling genting dulu, agar koreksi stok cukup 2 ketukan |
| `/stok/baru` | Tambah Barang | /stok | P0 | Menambah barang dengan satuan pakai wajib dan kemasan beli opsional; tidak ada kolom harga jual |
| `/stok/:id` | Detail Barang | /stok | P0 | Satu tempat melihat kondisi satu barang dan semua aksinya |
| `/stok/:id/ubah` | Ubah Barang | /stok/:id | P0 | Mengubah data master barang termasuk melengkapi kemasan beli dan kategori |
| `/stok/:id/koreksi` | Koreksi Stok | /stok/:id | P0 | Menyesuaikan stok manual dengan alasan terstruktur agar susut tidak terbaca sebagai permintaan oleh ML |
| `/stok/:id/batas-aman` | Atur Batas Aman | /stok/:id | P0 | Menetapkan ambang pengingat, hibrida saran sistem + kunci manual |
| `/stok/:id/rapor` | Rapor Perkiraan | /stok/:id | P2 | Mengadu perkiraan dengan kenyataan supaya kepercayaan punya arah naik |
| `/stok/pemakaian` | Catat Pemakaian Harian | /stok | P0 | Memberi input ke model bagi usaha yang belum pakai kasir digital, tanpa jadi POS bayangan |
| `/stok/hitung` | Hitung Stok | /stok | P1 | Menyelaraskan angka layar dengan isi rak secara massal, tanpa anchoring ke angka sistem |
| `/stok/hitung/ringkasan` | Ringkasan Hasil Hitung | /stok/hitung | P1 | Menerapkan semua selisih sebagai satu kelompok, bukan puluhan anomali terpisah |
| `/stok/kategori` | Kelola Kategori | /stok | P2 | Mengatur daftar kategori sebagai label filter, bukan folder navigasi |
| `/belanja` | Belanja | - | P0 | Mencari barang dan melihat siapa yang menjualnya dengan harga berapa; tidak pernah menampilkan pesanan sendiri |
| `/distributor/:id` | Profil Distributor | /belanja | P0 | Menilai kelayakan pemasok sebelum mengikat komitmen yang tidak bisa diputus |
| `/distributor/:id/ulasan` | Ulasan Distributor | /distributor/:id | P1 | Membaca ulasan terverifikasi lengkap |
| `/penawaran/:id` | Detail Penawaran | /belanja | P0 | Memisahkan dua niat dengan konsekuensi jauh berbeda: beli sekali vs mengikat diri 1-5 bulan |
| `/penawaran/:id/kontrak` | Pilih Paket Kontrak | /penawaran/:id | P0 | Membandingkan paket A-E terhadap pemakaian sendiri, dengan TOTAL wajib diambil selalu terlihat |
| `/penawaran/:id/kontrak/:paket` | Rincian Paket Kontrak | /penawaran/:id/kontrak | P0 | Menampilkan total rupiah komitmen sebelum ketukan terakhir; satu pintu tunggal layar penuh |
| `/penawaran/:id/kontrak/:paket/tinjau` | Periksa Kesepakatan | /penawaran/:id/kontrak/:paket | P0 | Titik sadar terakhir sebelum kewajiban yang tidak bisa dibatalkan sendiri |
| `/pesanan` | Pesanan | - | P0 | Kotak keluar: semua pesanan dan semua kontrak yang sedang dijalani; tidak pernah menampilkan katalog |
| `/pesanan/:id` | Detail Pesanan | /pesanan | P0 | Melacak satu pesanan, mencatat pembayaran di luar aplikasi, dan jadi pintu ke Terima Barang |
| `/pesanan/:id/terima` | Terima Barang | /pesanan/:id | P0 | Satu-satunya layar yang membuat stok BERTAMBAH dan menggerakkan progres kuota kontrak |
| `/pesanan/:id/ulasan` | Beri Penilaian | /pesanan/:id | P1 | Satu-satunya pintu menulis ulasan, hanya dari pesanan Selesai, agar rating tidak bisa dipalsukan |
| `/kontrak/:id` | Rincian Kontrak | /pesanan | P0 | Memantau satu kontrak dan jadi tujuan tautan notifikasi kuota; rute berdiri sendiri walau dirender di tab Pesanan |
| `/kontrak/:id/rutin` | Atur Pesanan Rutin | /kontrak/:id | P2 | Menghemat ingatan, bukan menghemat ketukan — draf yang tetap butuh persetujuan tiap siklus |
| `/mitra/:id` | Kerja Sama dengan Distributor | /pesanan | P1 | Menjawab 'bulan ini saya wajib ambil apa saja dari Pak Budi' tanpa mengubah aturan 1 kontrak = 1 barang |
| `/notifikasi` | Pemberitahuan | - | P0 | Rumah persisten bagi rekomendasi ML dan peringatan stok, supaya satu push terlewat tidak menghapus nilai utama aplikasi |
| `/keranjang` | Keranjang | - | P0 | Menyusun pesanan per distributor dan menyatakan jujur berapa pesanan yang akan lahir sebelum dikonfirmasi |
| `/keranjang/ringkasan` | Ringkasan Sebelum Kirim | /keranjang | P0 | Satu langkah baca-saja sebagai pengaman sebelum uang jutaan rupiah terkirim |
| `/keranjang/selesai` | Pesanan Dibuat | /keranjang | P0 | Menutup alur dengan bukti dan jalan keluar, termasuk menangani kegagalan sebagian |
| `/pesan-cepat/:idSaran` | Lembar Pesan Cepat | - | P0 | Satu komponen untuk tiga pintu masuk: kartu Beranda, baris Pemberitahuan, dan pita draft |
| `/akun` | Akun | - | P0 | Rumah bagi semua fitur sekali-pasang yang sebelumnya yatim |
| `/akun/profil` | Profil Usaha | /akun | P0 | Bio-IG usaha, status verifikasi Admin, dan kendali data yang dilihat distributor |
| `/akun/profil/pratinjau` | Lihat sebagai Distributor | /akun/profil | P2 | Membuktikan secara visual data mana yang terbuka, bukan menjelaskannya dengan teks |
| `/akun/data-usaha` | Data Usaha & Legalitas | /akun | P0 | Memperbaiki data yang ditolak Admin tanpa mengulang registrasi — satu-satunya jalan keluar akun yang ditolak |
| `/akun/kasir` | Data dari Kasir | /akun | P0 | Satu layar untuk menyambungkan kasir (dipakai juga sebagai langkah onboarding via ?langkah=mulai), membereskan data gagal, dan melihat riwayat |
| `/akun/kasir/panduan/:merek` | Panduan Sambungkan Kasir | /akun/kasir | P0 | Menuntun user menyalin kode sambungan dari aplikasi kasirnya tanpa kata API |
| `/akun/kasir/pasangkan/:idMenu` | Pasangkan Menu ke Bahan | /akun/kasir | P1 | Menghubungkan menu terjual di kasir ke bahan baku supaya stok berkurang |
| `/akun/jenis-usaha` | Cara Hitung Stok | /akun | P1 | Mengubah jawaban 'Apa yang Anda jual?' kapan saja tanpa migrasi data |
| `/akun/notifikasi` | Pengaturan Pengingat | /akun | P1 | Mengatur jenis pengingat tanpa menyediakan pengaturan jam yang tidak akan disentuh siapa pun |
| `/akun/pengguna` | Pengguna & Hak Akses | /akun | P2 | RBAC internal Kasir vs Manajer di dalam satu akun usaha, tanpa portal terpisah |
| `/akun/pengguna/undang` | Tambah Pengguna | /akun/pengguna | P2 | Menambah kasir atau manajer lewat nomor HP |
| `/akun/langganan` | Langganan | /akun | P2 | Tiering Default vs Premium, termasuk otomasi pembayaran yang mengganti komponen blok Pembayaran tanpa mengubah tata letak |
| `/akun/ulasan` | Ulasan Saya | /akun | P2 | Jalur pemulihan bagi ajakan ulasan sekali-tayang yang sudah ditutup |
| `/akun/bantuan` | Bantuan & Tentang Aplikasi | /akun | P1 | Menggabungkan Pusat Bantuan dan Tentang Aplikasi; satu-satunya tempat kata 'prediksi' dan cara kerja model boleh muncul |

---

## Lampiran B: Keputusan desain besar

### B-1. Navigasi utama 4 tab (Beranda · Stok · Belanja · Pesanan) + 3 ikon kepala halaman (Pemberitahuan, Keranjang, Akun); Akun di balik avatar, bukan tab kelima

**Alasan:** Siklus hidup pesanan adalah pertanyaan harian pemilik warung ('kopi saya jadi dikirim hari ini nggak?'); dengan 3 tab ia butuh 3 ketukan melewati katalog yang berat di koneksi lemah, plus dua lapis bilah tab bertumpuk di 360px. Yang ditambah dari angka 3 bukan halaman fitur melainkan kotak keluar. Target sentuh menyempit ke 25% lebar layar, tapi 25% dari 360px masih 90px — jauh di atas ambang 48px. Akun di balik avatar karena isinya tugas sekali-pasang dan Beranda memunculkan jalan pintasnya lewat banner.

**Alternatif yang ditolak:** 3 tab (Dashboard/Inventori/Marketplace) — menyisakan 7 fitur yatim tanpa pintu masuk dan mengubur siklus hidup pesanan. 5 tab dengan Kontrak sendiri — memberi 20% slot permanen pada fitur yang dibuka sebulan sekali dan membuat label terpotong.

### B-2. Kedalaman sitemap diputuskan oleh satu aturan yang bisa diuji: sebuah lembar (bottom sheet) hanya diberi rute kalau ada sesuatu di luar layar induknya yang menautinya. Hasilnya 51 rute.

**Alasan:** Kedua kutub salah. Memberi rute pada semua lembar menghasilkan 65+ simpul dan ilusi bahwa aplikasinya rumit; tidak memberi rute pada satu pun memaksa tautan notifikasi mendarat di layar induk lalu berharap user menemukan sendiri tombolnya. Aturan ini menjaga navigasi tetap dangkal secara rasa tanpa membuat tautan notifikasi menabrak layar tanpa alamat. Contoh penerapannya: /stok/:id/koreksi dan /stok/:id/batas-aman dapat rute (ditaut dari kartu Beranda dan kartu tugas Data Kasir), sedangkan Atur Resep, Unggah Bukti Transfer, dan dialog Batalkan Pesanan tidak.

**Alternatif yang ditolak:** Sitemap 28 rute yang memperlakukan semua sub-aksi sebagai lembar tanpa alamat — tautan notifikasi jadi tidak bisa mendarat presisi. Sitemap 65+ rute yang memberi alamat pada tiap sub-aksi — menambah simpul tanpa menambah kemampuan.

### B-3. Rute datar per entitas, termasuk /penawaran/:id dan /distributor/:id yang TIDAK bersarang di bawah /belanja; rute kontrak jadi /penawaran/:id/kontrak/:paket/tinjau

**Alasan:** Penawaran (1 barang x 1 distributor) adalah entitas yang sama persis dengan kartu yang diketuk user, dan menjadikannya entitas memendekkan rute kontrak dari enam segmen jadi empat. Rute datar juga satu-satunya cara membuat tautan notifikasi bertahan melewati perubahan menu dan membuat tombol Kembali dari notifikasi tidak menutup aplikasi saat tumpukan riwayat kosong.

**Alternatif yang ditolak:** Rute bersarang /belanja/barang/:idPenawaran — melanggar aturan datar yang dinyatakan sendiri dan mati kalau menu dipindah. Rute /distributor/:id/barang/:idBarang/kontrak/:paket/tinjau — enam segmen, rapuh dan tidak terbaca.

### B-4. Stok bertambah HANYA lewat layar 'Terima Barang', sebesar jumlah yang diakui diterima; sistem tidak pernah menutup pesanan otomatis, dan pesanan tidak pernah macet di Dikirim (koreksi tetap maju ke 'Selesai (ada catatan)')

**Alasan:** Tanpa layar ini lingkaran data terbuka: pesanan selesai tapi stok tidak naik, notifikasi stok tipis terus berbunyi untuk barang yang karungnya sudah di gudang, kuota kontrak tidak bergerak, dan data latih ML tidak punya catatan pemasukan. Jalur 80% kasus tetap satu ketukan lewat 'Ya, semua sesuai'. Larangan macet penting karena satu-satunya jalan keluar user kalau alur mentok adalah tidak menekan apa pun, sehingga stok tak pernah masuk.

**Alternatif yang ditolak:** Menambah stok saat pesanan dibuat atau saat distributor menandai Dikirim — peringatan stok padam padahal barang belum ada, kasir terus mengurangi dari saldo fiktif, tanggal masuk yang salah mencemari data latih, dan pesanan batal memaksa pembalikan angka.

### B-5. Q-1 diselesaikan lewat dua lapis pengelompokan dengan prioritas berbeda: Lapis 1 (P0) segmen Kontrak dikelompokkan per BARANG + toggle [Per barang][Per pemasok] yang memberi tombol 'Pesan sekaligus ke <distributor>' pada header grup; Lapis 2 (P1) halaman /mitra/:id sebagai drill-down dari header grup, bukan simpul navigasi paralel

**Alasan:** Aturan final 1 kontrak = 1 barang tetap utuh; yang berubah hanya cara UI menyusunnya. Judul kartu adalah nama barang karena pemilik warung berpikir 'kopi saya dipasok siapa saja', bukan 'distributor X memasok apa saja'. Pembagian prioritas disengaja: toggle menyelesaikan tugas MEMESAN (menghapus pengulangan alur 3 kali — itu jalan buntu, jadi P0), halaman Mitra menyelesaikan tugas MENILAI HUBUNGAN pemasok dengan blok 'Kewajiban bulan ini' dan riwayat pengiriman (tidak menghalangi rilis, jadi P1).

**Alternatif yang ditolak:** Mengubah aturan jadi kontrak berbasis distributor (Opsi B) — melanggar keputusan final. Menghapus halaman Mitra sama sekali — toggle tidak bisa menampung agregat kewajiban dan riwayat pengiriman. Menjadikan Mitra tab atau simpul navigasi sendiri — menambah navigasi permanen untuk tugas bulanan.

### B-6. Q-2 ditangani satu komponen netral bernama 'Kuota Bulan Ini' (bukan 'Target Beli per Bulan'): bar dua segmen Sudah diterima / Dalam perjalanan, tiga status netral Aman / Perlu Dikejar / Kurang, tombol pesan tidak pernah dinonaktifkan karena kuota, dan konsekuensi hanya muncul sebagai satu baris di Rincian Kontrak yang isinya dari kolom data kontrak

**Alasan:** Q-2 belum dijawab pemilik proyek. Kalau UI terlanjur menulis 'kontrak akan dibatalkan' atau sebaliknya 'tidak ada sanksi', salah satunya nanti harus dibongkar termasuk semua layar yang memakainya. Kalau nanti diputuskan memblokir, cukup menambah status keempat 'Terkunci' + banner tanpa mengubah bentuk layar mana pun. Nama 'Kuota' dipertahankan karena 'target' menyiratkan sasaran yang boleh meleset, sedangkan kuota adalah kewajiban kontraktual — melunakkannya adalah kesalahan yang sama dengan mengganti 'Kontrak' jadi 'Langganan'. Definisi pemenuhan dikunci sekarang: kuota hanya bertambah setelah pesanan berstatus Selesai.

**Alternatif yang ditolak:** Menampilkan konsekuensi langsung di kartu kontrak. Menonaktifkan tombol pesan saat kuota berisiko. Memakai kata 'gagal', 'melanggar', 'denda', 'penalti', 'blokir' di layar mana pun. Melunakkan nama komponen jadi 'Target Beli per Bulan'.

### B-7. Pengikatan kontrak tetap DUA langkah (Rincian Paket Kontrak → Periksa Kesepakatan) dengan Total Komitmen ditampilkan di kedua layar; langkah ketiga (bottom sheet konfirmasi) dihapus

**Alasan:** Menggabungkannya jadi satu layar menghasilkan ketidakkonsistenan yang tidak bisa dipertahankan: alur pemesanan biasa sudah menuntut satu langkah baca-saja (/keranjang/ringkasan) untuk pesanan Rp 300.000, jadi mustahil membenarkan nol langkah baca-saja untuk komitmen Rp 21.600.000 yang tidak bisa dibatalkan sendiri. Dua langkah cukup, tiga berlebihan. Kekuatan bukti diambil dari jejak tersimpan (waktu, akun, versi teks kontrak) + salinan ke WhatsApp, bukan dari gestur.

**Alternatif yang ditolak:** Satu layar gabungan 'Rincian & Persetujuan'. Alur tiga langkah dengan bottom sheet konfirmasi tambahan. Satu centang gabungan. Tekan-tahan atau ketik-nama-untuk-konfirmasi — pola asing untuk literasi digital menengah-rendah.

### B-8. Keranjang berbentuk sub-keranjang per distributor (pengelompokan, subtotal, perkiraan tiba) tapi dikirim lewat SATU tombol yang menyebut angka: 'Buat 3 Pesanan', bukan satu tombol per sub-keranjang

**Alasan:** Karena 1 kontrak = 1 barang, satu rekomendasi ML bisa terikat 3 kontrak di 2 distributor, jadi pemecahan harus dinyatakan sebelum dikonfirmasi. Tapi kalimat 'akan dikirim sebagai 3 pesanan ke 3 distributor' sudah menghilangkan kejutan yang jadi alasan memecah tombol, sedangkan tiga tombol memaksa tiga konfirmasi untuk satu niat belanja. Pengguna yang memang ingin mengirim sebagian memakai tautan sekunder 'Simpan sub-keranjang ini untuk nanti'. Ditambah /keranjang/selesai yang memungkinkan 'Kirim ulang' hanya pada baris yang gagal.

**Alternatif yang ditolak:** Satu keranjang global datar dengan satu tombol 'Konfirmasi Pesanan' — pecah diam-diam saat checkout. Tombol 'Buat Pesanan' terpisah di tiap sub-keranjang tanpa checkout gabungan — tiga konfirmasi untuk satu niat. Model data 'satu pesanan banyak kontrak' (satu ongkir, satu nomor) — benar secara UX tapi berbiaya besar di backend; ditunda ke setelah MVP.

### B-9. Layar '/mulai/batas-aman — Kapan Kami Harus Mengingatkan Anda?' masuk onboarding sebagai P0, DAN aksi massal 'Pakai saran sistem untuk semua barang ini' tetap ada di filter Stok sebagai jalur perbaikan permanen

**Alasan:** Tanpa batas aman, seluruh rantai notifikasi mati dan pengguna menyimpulkan fitur prediksinya bohong. Satu-satunya momen daftarnya segar dan perhatian user masih di sana adalah tepat setelah impor kasir; aksi massal yang bersembunyi di balik chip filter tidak akan pernah disentuh pengguna baru. Ini bukan menumpuk dua fitur — satu komponen dengan dua pintu masuk, pola yang sama dengan Lembar Pesan Cepat.

**Alternatif yang ditolak:** Hanya mengandalkan aksi massal di dalam filter Stok — tidak pernah ditemukan pengguna baru. Hanya layar onboarding tanpa jalur perbaikan — barang yang ditambahkan belakangan tidak punya cara membereskan batas amannya secara massal.

### B-10. Data dari Kasir dikonsolidasi jadi SATU layar /akun/kasir bertab (Sambungan · Perlu Dibereskan · Riwayat) yang juga dipakai sebagai langkah onboarding lewat ?langkah=mulai; yang tinggal di tab Stok hanyalah pita peringatan yang menaut ke sana

**Alasan:** Log mentah (timestamp, endpoint, status 200/422) tidak terbaca pemilik warung dan mencampurnya dengan jawaban bisnis membuat tab Stok terasa seperti alat teknisi. Memecah antrean tugas ke dalam Stok mengulang kesalahan yang sama. Kartu tugas berbahasa manusia dengan satu tombol aksi ('Menu Es Kopi Susu terjual 23x tapi belum dipasangkan ke bahan') mengubah kegagalan jadi pekerjaan yang bisa dibereskan. Satu komponen dengan dua kerangka menghapus kebutuhan rute /mulai/sumber-data terpisah.

**Alternatif yang ditolak:** 'Riwayat Log Sinkronisasi POS' di dalam Inventori sesuai sitemap lama. Memecah antrean tugas ke /stok/data-kasir sementara setup dan log ada di /akun/kasir — tiga tempat untuk satu masalah. Menampilkan stok minus sebagai angka negatif.

### B-11. Registrasi dipecah 3 langkah dengan akun tercipta di langkah 1 (Nomor HP + Kata Sandi saja); 'Nomor UMKM'/'Nomor Usaha' diganti NIB + NPWP opsional + centang 'Usaha saya belum punya NIB' yang beralih ke unggah foto tempat usaha; layar 'Pendaftaran Berhasil' DIHAPUS

**Alasan:** Kalau user berhenti di kolom ke-5 mencari lembar NIB, seluruh isian hilang karena akun belum pernah dibuat — user yang hilang tidak meninggalkan jejak untuk dihubungi. Dua label nomor yang nyaris identik membuat user mengisi asal dan Admin tidak punya apa pun untuk diverifikasi. Mayoritas warung sasaran tidak punya NIB sama sekali. Layar 'Pendaftaran Berhasil' dihapus karena satu-satunya tugasnya mengantar ke langkah berikutnya; kalimat 'akun sedang diperiksa' pindah ke banner Beranda yang memang harus hidup berhari-hari.

**Alternatif yang ditolak:** 7 kolom satu layar. Mewajibkan NIB — menutup pintu bagi segmen terbesar. Meminta foto KTP di MVP. Mempertahankan layar selebrasi 'Pendaftaran Berhasil' — satu ketukan tanpa isi.

### B-12. Layar 'Sinkronisasi API POS' diganti pertanyaan 'Dari mana data penjualan Anda?' dengan 3 kartu, termasuk 'Saya belum pakai kasir digital' yang membuka mode Catat Pemakaian Harian dengan batas tegas: satu kolom angka per barang, tidak boleh pernah menampilkan rupiah

**Alasan:** Kolom Base URL dan API Key mustahil diisi pemilik warung, dan segmen terbesar tidak memakai kasir digital sama sekali sehingga satu-satunya jalan keluar mereka adalah 'Lewati' yang berujung aplikasi kosong selamanya. Batas tegas pada kartu 3 mencegahnya tumbuh jadi POS bayangan yang melanggar keputusan final POS tidak dibangun. Hasil uji koneksi harus bercerita ('Ditemukan 128 barang dan penjualan 30 hari terakhir'), bukan berbunyi 'Sukses'.

**Alternatif yang ditolak:** Impor CSV dengan pemetaan kolom di MVP — layar pemetaan kolom adalah produk tersendiri yang melayani segmen paling kecil. 'Lewati untuk saat ini' sebagai tombol setara dengan ketiga kartu.

### B-13. Verifikasi Admin memakai mode Jelajah Terbatas: aplikasi tetap terbuka penuh, hanya 'Ajukan Kontrak' dan 'Buat Pesanan' yang tergembok dan tetap terlihat; status verifikasi jadi blok di /akun/profil (bukan layar sendiri) dengan perbaikan di /akun/data-usaha yang masuk P0

**Alasan:** Layar tunggu kosong membuat user menutup aplikasi dan tidak kembali, dan ketika verifikasi selesai sistem masih nol data historis sehingga masa tunggu jadi berganda. Membiarkan Belanja dijelajahi adalah intinya: itu satu-satunya bagian yang sudah berisi data nyata sejak menit pertama. Banner butuh tujuan, dan tujuan terbaiknya adalah tempat user juga bisa langsung memperbaiki. /akun/data-usaha masuk P0 karena akun yang datanya ditolak tidak punya jalan keluar lain — tanpa layar itu ia mentok permanen.

**Alternatif yang ditolak:** Satu flag global yang mengunci seluruh akun. Menyembunyikan tab Belanja sampai terverifikasi. Layar /verifikasi terpisah yang hanya menampilkan status tanpa bisa memperbaiki.

### B-14. Kartu Perkiraan punya 3 state kematangan data per BARANG (0-13 / 14-27 / >=28 hari) dan 3 tingkat turun derajat saat microservice ML gagal, diisolasi di tingkat kartu bukan halaman; angka ML dilarang mengisi otomatis pilihan kuota kontrak

**Alasan:** Sekali pemilik kehabisan stok padahal sistem bilang 'aman 3 hari', seluruh fitur ML mati kepercayaannya. State A tidak menampilkan angka prediksi sama sekali tapi tetap membuat peringatan stok tipis jalan sejak hari ke-1 lewat batas aman manual. Isolasi per kartu mencegah satu timeout microservice mematikan akses ke Stok dan Belanja yang sebenarnya baik-baik saja. Prediksi mingguan tidak sah dipakai sebagai dasar komitmen 3 bulan yang tidak bisa diputus.

**Alternatif yang ditolak:** Menampilkan angka tunggal telanjang 'disarankan restok 50 unit'. Memakai persentase atau interval statistik sebagai lencana keyakinan. Mengarang rentang +/-15% di frontend. Memakai kata 'error', 'server', 'API', 'timeout' di layar mana pun. Mengisi kuota kontrak otomatis dari saran ML.

### B-15. Kategori dibubarkan sebagai level navigasi; Stok jadi satu daftar datar dengan kategori turun pangkat jadi chip filter, sortir bawaan 'Paling genting dulu', dan angka stok disimpan hanya dalam satu Satuan Pakai per barang dengan kemasan beli sebagai lapisan

**Alasan:** Untuk katalog warung 40-80 barang, struktur Kategori > Produk membuat koreksi stok gula darurat jadi 4 lapis dan pengguna menanggung biaya salah tebak kategori setiap kali. Kolom Harga di struktur lama juga bertabrakan dengan keputusan final bahwa harga jual dikelola di POS eksternal. Untuk satuan: tiga pihak memakai satuan berbeda untuk barang yang sama — kasir mengurangi dalam satuan pakai, distributor menjual dalam kemasan, ML mengeluarkan angka satuan pakai — jadi tanpa lapisan konversi, rekomendasi 'restok 50 pcs' tidak bisa jadi pesanan ke distributor yang hanya jual dus isi 24.

**Alternatif yang ditolak:** Mempertahankan 'Kategori > Produk (Stok, Harga, Jumlah)'. Menyimpan stok per kemasan. Satu kolom satuan tunggal seperti tabel lama. Chip konversi kemasan yang menebak isi dus tanpa data dari distributor.

### B-16. Halaman Pemberitahuan dibuka dari lonceng (bukan tab), dengan aturan 1 barang = 1 notifikasi aktif, pembisuan barang yang sudah dipesan sampai pesanan Selesai/Batal, saran belanja sekali pukul 07.00, dan badge yang hanya menghitung yang butuh tindakan

**Alasan:** Notifikasi adalah mesin penggerak produk tapi rancangan lama hanya punya pengaturannya. Stok tipis adalah kondisi yang BERTAHAN: tanpa aturan, sistem memberitahu hal yang sama puluhan kali sehari, pemilik warung mematikan seluruh notifikasi, dan seluruh nilai fitur prediksi hilang. Pembisuan barang yang sudah dipesan adalah yang mencegah pesanan dobel. Chip filter 'Saran Belanja' dipisahkan karena hanya kategori itu yang punya daur hidup berbeda (hidup sampai draftnya dipesan atau dilewati).

**Alternatif yang ditolak:** Notifikasi sebagai tab keempat di bottom nav. Menghapus notifikasi yang sudah tidak relevan — riwayat 'kapan saya dikasih tahu soal gula' harus tetap bisa ditelusuri. Jam saran belanja yang bisa dipilih user di MVP — layar pengaturan yang tidak akan disentuh siapa pun.

### B-17. Menulis ulasan hanya bisa dari pesanan berstatus Selesai; tombol tulis ulasan dihapus dari profil distributor dan diganti teks status, dengan jalur pemulihan di /akun/ulasan (P2)

**Alasan:** Bagi pemilik warung tanpa jaringan, rating adalah satu-satunya dasar memilih pemasok untuk komitmen yang tidak bisa diputus. Rating yang bisa dipalsukan akun boneka lebih berbahaya daripada tidak ada rating. Karena ajakan sekali-tayang setelah Terima Barang bisa ditutup, harus ada jalur pemulihan — tanpa itu ulasan yang terlewat hilang permanen. Distributor baru diberi badge netral 'Distributor Baru' alih-alih 0,0 bintang supaya pendatang baru tidak terbunuh dan tidak terdorong membeli ulasan.

**Alternatif yang ditolak:** Tombol tulis ulasan di profil distributor yang bisa ditekan siapa pun. Satu angka rating tunggal tanpa konteks jumlah pesanan. Menghapus /akun/ulasan demi menghemat simpul — ulasan yang terlewat jadi tidak punya jalan kembali.

### B-18. Status pembayaran ditampilkan sebagai blok kotak terpisah di bawah garis waktu pengiriman, berlabel 'Dicatat di luar aplikasi', dan tidak pernah menonaktifkan tombol apa pun termasuk 'Barang Sudah Sampai'

**Alasan:** Kalau pembayaran tidak muncul sama sekali, pemilik kehilangan satu-satunya catatan siapa sudah dibayar. Kalau disisipkan ke dalam garis waktu pesanan, aplikasi terlihat memblokir pengiriman sampai lunas, padahal uangnya berpindah di luar aplikasi (final) dan banyak UMKM memakai tempo. Tata letak kotak yang sama dipakai ulang untuk akun Premium dengan otomasi pembayaran, jadi tidak perlu dua rancangan layar.

**Alternatif yang ditolak:** Status 'Menunggu Pembayaran' sebagai langkah dalam garis waktu pesanan. Menyembunyikan pembayaran sepenuhnya. Menambahkan escrow atau pembayaran dalam aplikasi di jalur Default.

### B-19. Pesanan Rutin berperilaku sebagai draf yang butuh persetujuan tiap siklus (label 'Atur Pesanan Rutin', H-2 membuat draf + notifikasi, draf yang tidak ditanggapi tetap draf dan naik jadi kartu Beranda), plus tombol jeda 'Libur dulu bulan ini'

**Alasan:** Kalau tombol itu langsung menyalakan pengiriman otomatis, pemilik warung bisa menerima dan harus membayar 30 kg kopi di minggu warungnya tutup renovasi. Sekali itu terjadi, fitur otomatis dimatikan selamanya. Otomasi ini menghemat ingatan, bukan menghemat ketukan — pertukaran yang benar untuk barang dan uang yang keluar dari warung.

**Alternatif yang ditolak:** 'Buat Pesanan Rutin' yang langsung mengirim tiap siklus. Meniadakan otomasi sama sekali — pemenuhan kuota kontrak jadi beban ingatan manual tiap bulan.

### B-20. Beranda disusun sebagai daftar 'Perlu Diurus' dengan urutan blok dikunci sebagai spesifikasi; grafik garis turun ke Detail Barang, kartu omzet/untung/margin dilarang, dan baris akurasi perkiraan baru ditayangkan bersama layar Rapor Perkiraan (P2)

**Alasan:** Grafik adalah objek paling lambat dimuat dan paling lambat dipahami; menaruhnya paling atas berarti memberi tempat paling berharga kepada informasi paling mahal, sementara satu-satunya hal yang butuh keputusan hari ini terdorong ke bawah lipatan. Harga jual ada di POS eksternal (final), jadi angka rupiah penjualan apa pun di layar ini pasti salah; nilai rupiah pengadaan tetap wajib muncul di Belanja, Keranjang, dan Kontrak. Baris akurasi ditahan sampai Rapor Perkiraan ada karena baris yang menaut ke layar yang belum dibangun adalah jalan buntu.

**Alternatif yang ditolak:** Grafik prediksi sebagai elemen pertama Dashboard. Kartu 'Prediksi Omzet Minggu Ini'. Menayangkan baris akurasi di Beranda P0 sementara layar tujuannya P2.
