# PRD Turnify Flow

Kebutuhan produk Turnify Flow, dengan fokus pada Portal POS yang sedang dibangun. Cara kerjanya ada di
[ARCHITECTURE.md](ARCHITECTURE.md), dan aturan tampilannya di [DESIGN.md](DESIGN.md).

## Masalah

Pemilik warung dan kedai sulit tahu sisa stok, kapan harus memesan, berapa banyak, dan ke distributor mana.
Turnify Flow menjawabnya dari nota kasir. Selama ini nota itu datang dari data simulasi, karena tidak ada kasir
yang tersambung, sehingga hubungan antara penjualan dan stok tidak bisa diperlihatkan secara langsung.

## Pengguna

- **Kasir:** mencatat penjualan di konter dengan cepat. Ini pengguna baru Portal POS.
- **Pemilik usaha:** memantau stok, prediksi, dan pesanan di Portal UMKM, serta memasangkan resep menu.
- **Distributor:** menerima pesanan dan kontrak di Portal Distributor. Tidak berubah oleh pekerjaan ini.
- **Penguji demo:** dosen dan tim, yang melihat Portal POS dan Portal UMKM berjalan berdampingan.

## Lingkup MVP Portal POS

Target saat ini adalah demo di desktop dengan akun simulasi Kopi Kita Jogja.

| Tahap | Isi | Tanda selesai |
|---|---|---|
| 0. Rancangan (selesai) | Dokumen ini, ARCHITECTURE.md, mockup | Disetujui Ilham |
| 1. Portal dan jual dasar (selesai) | Portal terpisah di `/pos`, masuk dengan akun usaha yang sudah ada, keranjang, kirim nota. Daftar menu dan harga jual diatur pemilik di Portal UMKM, POS hanya membaca | Satu penjualan memotong stok dan tersimpan sebagai nota |
| 2. Interaksi langsung dan pemasangan resep (selesai) | Portal UMKM yang terbuka menangkap nota baru tanpa dimuat ulang: baris stok menyala, pemberitahuan "Nota masuk", dan baris data kasir berubah. Ringkasan Penjualan mendapat ringkasan nota dan Lihat Semua Nota. Menu tanpa resep tetap bisa dijual, masuk ke panel lonceng, dan bisa dipasangkan dengan resep saran | Perubahan terlihat dalam beberapa detik. Sesudah resep dipasangkan, penjualan berikutnya memotong stok |
| 3. Pembayaran (selesai) | Tunai dengan kembalian, QRIS yang hanya dicatat (sejak revisi V8 lewat QR simulasi, dan transfer dihapus), diskon per nota, struk di layar. Total Ringkasan Penjualan dipotong diskon dan dirinci per cara bayar | Nota menyimpan cara bayar, diskon, dan uang diterima |
| 4. Batal (selesai) | Kasir mengajukan pembatalan dengan alasan di halaman Nota Portal POS. Pemilik membatalkan di Ringkasan Penjualan, dan stok kembali lewat pergerakan koreksi. Retur barang yang sudah dibawa pembeli belum termasuk | Stok dan Ringkasan Penjualan tetap cocok |
| 5. Shift dan peran (selesai) | Pemilik membuat akun kasir di Pengguna & Hak Akses. Kasir hanya bisa membuka Portal POS, dan server menolak semua yang bukan daftar pendek POS. Buka kas dengan uang modal, tutup kas dengan uang yang dihitung dan selisihnya | Kasir tidak bisa membatalkan nota atau mengubah menu dan harga. Rekap shift dan selisih laci tampil bagi pemilik |
| 6. Kesiapan demo (selesai) | Data demo, README, `siapkan.cmd` diarahkan ke `main`, alur demo satu halaman ([ALUR-DEMO-POS.md](docs/ALUR-DEMO-POS.md)), tampilan HP dasar, dan image backend 0.12.0 di Docker Hub (terbit 3 November 2026) | Alur demo jalan dari pemasangan baru, lewat `nyalakan.cmd` maupun `siapkan.cmd` |

Pembagian tugas antarportal: menu, harga jual, dan resep hanya diatur di Portal UMKM. Portal POS membacanya dan mengirim
nota, jadi kasir tidak bisa mengubah harga atau resep. Nota dilihat pemilik di Ringkasan Penjualan, tanpa tab baru.

## Harga contoh untuk demo

Es Kopi Susu Gula Aren Rp 22.000, Americano Rp 18.000, Matcha Latte Rp 26.000, Cokelat Panas Rp 20.000, Kopi Susu Pandan
Rp 24.000, Roti Bakar Keju Rp 18.000, Kentang Goreng Rp 15.000.

## Resep saran untuk demo

Tiga menu Kopi Kita sengaja belum punya resep, supaya alur memasangkan bisa diperlihatkan. Takarannya per porsi, dan
angkanya contoh demo.

| Menu | Bahan |
|---|---|
| Kopi Susu Pandan | Biji Kopi Arabika 18 g, Susu UHT Full Cream 150 ml, Sirup Vanila 20 ml (pengganti sirup pandan), Es Batu Kristal 150 g, Gelas Plastik 16 oz 1, Sedotan Kertas 1 |
| Roti Bakar Keju | Roti Tawar 2 lembar, Keju Cheddar 30 g, Susu Kental Manis 15 ml |
| Kentang Goreng | Kentang Beku 150 g, Minyak Goreng 30 ml |

Roti Tawar dan Minyak Goreng belum ada di gudang demo Kopi Kita, jadi keduanya ditambahkan ke data demo. Sirup pandan
belum ada di katalog, jadi resepnya memakai Sirup Vanila yang sudah ada. Tisu tidak dipakai, karena dicatat manual dan
barang seperti itu tidak bisa menjadi bahan menu.

Di layar memasangkan ada pilihan **Pakai resep saran**. Tombol itu hanya mengisi bahan dan takaran, dan pemilik masih bisa
mengubahnya sebelum menyimpan. Pemasangan berlaku untuk penjualan berikutnya, tidak menarik ulang penjualan yang sudah lewat.

## Warung Madura

Konsep awal proyek ini adalah warung madura, yang barangnya sangat banyak dan bukanya tidak pernah berhenti. Akun
`madura1@warungku.test` memperlihatkannya: sekitar 150 barang generik dalam 12 kelompok termasuk rokok dan LPG, tanpa bensin
eceran, nota 24 jam dengan puncak malam, dan empat distributor kelontong. Penjualannya dari kasir simulasi, bukan Portal
POS. Warung kelontong tidak memakai tab Produksi, karena barangnya dijual apa adanya.

## Aturan saran beli

Sejak 4 November 2026 aplikasi memakai aturan yang diuji di simulasi laporan. Batas aman adalah perkiraan pemakaian p90
selama lama kirim. Saran beli muncul kalau stok ditambah barang yang sudah dipesan turun di bawah batas aman, sebanyak
perkiraan p50 selama 21 hari ditambah batas aman, dikurangi stok dan barang yang sudah dipesan. Hasil simulasi pada
permintaan normal: barang yang pernah kehabisan stok 2,8% lawan 4,1% dengan aturan rata-rata tanpa model.

## Aturan kontrak

Keputusan Ilham, 4 November 2026: kuota kontrak yang belum terpenuhi hanya menjadi peringatan, transaksi tidak diblokir. Akun
tanpa NIB boleh membuat kontrak.

## Bukan lingkup MVP

- Pembayaran sungguhan atau payment gateway. Uang hanya dicatat.
- Tampilan HP. Menyusul sesudah versi desktop.
- QR pembayaran sungguhan. Yang ada sejak revisi V8 adalah QR simulasi: berlabel simulasi, berisi tautan biasa (bukan QRIS),
  dan HP di jaringan yang sama yang membukanya menandai tagihan lunas tanpa uang yang berpindah.
- Kasir saat internet putus dan cetak struk ke printer.
- Pajak, faktur, dan kepatuhan untuk warung sungguhan.
- Konektor ke aplikasi kasir pihak ketiga.
- Prediksi yang berubah seketika. Mesin analitik tetap berjalan terjadwal.

## Ukuran keberhasilan

- Satu penjualan di Portal POS selesai dalam paling banyak tiga langkah sesudah menu dipilih.
- Portal UMKM yang terbuka di jendela lain menampilkan perubahan stok paling lama 5 detik sesudah nota terkirim.
- Mengirim ulang nota yang sama tidak memotong stok dua kali (sudah diuji di `backend/uji/test_struk.py`).
- Jumlah pergerakan stok sama dengan stok tercatat sesudah penjualan dan pembatalan.
