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
| 0. Rancangan | Dokumen ini, ARCHITECTURE.md, mockup | Disetujui Ilham |
| 1. Portal dan jual dasar | Portal terpisah di `/pos`, masuk dengan akun usaha yang sudah ada, keranjang, kirim nota. Daftar menu dan harga jual diatur pemilik di Portal UMKM, POS hanya membaca | Satu penjualan memotong stok dan tersimpan sebagai nota |
| 2. Interaksi langsung dan pemasangan resep | Portal UMKM yang terbuka menangkap nota baru tanpa dimuat ulang: baris stok menyala, pemberitahuan "Nota masuk", dan baris data kasir berubah. Ringkasan Penjualan mendapat ringkasan nota dan Lihat Semua Nota. Menu tanpa resep tetap bisa dijual, masuk ke panel lonceng, dan bisa dipasangkan dengan resep saran | Perubahan terlihat dalam beberapa detik. Sesudah resep dipasangkan, penjualan berikutnya memotong stok |
| 3. Pembayaran | Tunai dengan kembalian, QRIS dan transfer yang hanya dicatat, diskon, struk di layar | Nota menyimpan cara bayar dan diskon |
| 4. Batal dan retur | Pembatalan nota dengan alasan, stok kembali lewat pergerakan balik | Stok dan Ringkasan Penjualan tetap cocok |
| 5. Shift dan peran | Buka dan tutup kas, selisih kas, akun kasir khusus yang hanya bisa membuka Portal POS | Rekap per shift |
| 6. Kesiapan demo | Data demo, README, `siapkan.cmd` diarahkan ke `main` | Alur demo jalan dari pemasangan baru |

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
| Kopi Susu Pandan | Biji Kopi Arabika 18 g, Susu UHT Full Cream 150 ml, Sirup Pandan 20 ml, Es Batu Kristal 150 g, Gelas Plastik 16 oz 1, Sedotan Kertas 1 |
| Roti Bakar Keju | Roti Tawar 2 lembar, Keju Cheddar 30 g, Susu Kental Manis 15 ml, Tisu Makan 1 |
| Kentang Goreng | Kentang Beku 150 g, Minyak Goreng 30 ml, Tisu Makan 1 |

Sirup Pandan, Roti Tawar, dan Minyak Goreng belum ada di gudang demo Kopi Kita, jadi ketiganya ditambahkan ke data demo.
Sirup Pandan juga belum ada di katalog.

Di layar memasangkan ada pilihan **Pakai resep saran**. Tombol itu hanya mengisi bahan dan takaran, dan pemilik masih bisa
mengubahnya sebelum menyimpan. Pemasangan berlaku untuk penjualan berikutnya, tidak menarik ulang penjualan yang sudah lewat.

## Bukan lingkup MVP

- Pembayaran sungguhan atau payment gateway. Uang hanya dicatat.
- Tampilan HP. Menyusul sesudah versi desktop.
- QR pembayaran. Rencana berikutnya adalah QR simulasi yang jelas berlabel simulasi dan tidak bisa dipakai membayar.
- Kasir saat internet putus dan cetak struk ke printer.
- Pajak, faktur, dan kepatuhan untuk warung sungguhan.
- Konektor ke aplikasi kasir pihak ketiga.
- Prediksi yang berubah seketika. Mesin analitik tetap berjalan terjadwal.

## Ukuran keberhasilan

- Satu penjualan di Portal POS selesai dalam paling banyak tiga langkah sesudah menu dipilih.
- Portal UMKM yang terbuka di jendela lain menampilkan perubahan stok paling lama 5 detik sesudah nota terkirim.
- Mengirim ulang nota yang sama tidak memotong stok dua kali (sudah diuji di `backend/uji/test_struk.py`).
- Jumlah pergerakan stok sama dengan stok tercatat sesudah penjualan dan pembatalan.
