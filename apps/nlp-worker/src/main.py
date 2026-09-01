"""
BuddyBook NLP Worker — entrypoint

รูปแบบ: poll GET /internal/nlp/pending-queue จาก Express Gateway (ไม่ต่อ PostgreSQL ตรง ๆ —
Node.js Gateway ยังเป็นจุดเดียวที่เขียน Postgres จริง ตาม BuddyBook_System_Architecture.md
ส่วนที่ 1 และเป็นจุดที่ sync sentiment_score เข้า Neo4j ด้วย — ดู apps/api/src/modules/internal)
วิเคราะห์ด้วย fine-tuned WangchanBERTa แล้วส่งผลกลับผ่าน POST /internal/nlp/sentiment-callback

รัน:
    cd apps/nlp-worker
    python -m venv .venv && source .venv/bin/activate   (Windows: .venv\\Scripts\\activate)
    pip install transformers torch pythainlp python-dotenv requests
    cp .env.example .env   # ตั้ง MODEL_PATH และ INTERNAL_SERVICE_TOKEN (ต้องตรงกับ apps/api/.env)
    python src/main.py
"""

import logging
import time

from api_client import ApiClient
from config import load_config
from sentiment import SentimentAnalyzer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("buddybook-nlp-worker")


def process_queue(client: ApiClient, analyzer: SentimentAnalyzer) -> int:
    items = client.fetch_pending_queue()

    for item in items:
        result = analyzer.analyze(item["content"])
        client.submit_sentiment(item["target_type"], item["target_id"], result.label, result.score)
        logger.info("%s %s -> %s (%.2f)", item["target_type"], item["target_id"], result.label, result.score)

    return len(items)


def main() -> None:
    config = load_config()
    client = ApiClient(config.api_base_url, config.internal_service_token)
    analyzer = SentimentAnalyzer(config.model_path)

    logger.info("Loading fine-tuned WangchanBERTa model from %s", config.model_path)
    analyzer.load()
    logger.info("Model loaded — worker started, polling every %ss", config.poll_interval_seconds)

    while True:
        try:
            n = process_queue(client, analyzer)
            if n:
                logger.info("Processed %s items", n)
        except Exception:
            logger.exception("Error during polling cycle — will retry next cycle")

        time.sleep(config.poll_interval_seconds)


if __name__ == "__main__":
    main()
