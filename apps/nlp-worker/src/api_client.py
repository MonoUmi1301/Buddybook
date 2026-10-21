"""
BuddyBook NLP Worker — Express Gateway API client

แทนที่การต่อ PostgreSQL ตรง ๆ (db.py เดิม) ด้วย HTTP call ไปยัง /internal/nlp/* บน
Express Gateway — ทำให้ Node.js Gateway ยังเป็นจุดเดียวที่เขียน Postgres จริง ตาม
BuddyBook_System_Architecture.md ส่วนที่ 1 (และเปิดทางให้ Gateway sync sentiment_score
เข้า Neo4j ทันทีที่รู้ผล — ดู apps/api/src/modules/internal/internal.service.ts)
"""

from typing import Literal, TypedDict

import requests


class PendingItem(TypedDict, total=False):
    target_type: Literal["comment", "review"]
    target_id: str
    content: str
    character_names: list[str]  # ชื่อตัวละครของนิยายเรื่องนั้น (ดู target.py)


class ApiClient:
    def __init__(self, base_url: str, internal_token: str):
        self._base_url = base_url.rstrip("/")
        self._headers = {"x-internal-token": internal_token, "Content-Type": "application/json"}

    def fetch_pending_queue(self) -> list[PendingItem]:
        res = requests.get(f"{self._base_url}/internal/nlp/pending-queue", headers=self._headers, timeout=30)
        res.raise_for_status()
        return res.json()["items"]

    def submit_sentiment(
        self, target_type: str, target_id: str, label: str, score: float, polarity: float | None = None,
        sentiment_target: str | None = None,
    ) -> None:
        payload = {
            "target_type": target_type,
            "target_id": target_id,
            "sentiment_label": label,
            "sentiment_score": score,
        }
        # gap 2.1 — ขั้วความรู้สึก −1..1 (P(pos) − P(neg)) ที่ระบบแนะนำใช้จริง; ถ้าไม่ส่ง API คำนวณจาก label+score เอง
        if polarity is not None:
            payload["sentiment_polarity"] = polarity
        # ป้ายเป้าหมาย (ตัวละคร/อินกับเรื่อง/งานเขียน) — api รุ่นเก่าไม่รู้จักฟิลด์นี้ก็แค่ตัดทิ้ง ไม่ error
        if sentiment_target is not None:
            payload["sentiment_target"] = sentiment_target
        res = requests.post(
            f"{self._base_url}/internal/nlp/sentiment-callback",
            json=payload,
            headers=self._headers,
            timeout=30,
        )
        res.raise_for_status()
