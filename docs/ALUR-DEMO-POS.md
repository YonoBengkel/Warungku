# Alur demo Portal POS

Satu halaman untuk presentasi. Intinya: kasir menjual di satu jendela, dan pemilik melihat stok, laporan, dan
pemberitahuan berubah di jendela lain tanpa memuat ulang.

## Persiapan

1. Nyalakan dari kode repo dengan `nyalakan.cmd` (jalur Docker `siapkan.cmd` belum membawa Portal POS, lihat catatan di
   bawah). Skrip itu menaikkan skema, memasang variasi demo, dan membuka aplikasi.
2. Buka **dua jendela peramban berdampingan**, supaya sesinya terpisah:
   - **Portal UMKM:** `/masuk`, tab Pakai Email, tombol **Isikan akun simulasi: Kopi Kita**, lalu buka **Stok**.
   - **Portal POS:** `/masuk/pos`, tombol **Isikan akun kasir** (Rina Kasir).
3. Kata sandi akun simulasi ada di [README.md](../README.md) bagian Akun simulasi. Tombol isi otomatis sudah memakainya.

## Langkah

| # | Di mana | Yang dilakukan | Yang terlihat |
|---|---|---|---|
| 1 | POS | Buka kas dengan uang modal 100.000 | Layar kasir terbuka. Tanpa buka kas, menu tidak tampil |
| 2 | POS | Pilih 2 Es Kopi Susu dan 1 Kentang Goreng. Diskon 9.000, tunai, uang 100.000 | Total 50.000, kembalian 50.000. Uang kurang menonaktifkan tombol bayar |
| 3 | POS | Bayar dan Kirim Nota | Struk di layar. Kentang Goreng diberi catatan resepnya belum dipasangkan |
| 4 | UMKM | Lihat tanpa menyentuh apa pun (sekitar 3 detik) | Toast "Nota masuk dari kasir", baris bahan Es Kopi Susu menyala di tabel Stok, lonceng menambah pemberitahuan |
| 5 | UMKM | Lonceng, Pasangkan, Pakai Resep Saran, Simpan Pemasangan | Layar terisi bahan dan takaran, masih bisa diubah sebelum disimpan |
| 6 | POS | Jual Kentang Goreng lagi | Di UMKM stok Kentang Beku dan Minyak Goreng menyala dan turun |
| 7 | POS | Nota, Ajukan Pembatalan pada nota pertama, alasan "Salah pesan" | Lencana Menunggu pemilik. Kasir tidak punya tombol Batalkan |
| 8 | UMKM | Toast pengajuan, Ringkasan Penjualan, Batalkan | Stok kembali, total Ringkasan turun, nota hilang dari daftar |
| 9 | POS | Shift, hitung uang di laci, tutup kas | Seharusnya = modal + tunai. Selisih Pas, Lebih, atau Kurang |
| 10 | UMKM | Ringkasan Penjualan, bagian Shift kasir | Selisih dan tunai shift tadi |
| 11 | UMKM | Akun, Pengguna & Hak Akses, Tambah Kasir | Akun kasir baru, bisa dinonaktifkan. Daftar yang boleh dan tidak boleh dilakukan kasir |

Tambahan untuk menunjukkan peran: kasir membuka `/beranda` dan langsung dialihkan ke `/pos`. Akun kasir juga
ditolak di halaman Masuk Portal UMKM.

## Yang perlu dikatakan terus terang

- **Prediksi tidak berubah seketika.** Stok, laporan, dan pemberitahuan langsung. Angka Prediksi menunggu penjadwal
  mesin (02.00 dan tiap 4 jam), karena model menulis ke tabel dan halaman hanya membacanya.
- **Uang hanya dicatat.** QRIS dan transfer tidak lewat aplikasi, dan tidak masuk hitungan laci.
- **Resep saran adalah contoh.** Kopi Susu Pandan memakai Sirup Vanila sebagai pengganti sirup pandan, yang belum ada
  di katalog.
- **Satu laci per usaha.** Hanya satu shift boleh terbuka.
- **Retur barang belum ada.** Yang ada pembatalan nota.

## Kalau ada yang tidak muncul

- **Tidak ada toast atau sorotan baris:** tab UMKM harus terlihat (tab di latar tidak memeriksa nota) dan sudah masuk
  dengan akun server, bukan data contoh.
- **Menu atau harga kosong di POS:** variasi demo belum terpasang. Jalankan `python -m dataset.variasi_demo` dari akar
  repo, atau `nyalakan.cmd` lagi.
- **Resep saran tidak mengisi semua bahan:** Roti Tawar atau Minyak Goreng tidak punya penawaran di data simulasi, jadi
  tidak ditambahkan. Bahan yang ada tetap terisi.
- **Portal POS tidak ada di `siapkan.cmd`:** image backend `0.12.0` belum diterbitkan. Pakai `nyalakan.cmd`.
