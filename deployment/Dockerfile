# Image backend Turnify Flow: satu image untuk dua layanan.
#
#   API utama      (bawaan)  uvicorn api.utama:app   --port 8000
#   Layanan model            uvicorn ml.layanan:app  --port 8001
#
# Build dari AKAR repo (konteksnya akar, bukan folder deployment/):
#   docker build -f deployment/Dockerfile -t turnify-flow-backend:0.1.0 .
#
# Tidak ada rahasia di dalam image. WARUNGKU_DB, WARUNGKU_RAHASIA, dan
# WARUNGKU_ML diberikan saat kontainer dijalankan (`-e` atau docker compose).
# `.dockerignore` di akar menjaga .env dan data berlisensi tetap di luar.

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Jakarta

WORKDIR /app

# Dependensi dulu, kode belakangan: mengubah kode tidak memicu pemasangan ulang.
COPY requirements-produksi.txt .
RUN pip install --no-cache-dir -r requirements-produksi.txt

COPY pyproject.toml ./
COPY backend/warungku ./backend/warungku
COPY backend/api ./backend/api
COPY ml ./ml
COPY data/dataset ./data/dataset
RUN pip install --no-cache-dir --no-deps .

# Jangan jalan sebagai root.
RUN useradd --create-home --uid 10001 turnify
USER turnify

EXPOSE 8000 8001
CMD ["uvicorn", "api.utama:app", "--host", "0.0.0.0", "--port", "8000"]
