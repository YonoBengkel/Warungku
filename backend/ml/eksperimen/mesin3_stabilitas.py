"""
Mesin 3 (profil pelanggan): penyetelan k dan gamma, stabilitas segmen, dan pembanding.

    python -m ml.eksperimen.mesin3_stabilitas
    python -m ml.eksperimen.mesin3_stabilitas --bootstrap 10   # cepat

**Kenapa stabilitas, bukan hanya siluet.** Tiap distributor hanya punya 23–70
pelanggan. Pada data sekecil itu, siluet bisa tinggi untuk pembagian yang
kebetulan: ambil 80% pelanggan yang sama, kelompokkan ulang, dan segmennya
bisa berubah total. Distributor yang membuka halaman minggu depan lalu melihat
"pelanggan andalan"-nya berpindah ke "pelanggan kecil" tanpa ada yang berubah
akan berhenti percaya pada halaman itu. Jadi yang diukur di sini:

* **siluet Gower** — satu ukuran jarak yang sama untuk semua metode, supaya
  K-Prototypes tidak dinilai dengan jaraknya sendiri sementara pembanding
  dinilai dengan jarak lain;
* **stabilitas** — rata-rata Adjusted Rand Index (ARI) antara segmen dari
  seluruh pelanggan dan segmen dari subsampel 80%, dihitung pada pelanggan yang
  sama. 1 = identik, 0 = setara acak;
* **ukuran segmen terkecil** — segmen berisi 1–2 toko tidak berguna bagi siapa pun.

**Pembanding:**

* K-Prototypes produksi (k 3–6 dipilih siluet K-Prototypes, gamma bawaan Huang);
* K-Prototypes dengan k dan gamma ditala (dipilih siluet Gower);
* jarak Gower + pengelompokan aglomeratif (average linkage);
* jarak Gower + HDBSCAN (k ditentukan sendiri; sebagian titik boleh "derau").

Tidak ada data uji di pengelompokan. Pemilihan memakai siluet, lalu
stabilitas dipakai sebagai pemeriksaan yang tidak ikut memilih — kalau pilihan
siluet ternyata tidak stabil, itu yang dilaporkan.

Hanya MEMBACA basis data. Tabel `segmen_pelanggan` tidak disentuh.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
from sklearn.cluster import HDBSCAN, AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score, silhouette_score

from ..mesin3.kprototypes import gamma_bawaan, kprototypes, siluet
from ..mesin3.segmentasi import K_DICOBA, KAT, MIN_PESANAN, NUM, muat_rfm

BENIH = 20261006
KELUARAN = Path(__file__).resolve().parents[2] / "keluaran"
K_TALA = (3, 4, 5, 6)                      # sama dengan produksi: k=2 tidak berguna sebagai segmen
GAMMA_KALI = (0.25, 0.5, 1.0, 2.0, 4.0)    # kelipatan gamma bawaan Huang
HDBSCAN_MIN = (3, 5, 8)


# --------------------------------------------------------------------------
def gower(X_num_mentah: np.ndarray, X_kat: np.ndarray) -> np.ndarray:
    """Jarak Gower: angka |selisih|/rentang, kategori 0/1, dirata-rata per fitur."""
    rentang = X_num_mentah.max(axis=0) - X_num_mentah.min(axis=0)
    rentang[rentang < 1e-12] = 1.0
    d_num = np.abs(X_num_mentah[:, None, :] - X_num_mentah[None, :, :]) / rentang
    d_kat = (X_kat[:, None, :] != X_kat[None, :, :]).astype(float)
    p = X_num_mentah.shape[1] + X_kat.shape[1]
    return (d_num.sum(axis=2) + d_kat.sum(axis=2)) / p


def siluet_gower(D: np.ndarray, label: np.ndarray) -> float:
    """Siluet dengan jarak Gower; titik derau (-1) tidak ikut dinilai."""
    m = label >= 0
    if len(np.unique(label[m])) < 2 or m.sum() <= len(np.unique(label[m])):
        return float("nan")
    return float(silhouette_score(D[np.ix_(m, m)], label[m], metric="precomputed"))


def ukuran_terkecil(label: np.ndarray) -> int:
    _, n = np.unique(label[label >= 0], return_counts=True)
    return int(n.min()) if len(n) else 0


def eta_kuadrat(x: np.ndarray, label: np.ndarray) -> float:
    """Porsi ragam satu peubah angka yang dijelaskan oleh segmen (0..1)."""
    m = label >= 0
    x, label = x[m], label[m]
    total = ((x - x.mean()) ** 2).sum()
    if total <= 0:
        return 0.0
    antar = sum(((label == c).sum()) * (x[label == c].mean() - x.mean()) ** 2 for c in np.unique(label))
    return float(antar / total)


# --------------------------------------------------------------------------
# Satu "metode" = fungsi (indeks baris) -> label, dengan konfigurasi tetap
# --------------------------------------------------------------------------
class Data:
    def __init__(self, df):
        self.n = len(df)
        self.X_mentah = df[list(NUM)].to_numpy(dtype=float)
        rata, sd = self.X_mentah.mean(axis=0), self.X_mentah.std(axis=0)
        sd[sd < 1e-9] = 1.0
        self.X_num = (self.X_mentah - rata) / sd
        self.X_kat = df[list(KAT)].to_numpy(dtype=object)
        self.D = gower(self.X_mentah, self.X_kat)
        self.g0 = gamma_bawaan(self.X_num)

    def kp(self, idx, k, gamma_kali, log=False):
        # Dibakukan ulang di subsampel, persis seperti produksi membakukan
        # data yang ia terima.
        Xm = self.X_mentah[idx]
        if log:
            # frequency dan monetary sangat menceng: satu pelanggan besar bisa
            # menjadi segmen sendirian. log1p meredam itu sebelum pembakuan.
            Xm = Xm.copy()
            Xm[:, 1:3] = np.log1p(Xm[:, 1:3])
        rata, sd = Xm.mean(axis=0), Xm.std(axis=0)
        sd[sd < 1e-9] = 1.0
        Xn = (Xm - rata) / sd
        g = gamma_bawaan(Xn) * gamma_kali
        return kprototypes(Xn, self.X_kat[idx], k, gamma=g, benih=BENIH).label, Xn, g

    def aglo(self, idx, k):
        D = self.D[np.ix_(idx, idx)]
        return AgglomerativeClustering(n_clusters=k, metric="precomputed", linkage="average").fit_predict(D)

    def hdb(self, idx, m):
        D = self.D[np.ix_(idx, idx)]
        return HDBSCAN(min_cluster_size=m, metric="precomputed", copy=True).fit_predict(D)


def stabilitas(fungsi, subsampel: list[np.ndarray], label_penuh: np.ndarray) -> dict:
    """
    ARI antara label penuh dan label subsampel 80% pada titik yang sama.

    Semua metode dinilai dengan himpunan subsampel yang SAMA (perbandingan
    berpasangan). Versi pertama mengambil subsampel baru per metode, dan dua
    konfigurasi yang labelnya identik keluar dengan stabilitas berbeda hingga
    0,03 — lebih besar daripada sebagian selisih yang hendak dibandingkan.
    """
    ari = []
    for idx in subsampel:
        try:
            lab = fungsi(idx)
        except ValueError:
            continue
        ari.append(adjusted_rand_score(label_penuh[idx], lab))
    a = np.asarray(ari)
    return {"ari_rata": float(a.mean()) if len(a) else float("nan"),
            "ari_p10": float(np.percentile(a, 10)) if len(a) else float("nan"),
            "B": int(len(a))}


def evaluasi_distributor(df, B: int) -> dict:
    d = Data(df)
    semua = np.arange(d.n)
    acak = np.random.default_rng(BENIH)
    ukuran = max(4, int(round(0.8 * d.n)))
    subsampel = [np.sort(acak.choice(d.n, size=ukuran, replace=False)) for _ in range(B)]
    keluar: dict = {"pelanggan": d.n}

    # --- K-Prototypes: seluruh kisi k x gamma ---------------------------------
    kisi = []
    for gk in GAMMA_KALI:
        for k in K_TALA:
            if d.n < 2 * k:
                continue
            for lg in (False, True):
                lab, Xn, g = d.kp(semua, k, gk, log=lg)
                kisi.append({
                "k": k, "gamma_kali": gk, "log": lg, "gamma": round(g, 4),
                "siluet_kp": round(siluet(Xn, d.X_kat, lab, g), 4),
                "siluet_gower": round(siluet_gower(d.D, lab), 4),
                "terkecil": ukuran_terkecil(lab),
                "_label": lab,
                })

    # Produksi: gamma bawaan, k dipilih siluet K-Prototypes dari K_DICOBA.
    prod = max((r for r in kisi if r["gamma_kali"] == 1.0 and not r["log"] and r["k"] in K_DICOBA),
               key=lambda r: r["siluet_kp"])
    # Usulan perbaikan produksi: sama persis, tapi k yang menghasilkan segmen
    # berisi kurang dari 3 toko tidak boleh dipilih.
    prod_min3_kandidat = [r for r in kisi if r["gamma_kali"] == 1.0 and not r["log"] and r["k"] in K_DICOBA and r["terkecil"] >= 3]
    # Varian log: sama dengan produksi (gamma bawaan, k dipilih siluet KP), F dan M di-log1p.
    prod_log = max((r for r in kisi if r["gamma_kali"] == 1.0 and r["log"] and r["k"] in K_DICOBA),
                   key=lambda r: r["siluet_kp"])
    prod_min3 = max(prod_min3_kandidat, key=lambda r: r["siluet_kp"]) if prod_min3_kandidat else prod
    # Varian kategori langka: kategori yang dimiliki < 3 toko digabung jadi
    # "lainnya". Ini menguji DUGAAN bahwa segmen 1 toko lahir dari kategori
    # unik. Dugaan itu SALAH: di ketiga distributor tidak ada kategori langka,
    # labelnya identik dengan produksi. Segmen 1 toko ternyata pencilan angka
    # (frekuensi dan belanja jauh di bawah median, atau recency tertinggi) --
    # sering justru pelanggan yang paling perlu ditindaklanjuti. Varian ini
    # dibiarkan sebagai hasil negatif yang tercatat.
    df2 = df.copy()
    for c in KAT:
        hitung = df2[c].value_counts()
        df2[c] = df2[c].where(df2[c].map(hitung) >= 3, "lainnya")
    d2 = Data(df2)
    langka = {}
    for lg in (False, True):
        cand = []
        for k in K_DICOBA:
            if d2.n < 2 * k:
                continue
            lab, Xn, g = d2.kp(semua, k, 1.0, log=lg)
            cand.append({"k": k, "gamma_kali": 1.0, "log": lg, "kategori_langka_digabung": True,
                         "gamma": round(g, 4),
                         "siluet_kp": round(siluet(Xn, d2.X_kat, lab, g), 4),
                         "siluet_gower": round(siluet_gower(d.D, lab), 4),
                         "terkecil": ukuran_terkecil(lab), "_label": lab})
        langka[lg] = max(cand, key=lambda r: r["siluet_kp"])

    # Ditala: dipilih siluet Gower, dengan syarat segmen terkecil >= 3 toko.
    layak =[r for r in kisi if r["terkecil"] >= 3 and not r["log"]] or kisi
    tala = max(layak, key=lambda r: r["siluet_gower"])

    # --- Aglomeratif Gower ----------------------------------------------------
    aglo = []
    for k in K_TALA:
        if d.n < 2 * k:
            continue
        lab = d.aglo(semua, k)
        aglo.append({"k": k, "siluet_gower": round(siluet_gower(d.D, lab), 4),
                     "terkecil": ukuran_terkecil(lab), "_label": lab})
    aglo_layak = [r for r in aglo if r["terkecil"] >= 3] or aglo
    aglo_pilih = max(aglo_layak, key=lambda r: r["siluet_gower"])

    # --- HDBSCAN Gower --------------------------------------------------------
    hdb = []
    for m in HDBSCAN_MIN:
        lab = d.hdb(semua, m)
        k = len(np.unique(lab[lab >= 0]))
        hdb.append({"min_cluster_size": m, "k": k, "derau": round(float((lab < 0).mean()), 4),
                    "siluet_gower": round(siluet_gower(d.D, lab), 4) if k >= 2 else None,
                    "terkecil": ukuran_terkecil(lab), "_label": lab})
    hdb_valid = [r for r in hdb if r["k"] >= 2] or hdb
    hdb_pilih = max(hdb_valid, key=lambda r: (r["siluet_gower"] if r["siluet_gower"] is not None else -9))

    # --- Stabilitas untuk empat pilihan ----------------------------------------
    # Dua pemeriksaan tambahan yang tidak ikut memilih:
    # * siluet dengan jarak K-Prototypes (gamma bawaan) untuk SEMUA metode, supaya
    #   tidak ada metode yang hanya menang karena dinilai dengan jaraknya sendiri;
    # * apa yang sebenarnya dipisahkan segmen: perilaku belanja (eta^2 RFM) atau
    #   sekadar jenis usaha / kategori (ARI terhadap label kategori itu).
    jenis = np.unique(d.X_kat[:, 0], return_inverse=True)[1]
    kateg = np.unique(d.X_kat[:, 1], return_inverse=True)[1]

    def ringkas(r, nama, fungsi):
        lab = r["_label"]
        s = stabilitas(fungsi, subsampel, lab)
        m = lab >= 0
        sil_kp = (siluet(d.X_num[m], d.X_kat[m], lab[m], d.g0)
                  if len(np.unique(lab[m])) >= 2 else float("nan"))
        return {
            "metode": nama, **{kk: vv for kk, vv in r.items() if not kk.startswith("_")}, **s,
            "siluet_kp_bawaan": round(float(sil_kp), 4),
            "eta2": {c: round(eta_kuadrat(d.X_num[:, i], lab), 3) for i, c in enumerate(NUM)},
            "ari_jenis_usaha": round(float(adjusted_rand_score(jenis[m], lab[m])), 3),
            "ari_kategori_utama": round(float(adjusted_rand_score(kateg[m], lab[m])), 3),
        }

    keluar["pilihan"] = [
        ringkas(prod, "kprototypes_produksi", lambda idx, r=prod: d.kp(idx, r["k"], 1.0)[0]),
        ringkas(prod_min3, "kprototypes_min3", lambda idx, r=prod_min3: d.kp(idx, r["k"], 1.0)[0]),
        ringkas(prod_log, "kprototypes_log", lambda idx, r=prod_log: d.kp(idx, r["k"], 1.0, log=True)[0]),
        ringkas(langka[False], "kprototypes_langka",
                lambda idx, r=langka[False]: d2.kp(idx, r["k"], 1.0)[0]),
        ringkas(langka[True], "kprototypes_log_langka",
                lambda idx, r=langka[True]: d2.kp(idx, r["k"], 1.0, log=True)[0]),
        ringkas(tala, "kprototypes_ditala", lambda idx, r=tala: d.kp(idx, r["k"], r["gamma_kali"])[0]),
        ringkas(aglo_pilih, "gower_aglomeratif", lambda idx, r=aglo_pilih: d.aglo(idx, r["k"])),
        ringkas(hdb_pilih, "gower_hdbscan", lambda idx, r=hdb_pilih: d.hdb(idx, r["min_cluster_size"])),
    ]
    keluar["kisi_kprototypes"] = [{kk: vv for kk, vv in r.items() if not kk.startswith("_")} for r in kisi]
    keluar["kisi_aglomeratif"] = [{kk: vv for kk, vv in r.items() if not kk.startswith("_")} for r in aglo]
    keluar["kisi_hdbscan"] = [{kk: vv for kk, vv in r.items() if not kk.startswith("_")} for r in hdb]
    return keluar


def main() -> None:
    p = argparse.ArgumentParser(description="Stabilitas dan penyetelan Mesin 3 (percobaan).")
    p.add_argument("--bootstrap", type=int, default=50)
    arg = p.parse_args()

    mulai = time.perf_counter()
    df = muat_rfm()
    per = {}
    for did, g in df.groupby("distributor_id", sort=True):
        g = g[g["frequency"] >= MIN_PESANAN]
        if len(g) < 8:
            per[int(did)] = {"pelanggan": len(g), "alasan": "terlalu sedikit"}
            continue
        per[int(did)] = evaluasi_distributor(g.reset_index(drop=True), arg.bootstrap)
        print("distributor %d (%d pelanggan)" % (did, len(g)), flush=True)
        for r in per[int(did)]["pilihan"]:
            e = r["eta2"]
            print("  %-22s k=%-2s sil Gower %5.3f KP %5.3f | ARI %5.3f | min %2d | eta2 R %.2f F %.2f M %.2f | ARI jenis %.2f kat %.2f%s"
                  % (r["metode"], r.get("k"), r["siluet_gower"] or float("nan"), r["siluet_kp_bawaan"],
                     r["ari_rata"], r["terkecil"], e["recency"], e["frequency"], e["monetary"],
                     r["ari_jenis_usaha"], r["ari_kategori_utama"],
                     (" | derau %.0f%%" % (100 * r["derau"])) if "derau" in r else ""), flush=True)

    # Rata-rata antar distributor, ditimbang sama.
    agregat = {}
    for nama in ("kprototypes_produksi", "kprototypes_min3", "kprototypes_log", "kprototypes_langka", "kprototypes_log_langka", "kprototypes_ditala", "gower_aglomeratif", "gower_hdbscan"):
        rs = [r for v in per.values() for r in v.get("pilihan", []) if r["metode"] == nama]
        sil = [r["siluet_gower"] for r in rs if r["siluet_gower"] is not None and r["siluet_gower"] == r["siluet_gower"]]
        agregat[nama] = {
            "distributor": len(rs),
            "siluet_gower_rata": float(np.mean(sil)) if sil else None,
            "ari_rata": float(np.nanmean([r["ari_rata"] for r in rs])),
            "ari_terendah": float(np.nanmin([r["ari_rata"] for r in rs])),
            "terkecil_min": int(min(r["terkecil"] for r in rs)),
            "distributor_segmen_1_toko": int(sum(r["terkecil"] <= 1 for r in rs)),
            "derau_rata": float(np.mean([r.get("derau", 0.0) for r in rs])),
            "siluet_kp_rata": float(np.nanmean([r["siluet_kp_bawaan"] for r in rs])),
            "eta2_rata": {c: float(np.mean([r["eta2"][c] for r in rs])) for c in NUM},
            "ari_jenis_usaha_rata": float(np.mean([r["ari_jenis_usaha"] for r in rs])),
            "ari_kategori_utama_rata": float(np.mean([r["ari_kategori_utama"] for r in rs])),
        }

    print("--- agregat (rata-rata 8 distributor) ---")
    for nama, a in agregat.items():
        e = a["eta2_rata"]
        print("  %-22s sil Gower %.3f KP %.3f | ARI %.3f (terendah %.3f) | min %d (%d distr. segmen 1 toko) | "
              "eta2 R %.2f F %.2f M %.2f L %.2f | ARI jenis %.2f kat %.2f | derau %.0f%%"
              % (nama, a["siluet_gower_rata"] or float("nan"), a["siluet_kp_rata"], a["ari_rata"], a["ari_terendah"],
                 a["terkecil_min"], a["distributor_segmen_1_toko"], e["recency"], e["frequency"], e["monetary"],
                 e["lama_berlangganan"], a["ari_jenis_usaha_rata"], a["ari_kategori_utama_rata"],
                 100 * a["derau_rata"]))

    berkas = KELUARAN / "hasil_eksperimen_mesin3.json"
    with open(berkas, "w", encoding="utf-8") as f:
        json.dump({"bootstrap": arg.bootstrap, "subsampel": 0.8, "benih": BENIH,
                   "tanggal_acuan": str(df.attrs.get("tanggal_acuan")),
                   "detik": time.perf_counter() - mulai,
                   "agregat": agregat, "per_distributor": per},
                  f, indent=1, ensure_ascii=False, default=str)
    print("JSON: %s (%.0f d)" % (berkas, time.perf_counter() - mulai))


if __name__ == "__main__":
    main()
