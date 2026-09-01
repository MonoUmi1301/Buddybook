"""BuddyBook NLP Worker — config loader (โหลด .env และตรวจว่ามีค่าที่จำเป็น)"""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    api_base_url: str
    internal_service_token: str
    poll_interval_seconds: int
    batch_size: int
    model_path: str


def load_config() -> Config:
    internal_service_token = os.getenv("INTERNAL_SERVICE_TOKEN")
    if not internal_service_token:
        raise RuntimeError("INTERNAL_SERVICE_TOKEN is required — ดู apps/nlp-worker/.env.example")

    model_path = os.getenv("MODEL_PATH")
    if not model_path:
        raise RuntimeError(
            "MODEL_PATH is required — ชี้ไปที่โฟลเดอร์ my_final_sentiment_model "
            "(ดู apps/nlp-worker/.env.example)"
        )

    return Config(
        api_base_url=os.getenv("API_BASE_URL", "http://localhost:4000/api/v1"),
        internal_service_token=internal_service_token,
        poll_interval_seconds=int(os.getenv("POLL_INTERVAL_SECONDS", "10")),
        batch_size=int(os.getenv("BATCH_SIZE", "20")),
        model_path=model_path,
    )
