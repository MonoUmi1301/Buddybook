"""ป้ายเป้าหมายของความรู้สึก (target.classify_target) — ไม่เปลี่ยน label ของโมเดล แค่บอกว่าพูดถึงอะไร"""

import csv
import os
import sys
import unittest

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(HERE, "..", "src"))

from target import classify_target  # noqa: E402


class ClassifyTargetTest(unittest.TestCase):
    def test_character_by_role_name_or_prefix(self):
        self.assertEqual(classify_target("เกลียดนางร้ายมาก"), "character")
        self.assertEqual(classify_target("ยัยลิเลียนี่มันร้ายจริง"), "character")
        self.assertEqual(classify_target("โมโหน็อกซ์สุด ๆ", ["น็อกซ์"]), "character")

    def test_immersion(self):
        self.assertEqual(classify_target("ร้องไห้หนักมาก ใจสลาย"), "immersion")

    def test_work(self):
        self.assertEqual(classify_target("พิมพ์ผิดเยอะ อ่านแล้วสะดุด"), "work")
        # คำชมฝีมือเขียนเป็นเรื่องตัวงาน ไม่ใช่การอินกับเรื่อง
        self.assertEqual(classify_target("ไรท์เขียนเก่งมาก"), "work")

    def test_unknown(self):
        self.assertIsNone(classify_target("ตอนหน้าลงวันไหนคะ"))

    def test_held_out_test_set(self):
        """ตัวเลขที่รายงานใน docs/evaluation.md — คอมเมนต์ประเภท "อินกับเรื่อง" ต้องถูกจับเป็นตัวละคร/อินเกือบทั้งหมด"""
        with open(os.path.join(HERE, "..", "eval", "test_set.csv"), encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        immersion = [r for r in rows if r["category"] == "immersion"]
        hit = sum(classify_target(r["text"]) in ("character", "immersion") for r in immersion)
        self.assertGreaterEqual(hit / len(immersion), 0.9)


if __name__ == "__main__":
    unittest.main()
