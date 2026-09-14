# Warungku — Portal Pemilik Usaha

Purwarupa antarmuka untuk platform **stok gudang + perkiraan kebutuhan + pengadaan ke distributor** bagi UMKM, warung, kafe, dan resto di Indonesia.

Yang dibangun di repositori ini adalah **interface untuk peran Pemilik Usaha**. Dua peran lain (Distributor dan Admin platform) belum dibangun.

---

## Menjalankan

```bash
npm install
```

```bash
npm run dev
```

Buka `http://localhost:5173`. Aplikasi langsung masuk ke Beranda dengan data contoh.

```bash
npm run build
```

---

## Ruang lingkup yang sudah diputuskan

Keputusan berikut sudah final dan tercermin di seluruh antarmuka:

| Keputusan | Konsekuensi di UI |
| --- | --- |
| Aplikasi kasir (POS) **tidak dibangun**, memakai pihak ketiga lewat API | Ada modul "Data dari Kasir" sebagai jembatan; stok berkurang dari data kasir, bukan dari kasir internal |
| Model perkiraan berjalan sebagai **microservice terpisah** | Kartu Perkiraan punya tiga tingkat turun derajat saat layanan tidak sehat, dan kegagalannya diisolasi di tingkat kartu |
| Resep / BOM bersifat **opsional** | Pertanyaan "Apa yang kamu jual?" menentukan bentuk bawaan form, bukan mengunci akun |
| Pembayaran **dicatat di luar aplikasi** (Premium bisa diotomasikan) | Blok Pembayaran di detail pesanan berlabel "Dicatat di luar aplikasi" dan tidak pernah menonaktifkan tombol apa pun |
| **Harga jual dikelola di aplikasi kasir**, bukan di sini | Tidak ada kolom harga jual, tidak ada kartu omzet/untung/margin di Beranda |
| **Satu kontrak mengikat tepat satu barang** | Kontrak dikelompokkan per barang, dengan sakelar tampilan per pemasok |

---

## Struktur navigasi

Empat tab datar, ditambah tiga ikon tetap di kepala halaman.

```
Beranda    "Hari ini saya harus ngapain?"
Stok       "Sisa gula saya berapa?"
Belanja    "Siapa yang jual gula, berapa?"
Pesanan    "Pesanan saya sudah dikirim belum?"

[kepala]   Pemberitahuan · Keranjang · Akun
```

Alur intinya tertutup rapat:

```
perkiraan -> pemberitahuan -> Lembar Pesan Cepat -> Keranjang
          -> Pesanan -> Terima Barang -> stok naik -> kuota kontrak naik
```

Daftar 51 rute lengkap ada di [`src/App.tsx`](src/App.tsx) dan di Lampiran A dokumen improvement.

---

## Peta berkas

```
docs/
  IMPROVEMENT-Interface-Pemilik-Usaha.md   Spesifikasi UI yang mengikat
Riwayat Chat/
  Chat#1.md                                Transkrip perumusan awal
src/
  App.tsx                                  Peta rute
  index.css                                Token desain (warna, radius, bayangan, animasi)
  layouts/KerangkaAplikasi.tsx             Bottom nav mobile / side nav desktop + kepala global
  lib/
    types.ts                               Model domain
    label.ts                               Kamus label tunggal untuk seluruh layar
    format.ts                              Format rupiah, angka, tanggal, waktu relatif
  data/dummy.ts                            Data contoh + fungsi turunan
  store/aplikasi.ts                        Keadaan aplikasi (zustand)
  components/
    ui/                                    Komponen dasar: tombol, kartu, formulir, lembar
    domain/                                Komponen khas produk: Kuota Bulan Ini, Kartu Perkiraan, dll
    grafik/                                Grafik SVG buatan sendiri
  icons/                                   Ikon garis buatan sendiri
  pages/                                   Satu berkas per layar
```

---

## Catatan teknis

**Grafik digambar sendiri, tanpa pustaka.** Alasannya bukan penghematan bundel semata: kontrol penuh atas ketebalan garis, ukuran teks, dan perilaku sentuh lebih penting untuk perangkat Android kelas menengah, dan palet warnanya perlu lolos pemeriksaan buta warna yang sama dengan sisa aplikasi.

**Warna grafik divalidasi terpisah dari warna status.** Slot seri (`--c-seri-1..3`) lolos ambang pemisahan buta warna pada semua pasangan, lantai kroma, dan kontras minimal 3:1 terhadap permukaan, di mode terang maupun gelap. Warna status (aman / menipis / habis) tidak pernah dipakai sebagai warna seri.

**Status tidak pernah hanya warna.** Setiap status membawa ikon, teks, dan warna sekaligus.

**Stok hanya bertambah di satu tempat:** layar "Terima Barang". Tidak ada penambahan otomatis saat pesanan dibuat atau dikirim, karena gudang hanya boleh mencatat barang yang benar-benar sudah dihitung di tempat.

**Mode gelap adalah pilihan tersendiri**, bukan pembalikan otomatis dari mode terang. Langkah warnanya dipilih ulang untuk permukaan gelap lalu divalidasi sebagai satu set.

---

## Menguji keadaan yang jarang muncul

Buka **Akun** dan gulir ke bawah. Di sana ada alat uji untuk:

- berpindah tema terang/gelap;
- memaksa layanan perkiraan ke keadaan **sehat**, **tersimpan**, atau **mati**, supaya tiga tingkat turun derajat Kartu Perkiraan bisa dilihat.

Status verifikasi akun (terverifikasi / sedang diperiksa / perlu diperbaiki) bisa diubah dari **Akun → Data Usaha & Legalitas**, untuk melihat mode Jelajah Terbatas.

---

## Pertanyaan yang masih menunggu keputusan pemilik proyek

Bagian 9 dokumen improvement memuat sepuluh pertanyaan yang jawabannya mengubah perilaku sistem, bukan sekadar tampilan. Yang paling mendesak:

1. Kalau kuota kontrak tidak terpenuhi, sistem **memblokir** atau hanya **memperingatkan**? Antarmukanya sudah dibuat netral sehingga aman untuk kedua jawaban, tapi kolom "Kalau kuota tidak terpenuhi" harus diisi seseorang — distributor atau admin.
2. Apakah pesanan boleh dibuat **tanpa kontrak** ("Beli Sekali")? Ini menentukan apakah model data menerima `kontrakId` kosong.
3. Berapa hari data minimum sebelum perkiraan ditampilkan? Dokumen ini memakai **14 hari** dan angka itu tercetak di layar.
4. Apakah microservice perkiraan bisa mengeluarkan **rentang**, atau hanya satu titik? Kalau hanya titik, rentang tidak boleh dikarang di frontend.
