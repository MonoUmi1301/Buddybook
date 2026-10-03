"""
BuddyBook NLP Worker — WangchanBERTa sentiment wrapper

โหลดโมเดลครั้งเดียวตอน worker start (lazy singleton) แล้วนำกลับมาใช้ทุก batch
เพื่อไม่ให้เสียเวลาโหลดโมเดลซ้ำทุกรอบ poll — สำคัญมากเพราะ WangchanBERTa โหลดช้า
"""

from dataclasses import dataclass

SentimentLabel = str  # "pos" | "neg" | "neutral" — ตรงกับ enum SentimentLabel ใน Prisma schema


@dataclass
class SentimentResult:
    label: SentimentLabel
    score: float  # 0.0 - 1.0 ความมั่นใจของ label ที่ทาย (CHECK chk_comments_sentiment_score_range)
    polarity: float  # -1.0 - 1.0 = P(pos) - P(neg) — ขั้วความรู้สึกที่ระบบแนะนำใช้ (gap 2.1)


class SentimentAnalyzer:
    """
    โมเดล fine-tuned จริงจาก buddybook_real/My_Novel_Project/my_final_sentiment_model
    (เทรนใน novel_codetrainSentiment.ipynb บน novel_dataset.csv + pythainlp/wisesight_sentiment
    รวม ~22k ตัวอย่าง — 99.33% accuracy บน held-out test set)
    """

    def __init__(self, model_path: str):
        self._model_path = model_path
        self._pipe = None  # โหลดจริงตอนเรียก .load() เพื่อไม่ให้ import ช้าตอน test

    def load(self) -> None:
        """โหลดโมเดลเข้า memory — เรียกครั้งเดียวตอน worker start"""
        from transformers import pipeline

        self._pipe = pipeline(
            "sentiment-analysis",
            model=self._model_path,
            tokenizer=self._model_path,
            truncation=True,
            max_length=512,
        )

    def analyze(self, text: str) -> SentimentResult:
        if self._pipe is None:
            raise RuntimeError("เรียก .load() ก่อนใช้ .analyze()")

        # top_k=None ได้ความน่าจะเป็นครบทุกคลาส — ใช้ทั้ง label ที่ชนะ (ความมั่นใจ) และ P(pos) − P(neg) (ขั้ว)
        scores = self._pipe(text, top_k=None)
        if scores and isinstance(scores[0], list):  # บางเวอร์ชันของ transformers ห่อเป็น list ซ้อน
            scores = scores[0]
        return self.from_scores(scores)

    @classmethod
    def from_scores(cls, scores: list[dict]) -> SentimentResult:
        """แปลงผลดิบ [{label, score}, ...] เป็นผลลัพธ์ — แยกเป็น pure function เพื่อทดสอบได้โดยไม่ต้องโหลดโมเดล"""
        probs: dict[str, float] = {}
        for s in scores:
            mapped = cls._map_label(s["label"])
            probs[mapped] = probs.get(mapped, 0.0) + float(s["score"])
        best = max(probs, key=probs.get)
        polarity = max(-1.0, min(1.0, probs.get("pos", 0.0) - probs.get("neg", 0.0)))
        return SentimentResult(label=best, score=probs[best], polarity=polarity)

    @staticmethod
    def _map_label(raw_label: str) -> SentimentLabel:
        """แปลง label ดิบจากโมเดล — my_final_sentiment_model/config.json กำหนด id2label เป็น
        LABEL_0/LABEL_1/LABEL_2 ตรงกับ Positive/Negative/Neutral ตามลำดับที่ใช้เทรน (ดู cell
        สุดท้ายของ novel_codetrainSentiment.ipynb ที่ map id2label ตอน inference demo) —
        ไม่ใช่ label ทั่วไปแบบ "POSITIVE"/"NEGATIVE" ของโมเดล sentiment สำเร็จรูปอื่น ๆ บน HuggingFace"""
        mapping = {"label_0": "pos", "label_1": "neg", "label_2": "neutral"}
        return mapping.get(raw_label.strip().lower(), "neutral")
