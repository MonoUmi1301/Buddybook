# BuddyBook NLP Worker — CPU-only image (build context: apps/nlp-worker)
# The fine-tuned model is NOT baked in; it is mounted at /model (see docker-compose.yml, profile "nlp").
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# torch from the CPU wheel index (much smaller than the default CUDA build)
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src ./src

CMD ["python", "src/main.py"]
