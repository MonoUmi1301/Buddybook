"""ทดสอบรอบดึงคิวของ worker — นับเฉพาะที่ส่งผลสำเร็จ (ตัวกำหนดว่าจะดึงรอบถัดไปทันทีหรือพัก)"""

import os
import sys
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# main.py import api_client/config ที่ใช้ requests/dotenv — ไม่จำเป็นต่อเทสต์นี้ ใส่โมดูลปลอมไว้ถ้าไม่ได้ติดตั้ง
for name in ("requests", "dotenv"):
    if name not in sys.modules:
        try:
            __import__(name)
        except ImportError:
            fake = types.ModuleType(name)
            fake.load_dotenv = lambda *a, **k: None  # type: ignore[attr-defined]
            sys.modules[name] = fake

from main import process_queue  # noqa: E402


class FakeClient:
    def __init__(self, items):
        self.items = items
        self.submitted = []

    def fetch_pending_queue(self):
        return self.items

    def submit_sentiment(self, target_type, target_id, label, score, polarity):
        self.submitted.append(target_id)


class FakeResult:
    label, score, polarity, adjusted = "pos", 0.9, 0.9, None


class FakeAnalyzer:
    def analyze(self, text, names=None, use_target=True):
        if text == "boom":
            raise ValueError("cannot analyze")
        return FakeResult()


def item(i, text="สนุกมาก"):
    return {"target_type": "comment", "target_id": f"id-{i}", "content": text}


class ProcessQueueTest(unittest.TestCase):
    def test_counts_only_submitted_items(self):
        client = FakeClient([item(1), item(2, "boom"), item(3)])
        self.assertEqual(process_queue(client, FakeAnalyzer()), 2)
        self.assertEqual(client.submitted, ["id-1", "id-3"])

    def test_queue_of_only_failing_items_returns_zero_so_worker_sleeps(self):
        client = FakeClient([item(1, "boom"), item(2, "boom")])
        self.assertEqual(process_queue(client, FakeAnalyzer()), 0)

    def test_empty_queue(self):
        self.assertEqual(process_queue(FakeClient([]), FakeAnalyzer()), 0)


if __name__ == "__main__":
    unittest.main()
