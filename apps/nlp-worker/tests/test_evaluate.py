"""ทดสอบ eval/evaluate.py — metric และการเช็คประโยคซ้ำกับข้อมูลเทรน (ไม่ต้องโหลดโมเดล)"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "eval"))

import evaluate  # noqa: E402


def row(i: int, label: str, category: str = "praise", text: str = "") -> dict:
    return {"id": str(i), "label": label, "category": category, "text": text or f"ข้อความ {i}"}


class MetricsTest(unittest.TestCase):
    def test_perfect_predictions(self):
        rows = [row(1, "pos"), row(2, "neg"), row(3, "neutral")]
        m = evaluate.evaluate(rows, ["pos", "neg", "neutral"])
        self.assertEqual(m["accuracy"], 1.0)
        self.assertEqual(m["macro_f1"], 1.0)

    def test_per_class_precision_recall(self):
        rows = [row(1, "pos"), row(2, "pos"), row(3, "neg"), row(4, "neg")]
        # pos ทายถูก 1 จาก 2, neg ถูกทายเป็น pos 1 ครั้ง
        m = evaluate.evaluate(rows, ["pos", "neg", "pos", "neg"])
        pos = m["per_class"]["pos"]
        self.assertAlmostEqual(pos["precision"], 0.5)
        self.assertAlmostEqual(pos["recall"], 0.5)
        self.assertEqual(m["confusion"]["neg"], {"pos": 1, "neg": 1})
        self.assertEqual(m["per_class"]["neutral"]["f1"], 0.0)

    def test_by_category(self):
        rows = [row(1, "pos", "immersion"), row(2, "pos", "immersion"), row(3, "neg", "sarcasm")]
        m = evaluate.evaluate(rows, ["neg", "pos", "pos"])
        self.assertEqual(m["by_category"]["immersion"], {"correct": 1, "total": 2})
        self.assertEqual(m["by_category"]["sarcasm"], {"correct": 0, "total": 1})


class OverlapTest(unittest.TestCase):
    def test_numbered_duplicate_counts_as_exact(self):
        # novel_dataset.csv ทำให้ประโยคซ้ำดูไม่ซ้ำด้วยการต่อท้าย (n)
        hits = evaluate.check_overlap([row(1, "pos", text="ฟินมากกกกก หมอนขาดแล้วแม่!")], ["ฟินมากกกกก หมอนขาดแล้วแม่! (625)"])
        self.assertEqual(hits[0]["match"], "exact")

    def test_near_duplicate_detected(self):
        hits = evaluate.check_overlap(
            [row(1, "neg", text="เนื้อเรื่องน่าเบื่อมาก ดำเนินเรื่องช้าจนขี้เกียจรอเลย")],
            ["เนื้อเรื่องน่าเบื่อมาก ดำเนินเรื่องช้าจนขี้เกียจรอ (102)"],
        )
        self.assertEqual(len(hits), 1)

    def test_different_sentence_not_flagged(self):
        hits = evaluate.check_overlap([row(1, "neutral", text="ตอนต่อไปอัพวันไหนคะ")], ["เทค่ะ พล็อตป่วยมาก (726)"])
        self.assertEqual(hits, [])


if __name__ == "__main__":
    unittest.main()
