# Menyiapkan Turnify Flow untuk pameran

Langkah membuka aplikasi untuk pengunjung lewat QR di banner: frontend di Vercel, API dan basis data di satu device tim.

```
QR di banner -> frontend di Vercel -> Cloudflare Tunnel -> API dan basis data di device tim
```

QR hanya memuat alamat Vercel, `https://turnify-flow.vercel.app`, jadi device dan alamat tunnel boleh berganti tanpa mencetak ulang banner. Kalau device mati, halaman tetap terbuka dengan data contoh dan pita penandanya.

Proyek Vercel-nya `turnify-flow` di akun `yonobengkel`, dan tidak terhubung ke GitHub, supaya push tidak mengubah situs saat pameran. Perubahan frontend baru terbit dengan `vercel deploy --prod` dari folder `frontend`. `VITE_API_URL` berisi `https://api.invalid` selama backend belum tersambung, karena nilai bawaan `localhost` bisa memunculkan permintaan izin jaringan lokal di peramban pengunjung.

## Siapa bisa apa

| Yang masuk | Kata sandi | Hasilnya |
|---|---|---|
| Pengunjung, lewat tombol akun simulasi | Kata sandi publik di tombol halaman Masuk | Semua tombol boleh ditekan, tetapi tidak ada yang tersimpan |
| Tim di booth, akun simulasi yang sama | `WARUNGKU_SANDI_BOOTH` | Bisa mengubah data, untuk presentasi |
| Pengunjung yang mendaftar | Buatan sendiri | Akun sungguhan dengan usahanya sendiri |

Tim di booth mengetik email akun simulasi dan kata sandi booth di halaman Masuk, tanpa menekan tombol isi otomatis. Kata sandi booth dibagikan lewat obrolan tim, tidak pernah ditulis di repo.

## Menyalakan di device

Butuh Docker Desktop, dan device yang dicolok listrik dengan mode tidur dimatikan.

1. Jalankan `siapkan.cmd`, yang memasang data dan membuat `deployment\.env`.
2. Tambahkan dua baris ke `deployment\.env`:

   ```
   WARUNGKU_SANDI_BOOTH=<kata sandi panjang buatan tim>
   WARUNGKU_ASAL_TAMBAHAN=https://turnify-flow.vercel.app
   ```

3. Nyalakan API dan tunnel:

   ```bash
   docker compose -f deployment/docker-compose.yml --profile layanan --profile pameran up -d
   ```

4. Ambil alamat tunnel, yang berakhiran `trycloudflare.com`:

   ```bash
   docker logs turnify-tunnel
   ```

5. Di Vercel, buka proyeknya, Settings, Environment Variables. Isi `VITE_API_URL` dengan alamat itu, lalu Deployments, Redeploy.
6. Supaya QR simulasi Portal POS bisa dibuka HP dari jaringan apa pun, isi `WARUNGKU_ALAMAT_QR` di `deployment\.env` dengan alamat yang sama, lalu nyalakan ulang API:

   ```bash
   docker compose -f deployment/docker-compose.yml --profile layanan up -d api
   ```

7. Periksa dari HP dengan data seluler, bukan Wi-Fi yang sama: buka alamat Vercel, tekan akun simulasi Kopi Kita, lalu pastikan Beranda tampil tanpa pita data contoh.

## Kalau tunnel atau device berganti

Alamat tunnel berganti tiap kontainer `turnify-tunnel` dinyalakan ulang, termasuk sesudah device mati. Selama alamat baru belum terpasang, pengunjung melihat data contoh.

Ulangi langkah 3 sampai 6. Di device baru, mulai dari langkah 1, dan pakai kata sandi booth yang sama. Halaman yang sudah terbuka perlu dimuat ulang sesudah Redeploy.

Satu kata sandi booth dan satu alamat Vercel berlaku untuk semua device. Banner tidak pernah perlu diubah.

## Sebelum hari pameran

- Pindai QR hasil cetak dari jarak baca sungguhan, dengan beberapa HP.
- Coba tunnel di jaringan tempat pameran. Kalau Wi-Fi-nya menolak, pakai hotspot HP.
- Nyalakan device beberapa menit sebelum acara, dan cek `https://<alamat tunnel>/sehat`.

## Sesudah pameran

Akun pengunjung menyimpan nomor HP dan email yang mereka isi, walaupun layar sudah meminta data karangan. Hapus dengan membuang seluruh basis data di device itu, lalu pasang ulang lewat `siapkan.cmd` kalau masih dibutuhkan:

```bash
docker compose -f deployment/docker-compose.yml --profile layanan --profile pameran down -v
```

Kosongkan juga `WARUNGKU_SANDI_BOOTH` di `deployment\.env`, supaya akun simulasi kembali bisa menulis di pemakaian lokal.

## Keterbatasan

- Quick tunnel Cloudflare ditujukan untuk pemakaian sementara. Alamat tetap butuh domain sendiri di Cloudflare.
- Layar tidak berpura-pura berhasil pada akun simulasi. Simpan terakhir menjawab bahwa perubahan tidak disimpan.
- Pesanan dari akun pendaftar masuk ke distributor simulasi, dan hanya tim di booth yang bisa menjawabnya.
- Batas percobaan masuk dan daftar disimpan di memori API, jadi kembali kosong kalau API dinyalakan ulang.
