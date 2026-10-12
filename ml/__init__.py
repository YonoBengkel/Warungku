"""
Layanan model Turnify Flow: Mesin 1 (perkiraan permintaan) dan Mesin 2 (saran distributor).

Dipisah dari `api` karena satu alasan praktis: dependensinya berat (torch,
pymc) dan waktu mulanya lambat. Kalau digabung, setiap kali API dimuat ulang
ia ikut menunggu torch. Lebih penting lagi, kalau layanan ini mati, portal harus
tetap bisa dibuka dengan angka terakhir yang tersimpan — dan itu hanya mungkin
kalau keduanya memang proses yang berbeda.

Aturan yang memisahkan keduanya: **layanan model menulis ke tabel, API membaca
tabel.** API tidak pernah memanggil model saat halaman dibuka.
"""
