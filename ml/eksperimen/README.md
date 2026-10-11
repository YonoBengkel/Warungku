# Percobaan penyetelan Mesin 2 dan Mesin 3

Folder ini berisi percobaan, bukan kode produksi. Semua berkas di sini hanya
mengimpor `ml.mesin2` dan `ml.mesin3`, tidak mengubahnya. Pengaturan yang
terbukti lebih baik dibawa ke modul produksi lewat commit tersendiri setelah
disetujui.

| Berkas | Isi |
| --- | --- |
| `mesin2_penyetelan.py` | Ulangan banyak benih, prior Beta, peluruhan, dan lapis harga (fuzzy vs garis lurus) |
| `mesin3_stabilitas.py` | Stabilitas segmen, varian K-Prototypes, dan pembanding berbasis jarak Gower |
| `grafik_eksperimen.py` | Grafik untuk laporan, ditulis ke `docs/laporan/gambar/eksperimen_*.png` |

```bash
python -m ml.eksperimen.mesin2_penyetelan
```

```bash
python -m ml.eksperimen.mesin3_stabilitas
```

```bash
python -m ml.eksperimen.grafik_eksperimen
```

Ketiganya hanya membaca basis data `warungku_dev`. Hasil ditulis ke
`ml/hasil/hasil_eksperimen_mesin2_*.json` dan `ml/hasil/hasil_eksperimen_mesin3.json`.

## Aturan pemilihan

- **Mesin 2.** Rentang simulasi dibelah dua menurut tanggal (P1 sebelum
  2026-03-20, P2 sesudahnya). Pengaturan dipilih di P1 dan dilaporkan di P2.
  Kebijakan yang mengandung cuplikan acak (Thompson, epsilon-greedy) diulang
  dengan beberapa benih. Kebijakan deterministik (greedy, LinUCB, TOPSIS)
  memberi angka yang sama di semua benih, karena penaksir Beta-Bernoulli tidak
  memakai fitur ulasan yang ikut diacak.
- **Mesin 3.** Pengelompokan tidak punya data uji. Pilihan k memakai siluet,
  lalu tiga ukuran yang tidak ikut memilih dipakai sebagai pemeriksaan:
  - stabilitas: ARI antara segmen seluruh pelanggan dan segmen dari subsampel
    80%, dengan himpunan subsampel yang SAMA untuk semua metode;
  - eta kuadrat: porsi ragam recency, frequency, monetary, dan lama
    berlangganan yang dijelaskan segmen;
  - ARI terhadap jenis usaha: seberapa mirip segmen dengan sekadar
    mengelompokkan menurut jenis usaha.

## Hasil Mesin 2 (12 Okt 2026)

Simulasi regret berurutan, 9.328 keputusan, penaksir Beta-Bernoulli daring.

**Ulangan, 10 benih (regret total, rata-rata ± simpangan baku):**

| Kebijakan | Regret | Rasio harga |
| --- | --- | --- |
| greedy | 1.383 (deterministik) | 1,051 |
| LinUCB α=1 | 1.383 (deterministik) | 1,051 |
| Thompson | 1.414 ± 10 | 1,054 |
| epsilon-greedy 0,1 | 1.442 ± 16 | 1,052 |
| Thompson + fuzzy (produksi) | 1.465 ± 26 | 1,044 |
| greedy + fuzzy | 1.550 (deterministik) | 1,043 |
| TOPSIS | 1.551 (deterministik) | 1,033 |

- Selisih greedy dan Thompson (31) di luar derau: selang 95% Thompson 1.407–1.422.
- Angka produksi di laporan (1.498) berasal dari satu benih yang kurang
  beruntung. Rata-rata 10 benih adalah 1.465.

**Prior Beta (5 benih, regret paruh kedua):** pengaturan terbaik di paruh
pertama adalah s=20, m=0,5, dengan regret paruh kedua 683,8 ± 3,8, dibanding
695,2 ± 8,7 untuk Beta(1, 1) bawaan dan 683 untuk greedy. Prior yang kuat
mengurangi eksplorasi, sehingga Thompson berperilaku seperti greedy. Belum
diusulkan untuk produksi: prior kuat juga membuat distributor baru jarang
dicoba, dan simulasi sekarang tidak punya distributor yang masuk belakangan.

**Peluruhan (5 benih, regret paruh kedua):** makin cepat lupa, makin buruk
(γ 1: 695; 0,9995: 708; 0,999: 717; 0,998: 738; 0,995: 751). Ini sesuai
dugaan, karena mutu distributor di simulasi tidak pernah berubah. Pertanyaan
ini baru bisa dijawab setelah dataset memuat perubahan mutu.

**Lapis harga (5 benih, paruh kedua):** fuzzy dibandingkan dengan garis lurus
skor − λ·(rasio − 1), pada rasio harga yang sama (diinterpolasi):

| Fuzzy | Rasio harga | Regret fuzzy | Regret garis lurus | Selisih |
| --- | --- | --- | --- | --- |
| c=0,5 | 1,051 | 707,6 | 695,9 | +11,7 |
| c=1 (produksi) | 1,046 | 713,6 | 717,3 | −3,7 |
| c=1,5 | 1,031 | 795,0 | 818,2 | −23,2 |
| c=3 | 1,028 | 822,4 | 832,4 | −10,0 |

Semua selisih berada di dalam satu simpangan baku (20–41). Fuzzy tidak lebih
akurat daripada garis lurus; nilainya ada pada aturan yang bisa dibaca seperti
kalimat. Pengaturan produksi c=1 berada di titik tekuk: naik ke c=1,5 membuat
harga pesanan 1,5% lebih murah dengan regret naik 81.

## Hasil Mesin 3 (12 Okt 2026, 100 subsampel)

| Metode | Stabilitas | Terendah | eta² recency | ARI jenis usaha |
| --- | --- | --- | --- | --- |
| K-Prototypes produksi | 0,876 | 0,706 | 0,60 | 0,35 |
| K-Prototypes + log1p F, M | **0,913** | **0,862** | 0,66 | 0,35 |
| K-Prototypes, gamma ditala (siluet Gower) | 0,752 | 0,578 | 0,64 | 0,67 |
| Gower + aglomeratif | 0,977 | 0,824 | 0,28 | 0,92 |
| Gower + HDBSCAN | 0,887 | 0,584 | 0,29 | 0,94 |

- **Pembanding Gower ditolak.** Stabilitasnya tertinggi karena segmennya hampir
  sama dengan jenis usaha (ARI 0,92). Hasil seperti itu bisa didapat dengan
  `GROUP BY jenis_usaha` dan tidak membedakan pelanggan yang mulai menjauh.
- **Gamma ditala ditolak.** Memilih dengan siluet Gower mendorong segmen ke
  jenis usaha dan menurunkan stabilitas.
- **log1p pada frequency dan monetary diusulkan.** Lebih stabil di 6 dari 8
  distributor, sedikit kurang stabil di distributor 1 dan 6.
- **Segmen berisi satu toko** (distributor 2, 3, 7) adalah pencilan angka:
  frekuensi dan belanja jauh di bawah median, atau 64 hari tidak memesan.
  Menggabungkan kategori langka dan mensyaratkan segmen minimal tiga toko tidak
  mengubah apa pun. Segmen seperti itu sebaiknya ditampilkan sebagai pelanggan
  yang perlu ditindaklanjuti, bukan dipaksa hilang.
