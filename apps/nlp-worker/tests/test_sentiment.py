"""ทดสอบการแปลงผลโมเดลเป็นขั้วความรู้สึก (gap 2.1) — ไม่ต้องโหลดโมเดลจริง"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sentiment import SentimentAnalyzer  # noqa: E402


def scores(pos: float, neg: float, neutral: float) -> list[dict]:
    return [
        {"label": "LABEL_0", "score": pos},
        {"label": "LABEL_1", "score": neg},
        {"label": "LABEL_2", "score": neutral},
    ]


class FromScoresTest(unittest.TestCase):
    def test_confident_negative_is_negative_polarity(self):
        r = SentimentAnalyzer.from_scores(scores(0.02, 0.95, 0.03))
        self.assertEqual(r.label, "neg")
        self.assertAlmostEqual(r.score, 0.95)
        self.assertAlmostEqual(r.polarity, -0.93)

    def test_positive(self):
        r = SentimentAnalyzer.from_scores(scores(0.9, 0.05, 0.05))
        self.assertEqual(r.label, "pos")
        self.assertAlmostEqual(r.polarity, 0.85)

    def test_neutral_is_near_zero(self):
        r = SentimentAnalyzer.from_scores(scores(0.1, 0.1, 0.8))
        self.assertEqual(r.label, "neutral")
        self.assertAlmostEqual(r.polarity, 0.0)


if __name__ == "__main__":
    unittest.main()
