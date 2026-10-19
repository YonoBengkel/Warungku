# Kurasi UX — cabang Rombak#4

Daftar kerja kurasi pengalaman pengguna Turnify Flow, disusun 19 Oktober 2026 dari tiga
audit kode (alur pengadaan UMKM, portal distributor, sistem desain) dan tangkapan layar
data server di lebar 1440px dan 390px. Keluhan awal Ilham: tata letak tombol kurang
menarik, tulisan kurang mencolok, penjelasan terlalu panjang, dan alurnya terasa tersendat.

Acuan rasa tetap majoo (bedahnya di [Brief-Rebrand-Turnify-Flow.md](Brief-Rebrand-Turnify-Flow.md),
bagian 2), dan spesifikasi layar pemilik usaha tetap
[IMPROVEMENT-Interface-Pemilik-Usaha.md](IMPROVEMENT-Interface-Pemilik-Usaha.md). Dokumen ini
tidak menggantikan keduanya; ia mencatat apa yang dirapikan di atasnya.

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
4. **Satu gaya "terpilih".** Tab (ganti tampilan) dan chip (saring daftar) memakai gaya
   terpilih yang sama. Ungu penuh dicadangkan untuk tombol utama.
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
- [ ] Rating ditulis empat cara; `fmtJml` disalin tiga kali dengan aturan desimal berbeda dari `jumlahSatuan`.
- [x] "Beri Penilaian" tampil dua kali di Rincian Pesanan.
- [x] Deskripsi barang "20000 gram per karung" menjadi "1 karung = 20 kg" (`katalog.deskripsi_kemasan`; basis data lama dirapikan `dataset.rapikan_deskripsi`, dijalankan `nyalakan`).
- [x] "0 menit lalu" di `waktuLalu`; label "(boleh dikosongkan)" di kolom masuk distributor yang sebenarnya wajib.

### Fase 1 — fondasi
- [x] Komponen `Penjelasan` (dilipat, memakai `<details>`), dipakai di `KeteranganMetode` sehingga nama metode tetap tampil tapi daftar masukannya dilipat.
- [x] Token teks di `index.css`: judul, subjudul, kartu, isi (14px), kecil (12px), angka. Input 16px supaya Safari iOS tidak memperbesar halaman.
- [~] `Tombol`: ragam `tautan` (pengganti ±70 tautan teks), `bahaya-garis`, `penuh="mobile"`, ukuran ikon otomatis. Ragam dan `penuh="hp"` sudah ada; penggantian tautan teks di halaman belum.
- [x] Gaya terpilih: tab berupa jalur abu-abu dengan pilihan terangkat putih, chip ungu muda. Ungu penuh hanya untuk tombol utama.
- [ ] `KepalaHalaman` untuk halaman akar juga; bilah atas desktop yang hanya berisi lonceng dan keranjang dirapikan.

### Fase 2 — alur pengadaan pemilik usaha
- [x] Rincian barang: "Pesan Sekarang" menjadi tombol utama saat habis/menipis dan membuka saran Mesin 2 dengan jumlah saran; "Koreksi Stok" menjadi utama hanya saat stok minus; "Ubah Barang" yang dobel dibuang; keterangan grafik dan alasan saran dilipat.
- [~] Beranda: satu kartu "N barang perlu dibeli" dengan satu tombol, bukan korsel berisi sampai lima tombol utama. Label pintasan disamakan dengan penyaring Stok. Sudah: hanya kartu teratas bertombol utama, bingkai kartu netral, "Pesan Sekarang" yang mengisi keranjang menjadi "Masukkan ke Keranjang", label pintasan disamakan. Korsel belum diganti.
- [~] Detail Penawaran: jumlah awal Beli Sekali = kekurangan terhadap perkiraan bulan depan (sudah). "Ikat Kontrak" tetap tombol utama, sesuai keputusan yang tertulis di kodenya; perlu keputusan Ilham kalau mau dibalik.
- [x] Keranjang: "Buat N Pesanan" yang hanya pindah layar diganti "Periksa & Kirim".
- [ ] Pesanan: syarat "sudah sampai" disamakan antara Beranda dan kartu pesanan; kartu diberi tombol "Terima".
- [~] Kosakata: Beli Sekali/Beli Lepas, Hampir/Segera kedaluwarsa, Kontrak Habis/Akan berakhir, pemasok/distributor, filter/penyaring/saringan. Sudah: Beli Sekali, Segera Kedaluwarsa, Kontrak Akan Berakhir.

### Fase 3 — portal distributor
- [x] Tab Menunggu diurutkan dari yang paling lama menunggu; lama tunggu tampil jelas di kartu.
- [ ] Aksi massal "Terima (n)" dan "Tandai dikirim (n)" (bukan untuk Tolak).
- [~] Rincian pesanan: kembali ke tab asal (sudah), tombol "Pesanan berikutnya" (belum).
- [ ] Status memuat pada aksi supaya ketukan ganda tidak terkirim dua kali.
- [x] Kartu ringkasan di halaman Pesanan yang mengulang tab dihapus; tombol Terima di setiap kartu tidak lagi ungu penuh.
- [x] Kontrak: membuka tab yang berisi, urutan tombol [Utama | Tolak] sama dengan Pesanan.
- [ ] Pelanggan: saran segmen diberi aksi (hubungi, tawarkan kontrak).

### Fase 4 — tipografi dan spasi di seluruh halaman
- [~] Codemod per folder: `text-[0.8125rem]` → isi, dan seterusnya sesuai peta di audit; langkah spasi x.5 dibulatkan. Sudah: 1.100-an ukuran teks diganti token (0,8125/0,875 → isi 14px, 0,75 → kecil, 0,9375 → kartu, judul halaman 22px); input 16px. Spasi belum.
- [~] Sapuan 360/1440px, tema terang dan gelap, setiap folder. Sudah: 34 rute pemilik usaha dan 9 rute distributor tanpa geseran di 360px.

## Bukti

Tangkapan layar sebelum kurasi ada di scratchpad sesi; sesudah setiap fase diambil ulang
dengan `tools/tangkap_layar.mjs` pada rute yang sama.
