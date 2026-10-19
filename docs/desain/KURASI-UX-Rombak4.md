# Kurasi UX — cabang Rombak#4

Daftar kerja kurasi pengalaman pengguna Turnify Flow, disusun 19 Oktober 2026 dari tiga
audit kode (alur pengadaan UMKM, portal distributor, sistem desain) dan tangkapan layar
data server di lebar 1440px dan 390px. Keluhan awal Ilham: tata letak tombol kurang
menarik, tulisan kurang mencolok, penjelasan terlalu panjang, dan alurnya terasa tersendat.

Acuan rasa tetap majoo (bedahnya di [Brief-Rebrand-Turnify-Flow.md](Brief-Rebrand-Turnify-Flow.md),
bagian 2), dan spesifikasi layar pemilik usaha tetap
[IMPROVEMENT-Interface-Pemilik-Usaha.md](IMPROVEMENT-Interface-Pemilik-Usaha.md). Dokumen ini
tidak menggantikan keduanya; ia mencatat apa yang dirapikan di atasnya. Aturan yang berlaku
sesudah kurasi dirangkum di [DESIGN.md](../../DESIGN.md) di akar repo.

## Prinsip

1. **Satu tombol utama per layar.** Tombol ungu penuh hanya untuk langkah berikutnya yang
   paling mungkin. Sisanya bergaris atau berupa tautan. Di daftar kartu, hanya kartu pertama
   yang boleh punya tombol utama.
2. **Fakta dulu, penjelasan dilipat.** Kalimat yang tampil cukup satu, paling panjang ±90
   huruf. Rincian (cara membaca grafik, alasan saran, data yang dipakai model) masuk ke
   komponen `Penjelasan` yang bisa dibuka.
3. **Teks badan 14px, bukan 13px.** majoo memakai dasar 16px dan label 14px; kita memakai 13px
   di 500 tempat, kebanyakan abu-abu. Keterangan yang perlu dibaca memakai `ink-2`; `ink-3`
   hanya untuk keterangan yang boleh dilewati.
4. **Terpilih bukan ungu penuh.** Tab (ganti tampilan) memakai jalur abu-abu dengan pilihan
   terangkat putih; chip (saring daftar) dan tombol pilihan memakai ungu muda. Ungu penuh
   dicadangkan untuk tombol utama. (Rumusan awal "satu gaya terpilih" diubah saat Fase 1.)
5. **Satu kata untuk satu aksi.** "Pesan" berarti mengirim pesanan; mengisi keranjang ditulis
   "Masukkan ke Keranjang".
6. **Angka tidak boleh saling membantah.** Dua widget yang menghitung hal yang sama membaca
   sumber yang sama.

## Fase dan status

Tanda: [x] selesai, [~] sebagian, [ ] belum.

### Fase 0 — cacat yang langsung terlihat
- [x] Lonceng dan spanduk distributor menghitung data contoh, rekap menghitung data server (`store/aplikasi.ts`, `useJumlahPerluKonfirmasi`).
- [x] Kata "server" di layar: "Putuskan dari Server", "Sambungkan ke server", "Data server · …", "Dibaca dari server", "Mengambil … dari server", pesan galat bawaan `lib/api.ts`.
- [x] "0 hari lalu" di Pelanggan, "Bahan cukup untuk 0 toples saja" di Produksi, pesan galat Promo yang menulis "belum diisi" padahal hanya kurang panjang.
- [x] Format angka dari backend: `ml/mesin2/saran.py` menulis "4.8 dari 5"; `backend/api/produksi.py` menulis "20000.000 gram". Sesudah diperbaiki, Mesin 2 dijalankan ulang.
- [x] Rating ditulis empat cara → satu `bintang()` ("4,0"); `fmtJml` yang disalin tiga kali → `angkaJumlah()` di `lib/format.ts`. Jumlah kuota kontrak kini memakai `angkaJumlah()` (tidak lagi "13 dus" di samping "12,5 dus"); sisa pasangan `{angka(x)} {satuan}` adalah jumlah kemasan yang memang bulat.
- [x] "Beri Penilaian" tampil dua kali di Rincian Pesanan.
- [x] Deskripsi barang "20000 gram per karung" menjadi "1 karung = 20 kg" (`katalog.deskripsi_kemasan`; basis data lama dirapikan `dataset.rapikan_deskripsi`, dijalankan `nyalakan`).
- [x] "0 menit lalu" di `waktuLalu`; label "(boleh dikosongkan)" di kolom masuk distributor yang sebenarnya wajib.

### Fase 1 — fondasi
- [x] Komponen `Penjelasan` (dilipat, memakai `<details>`), dipakai di `KeteranganMetode` sehingga nama metode tetap tampil tapi daftar masukannya dilipat.
- [x] Token teks di `index.css`: judul, subjudul, kartu, isi (14px), kecil (12px), angka. Input 16px supaya Safari iOS tidak memperbesar halaman.
- [x] `Tombol`: ragam `tautan` (pengganti ±70 tautan teks), `bahaya-garis`, `penuh="mobile"`, ukuran ikon otomatis. Ragam dan `penuh="hp"` sudah ada. Sengaja tidak dikerjakan: mengganti ±70 tautan teks yang ada, karena tampilannya sudah seragam (ungu tebal, tinggi sentuh 44px) dan penggantiannya hanya kosmetik di kode.
- [x] Gaya terpilih: tab berupa jalur abu-abu dengan pilihan terangkat putih, chip ungu muda. Ungu penuh hanya untuk tombol utama.
- [x] Bilah atas desktop yang hanya berisi lonceng dan keranjang dihapus; keduanya pindah ke navigasi samping. Kepala halaman detail kini menempel di bawah bilah global (`--kepala-global`; dulu tertutup penuh saat digulir di HP). Tombol bilah aksi bawah di desktop ±450px di kanan. Halaman akar tidak diberi komponen baru: judulnya sudah seragam (`text-judul`), jadi cukup keterangannya diseragamkan (`text-isi text-ink-2`, 62ch). Tombol "Keluar" dobel di kepala Pesanan dan Pelanggan distributor dibuang; Keluar tetap di navigasi samping dan pita HP.

### Fase 2 — alur pengadaan pemilik usaha
- [x] Rincian barang: "Pesan Sekarang" menjadi tombol utama saat habis/menipis dan membuka saran Mesin 2 dengan jumlah saran; "Koreksi Stok" menjadi utama hanya saat stok minus; "Ubah Barang" yang dobel dibuang; keterangan grafik dan alasan saran dilipat.
- [x] Beranda: satu kartu "N barang perlu dibeli" dengan satu tombol, bukan korsel berisi sampai lima tombol utama. Label pintasan disamakan dengan penyaring Stok. Sudah: hanya kartu teratas bertombol utama, bingkai kartu netral, "Pesan Sekarang" yang mengisi keranjang menjadi "Masukkan ke Keranjang", label pintasan disamakan, dan di desktop semua tugas tampil dalam kisi. Korsel sengaja tetap di HP, satu kartu per layar.
- [x] Detail Penawaran: jumlah awal Beli Sekali = kekurangan terhadap perkiraan bulan depan. "Beli Sekali" menjadi tombol utama dan "Ikat Kontrak" bergaris (keputusan Ilham, 19 Okt); kalau stok distributor kosong, Ikat Kontrak kembali utama.
- [x] Keranjang: "Buat N Pesanan" yang hanya pindah layar diganti "Periksa & Kirim".
- [x] Pesanan: syarat "sudah sampai" disamakan antara Beranda dan kartu pesanan (bukti antar atau perkiraan tiba lewat); kartu yang sedang dikirim diberi tombol "Terima Barang".
- [x] Kosakata: Beli Sekali/Beli Lepas, Hampir/Segera kedaluwarsa, Kontrak Habis/Akan berakhir, pemasok/distributor, filter/penyaring/saringan. Sudah: Beli Sekali, Segera Kedaluwarsa, Kontrak Akan Berakhir, "distributor" (bukan "pemasok") dan "filter" (bukan "saringan"/"saring") di teks layar.

### Fase 3 — portal distributor
- [x] Tab Menunggu diurutkan dari yang paling lama menunggu; lama tunggu tampil jelas di kartu.
- [x] Aksi massal: "Terima Semua (n)" (Menunggu), "Kirim Semua (n)" (Disiapkan) dan "Tandai Semua Sampai (n)" (Dikirim), dengan satu lembar bukti antar untuk semua dan satu ringkasan. Tolak tetap satu per satu.
- [x] Rincian pesanan: kembali ke tab asal, dan tautan "Menunggu berikutnya" ke pesanan menunggu yang paling lama.
- [x] Status memuat pada aksi supaya ketukan ganda tidak terkirim dua kali (`pesananDiproses`).
- [x] Kartu ringkasan di halaman Pesanan yang mengulang tab dihapus; tombol Terima di setiap kartu tidak lagi ungu penuh.
- [x] Kontrak: membuka tab yang berisi, urutan tombol [Utama | Tolak] sama dengan Pesanan.
- [x] Pelanggan: segmen andalan/rutin → Atur Paket Kontrak, sedang → Buat Promo, baru → Pesanan Disiapkan. "Mulai menjauh" sengaja tanpa tombol: nomor HP pemilik usaha baru terbuka lewat pesanan.

### Fase 4 — tipografi dan spasi di seluruh halaman
- [x] Codemod per folder: `text-[0.8125rem]` → isi, dan seterusnya sesuai peta di audit; langkah spasi x.5 dibulatkan. Sudah: 1.100-an ukuran teks diganti token (0,8125/0,875 → isi 14px, 0,75 → kecil, 0,9375 → kartu, judul halaman 22px); input 16px. Sengaja tidak dikerjakan: pembulatan langkah spasi x.5 (±680 tempat), karena hampir tidak terlihat dan berisiko menggeser tata letak yang sudah lolos sapuan.
- [x] Sapuan 360/1440px, tema terang dan gelap, setiap folder. Sudah: 34 rute pemilik usaha dan 9 rute distributor tanpa geseran di 360px.

### Pemangkasan teks
- [x] ±40 paragraf panjang di 27 berkas dipendekkan menjadi satu kalimat; rinciannya dilipat ke `Penjelasan` atau dibuang bila mengulang judul. Halaman Bantuan dan halaman depan sengaja tetap panjang. Lembar Tolak distributor baru menampilkan "Alasan wajib diisi" setelah Tolak ditekan tanpa alasan.
- [x] Kontras teks `Penjelasan` diukur di tema terang dan gelap: terendah 4,93:1 (syarat AA 4,5:1).
- [x] Konstanta `BANTUAN.*` di `lib/label.ts` ditinjau: semuanya sudah di bawah 90 huruf.

### Telaah ulang sesudah tahap 3
- [x] Kartu pesanan: nama distributor tidak lagi terpotong oleh lencana dua baris; baris judul membungkus dan lencana status satu baris.
- [x] Beranda: "Perlu Tindakan" mulai 640px berupa empat ubin berangka, bukan empat ikon kecil di kiri.
- [x] Beranda distributor: "Sebaran pemesan" berupa titik kecil berwarna dan angka, bukan tiga lingkaran besar.
- [x] Portal distributor desktop: bilah atas yang hanya berisi lonceng disembunyikan; angkanya pindah ke menu Pesanan di navigasi samping.

### Telaah alur sekunder (Keranjang, Periksa, Terima Barang, Koreksi, paket kontrak, Akun, Masuk, Daftar)
- [x] Keranjang HP: harga subtotal tidak lagi terpecah ("Rp" dan angkanya di dua baris); harga per baris 17px, tidak lagi 24px yang bersaing dengan total.
- [x] Tombol pilihan bergaya hitam di Akun, Data Usaha, Panduan Kasir, dan Profil Distributor memakai gaya terpilih ungu muda. Komponen `TabTautan` yang tidak dipakai dibuang.
- [x] Mode data server: pemberitahuan diturunkan dari data yang sudah dimuat (`lib/notifikasiServer.ts`): stok habis/menipis, kiriman sampai, kontrak akan berakhir. Diperbarui otomatis setiap stok, pesanan, atau kontrak berubah; status dibaca dipertahankan per id. Barang yang sudah dipesan tampil tapi tidak dihitung di lonceng. "Pesan Sekarang" membuka saran Mesin 2 di rincian barang.
- Tetap: tombol "Login" di halaman depan, sesuai catatan pemilik proyek yang tertulis di kode.

### Lain-lain
- [x] Pemberitahuan stok merah hanya untuk yang genting; tanda wajib `*` tidak lagi merah.

### Telaah adversarial (`a243aa0..baf3150`)
Agen terpisah menelaah seluruh diff cabang; tujuh cacat dan satu catatan, semuanya diperbaiki:
- [x] Pemberitahuan server yang memburuk (menipis → habis) tidak muncul lagi sebagai belum dibaca. Kini status dibaca hanya diwarisi bila tingkat dan judulnya sama.
- [x] "Pesan Sekarang" dari tab Riwayat di rincian barang tidak berbuat apa-apa (kartu saran hanya ada di Ringkasan). Kini pindah ke Ringkasan dulu.
- [x] Aksi massal menyalin nomor resi, penerima, dan catatan ke pesanan pemesan lain. Kini lembar massal hanya menanyakan jasa kirim dan pengantar (berangkat) atau tanpa isian (sampai).
- [x] Tinggi halaman Stok dan Sebaran di desktop masih menghitung bilah global yang sudah disembunyikan (pita kosong ±49px).
- [x] Judul kartu saran tertutup bilah lengket setelah digulir otomatis (`scroll-mt` mengikuti `--kepala-global`).
- [x] Judul halaman depan rapat di ≥640px karena token angka membawa jarak baris 1.
- [x] Jumlah awal lembar beli bisa melebihi stok distributor.
- [x] Lencana tunggu pesanan lebih dari 30 hari terbaca "Menunggu 12 Okt" → "Menunggu sejak 12 Okt".

## Bukti

Tangkapan layar sebelum kurasi ada di scratchpad sesi; sesudah setiap fase diambil ulang
dengan `tools/tangkap_layar.mjs` pada rute yang sama.
