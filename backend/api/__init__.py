"""
Layanan API Turnify Flow. Membaca dan menulis basis data; tidak pernah memanggil model.

Yang ada di sini sengaja belum lengkap: ia kerangka, bukan API jadi. Yang
dikejar bukan jumlah endpoint, melainkan membuktikan satu alur tulis yang
paling menentukan berjalan utuh dan tahan diulang — sinkron dari kasir.

Alasan alur itu yang dipilih lebih dulu. Semua endpoint baca bisa ditambahkan
belakangan tanpa risiko: salah baca memberi angka salah di layar, dan bisa
diperbaiki. Salah tulis merusak buku besar, dan buku besar yang rusak tidak
bisa diperbaiki belakangan — stok tercatat dan stok sebenarnya sudah berbeda,
dan tidak ada lagi catatan yang bisa dipakai menengahi.
"""
