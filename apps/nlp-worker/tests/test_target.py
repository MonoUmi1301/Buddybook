"""ทดสอบกฎแยกเป้าหมายความรู้สึก (target.py) — ไม่ต้องโหลดโมเดลจริง"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import target  # noqa: E402
from sentiment import SentimentAnalyzer, SentimentResult  # noqa: E402

NEG = SentimentResult(label="neg", score=0.99, polarity=-0.98)


class DecideTest(unittest.TestCase):
    def test_only_touches_negative(self):
        self.assertFalse(target.decide("ตัวร้ายเลวมาก", "pos").flipped)
        self.assertFalse(target.decide("ตัวร้ายเลวมาก", "neutral").flipped)

    def test_character_name_flips(self):
        d = target.decide("ลุ้นมากกกก ตอนต่อไปได้เลย น็อกซ์น่าสงสาร", "neg", ["น็อกซ์", "ลิเลีย"])
        self.assertTrue(d.flipped)

    def test_role_word_flips(self):
        self.assertTrue(target.decide("เกลียดนางร้ายเข้าไส้", "neg").flipped)

    def test_immersion_cue_flips(self):
        self.assertTrue(target.decide("ร้องไห้หนักมาก ใจสลาย", "neg").flipped)

    def test_work_criticism_wins(self):
        self.assertFalse(target.decide("พระเอกถูกเขียนให้โง่เกินจริง พล็อตไม่สมเหตุสมผล", "neg").flipped)
        self.assertFalse(target.decide("คำผิดเยอะ อ่านแล้วร้องไห้", "neg").flipped)

    def test_sarcasm_with_sanuk_is_not_immersion(self):
        self.assertFalse(target.decide("สนุกจังเลย หลับไปสามรอบ", "neg").flipped)

    def test_substring_false_matches(self):
        # "นอนไม่หลับ" ไม่ใช่ "อ่านแล้วหลับ", "หลอก" ไม่ใช่ "ลอก(เลียน)", "อีก" ไม่ใช่คำนำหน้าเรียกตัวละคร
        self.assertTrue(target.decide("แค้นแทนน้องจนนอนไม่หลับ", "neg").flipped)
        self.assertTrue(target.decide("มิราหน้าไหว้หลังหลอก", "neg", ["มิรา"]).flipped)
        self.assertFalse(target.decide("อีกแล้วเหรอ ไม่ไหวจริงๆ", "neg").flipped)

    def test_short_names_ignored(self):
        # ชื่อตัวอักษรเดียวจับคำทั่วไปผิดง่าย
        self.assertFalse(target.decide("แย่มาก", "neg", ["ก"]).flipped)


class ApplyTargetTest(unittest.TestCase):
    def test_flip_gives_moderate_positive(self):
        r = SentimentAnalyzer.apply_target("ตัวร้ายน่าตบมาก", NEG)
        self.assertEqual(r.label, "pos")
        self.assertAlmostEqual(r.polarity, target.IMMERSION_POLARITY)
        self.assertTrue(r.adjusted)

    def test_untouched_result_is_returned_as_is(self):
        r = SentimentAnalyzer.apply_target("เขียนแย่มาก", NEG)
        self.assertIs(r, NEG)


if __name__ == "__main__":
    unittest.main()
