"""
วัดโมเดลบนชุดทดสอบทางการของ Wisesight Sentiment (ข้อมูลจริง — โพสต์โซเชียลไทย 2,674 ข้อความ, CC0)
เสริม eval/test_set.csv ที่ทีมพัฒนาเขียนเอง: test_set วัดเคสเฉพาะของคอมเมนต์นิยาย ส่วนชุดนี้วัดว่าโมเดลยังเข้าใจ
ภาษาไทยทั่วไปจากคนจริงได้ดีแค่ไหน (label q = คำถาม นับเป็น neutral เหมือนตอนเทรน)

ดาวน์โหลด (ไม่ commit เข้า repo):
  https://github.com/PyThaiNLP/wisesight-sentiment/tree/master/kaggle-competition → test.txt, test_label.txt
  บันทึกเป็น ws_test.txt / ws_test_label.txt

รัน (จาก apps/nlp-worker):
    python eval/wisesight_test.py --model ./model --model ./model_v4 --data-dir <โฟลเดอร์ที่มี ws_test*.txt> --cache raw.json
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "train"))

from build_dataset import read_lines  # noqa: E402  ตัวแยกบรรทัดที่ไม่ทำ label เลื่อน
from evaluate import LABELS, evaluate, pct, raw_scores  # noqa: E402
from sentiment import SentimentAnalyzer  # noqa: E402

MAPPING = {"pos": "pos", "neg": "neg", "neu": "neutral", "q": "neutral"}


def load(data_dir: str) -> list[dict]:
    texts = read_lines(os.path.join(data_dir, "ws_test.txt"))
    labels = read_lines(os.path.join(data_dir, "ws_test_label.txt"))
    if len(texts) != len(labels):
        sys.exit(f"ws_test.txt {len(texts)} บรรทัด แต่ label {len(labels)} บรรทัด")
    # evaluate() ต้องการ category — ทั้งชุดเป็นข้อมูลทั่วไป ไม่แยกประเภท
    return [{"text": t, "label": MAPPING[l.strip()], "category": "indifferent"} for t, l in zip(texts, labels) if l.strip() in MAPPING]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", action="append", required=True)
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--cache")
    ap.add_argument("--temperature", type=float, default=1.0)
    args = ap.parse_args()

    rows = load(args.data_dir)
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"Wisesight test: {len(rows)} ข้อความ\n")
    print("| โมเดล | Accuracy | Macro-F1 | " + " | ".join(f"F1 {l}" for l in LABELS) + " |")
    print("|---|---:|---:|" + "---:|" * len(LABELS))
    for path in args.model:
        raws = raw_scores(path, rows, args.cache)
        preds = [SentimentAnalyzer.from_scores(r, args.temperature).label for r in raws]
        m = evaluate(rows, preds)
        f1 = " | ".join(f"{m['per_class'][l]['f1']:.3f}" for l in LABELS)
        print(f"| {os.path.basename(os.path.normpath(path))} | {pct(m['accuracy'])} | {m['macro_f1']:.3f} | {f1} |")


if __name__ == "__main__":
    main()
