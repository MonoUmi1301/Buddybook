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
    score: float  # 0.0 - 1.0 ตาม CHECK constraint chk_comments_sentiment_score_range


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

        raw = self._pipe(text)[0]
        return SentimentResult(label=self._map_label(raw["label"]), score=float(raw["score"]))

    @staticmethod
    def _map_label(raw_label: str) -> SentimentLabel:
        """แปลง label ดิบจากโมเดล — my_final_sentiment_model/config.json กำหนด id2label เป็น
        LABEL_0/LABEL_1/LABEL_2 ตรงกับ Positive/Negative/Neutral ตามลำดับที่ใช้เทรน (ดู cell
        สุดท้ายของ novel_codetrainSentiment.ipynb ที่ map id2label ตอน inference demo) —
        ไม่ใช่ label ทั่วไปแบบ "POSITIVE"/"NEGATIVE" ของโมเดล sentiment สำเร็จรูปอื่น ๆ บน HuggingFace"""
        mapping = {"label_0": "pos", "label_1": "neg", "label_2": "neutral"}
        return mapping.get(raw_label.strip().lower(), "neutral")
