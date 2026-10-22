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
from target import classify_targets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("buddybook-nlp-worker")


def process_queue(client: ApiClient, analyzer: SentimentAnalyzer, use_target_rule: bool = True) -> int:
    items = client.fetch_pending_queue()
    done = 0

    for item in items:
        # ข้อความเดียวพัง (เช่นยาวผิดปกติ) ต้องไม่ทำให้ทั้งคิวค้าง — ข้ามไป รอบหน้าจะลองใหม่ ส่วนอันอื่นวิเคราะห์ต่อได้
        try:
            # character_names: ชื่อตัวละครของนิยายเรื่องนั้น (api รุ่นเก่าไม่ส่งมา = ใช้แค่คำเรียกบทบาท)
            result = analyzer.analyze(item["content"], item.get("character_names"), use_target=use_target_rule)
        except Exception:
            logger.exception("analyze failed for %s %s — skipped", item["target_type"], item["target_id"])
            continue
        targets = classify_targets(item["content"], item.get("character_names"))
        client.submit_sentiment(
            item["target_type"], item["target_id"], result.label, result.score, result.polarity, sentiment_targets=targets
        )
        done += 1
        logger.info(
            "%s %s -> %s (conf %.2f, polarity %+.2f, target %s)%s",
            item["target_type"], item["target_id"], result.label, result.score, result.polarity, "+".join(targets) or "-",
            f" [ปรับ: {result.adjusted}]" if result.adjusted else "",
        )

    # นับเฉพาะที่ส่งผลสำเร็จ — ข้อความที่วิเคราะห์ไม่ได้ค้างหัวคิวตลอด ถ้านับรวมจะวนดึงซ้ำไม่หยุด (ดู loop ใน main)
    return done


def main() -> None:
    config = load_config()
    client = ApiClient(config.api_base_url, config.internal_service_token)
    analyzer = SentimentAnalyzer(config.model_path, config.temperature)

    logger.info(
        "Loading fine-tuned WangchanBERTa model from %s (temperature %.2f, target rule %s)",
        config.model_path, config.temperature, "on" if config.use_target_rule else "off",
    )
    analyzer.load()
    logger.info("Model loaded — worker started, polling every %ss", config.poll_interval_seconds)

    while True:
        n = 0
        try:
            n = process_queue(client, analyzer, config.use_target_rule)
            if n:
                logger.info("Processed %s items", n)
        except Exception:
            logger.exception("Error during polling cycle — will retry next cycle")

        # คิวยังมีงานค้าง (รอบนี้ได้งานมา) → ดึงรอบถัดไปทันที ไม่ต้องรอ — เดิมพักทุกรอบ คิวหลายหมื่นรายการ
        # (เช่นหลัง seed:scale --no-sentiment) ใช้เวลาหลายชั่วโมงทั้งที่โมเดลว่างอยู่ พักเฉพาะตอนคิวว่างหรือ error
        if not n:
            time.sleep(config.poll_interval_seconds)


if __name__ == "__main__":
    main()
