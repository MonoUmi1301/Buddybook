"""
วัดผลโมเดล sentiment บนชุดทดสอบที่แยกจากข้อมูลเทรน (eval/test_set.csv)

ใช้ SentimentAnalyzer ตัวเดียวกับ worker จริง (src/sentiment.py) จึงวัดทั้งโมเดลและการ map label
รายงาน accuracy, precision/recall/F1 ต่อคลาส, macro-F1, confusion matrix และความแม่นยำแยกตามประเภทข้อความ
(praise / immersion / criticism / sarcasm / question / checkin / indifferent)

ถ้าให้ --train-data มาด้วย จะเช็คก่อนว่าประโยคทดสอบซ้ำหรือเกือบซ้ำกับข้อมูลเทรนไหม
(ตัวเลข 99.33% เดิมสูงเกินจริงเพราะชุดทดสอบเกือบทั้งหมดซ้ำกับชุดเทรน)

รัน (จาก apps/nlp-worker):
    python eval/evaluate.py --model "D:/.../my_final_sentiment_model_v3" \
        --train-data "D:/.../novel_dataset.csv" --out ../../docs/results/sentiment-eval.md
--model ใส่ซ้ำได้หลายตัวเพื่อเทียบกัน
"""

import argparse
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

LABELS = ["pos", "neg", "neutral"]
CATEGORY_ORDER = ["praise", "immersion", "criticism", "sarcasm", "question", "checkin", "indifferent"]
CATEGORY_TH = {
    "praise": "ชมงาน",
    "immersion": "ด่าตัวละครเพราะอิน",
    "criticism": "ติงาน/ด่างาน",
    "sarcasm": "ชมประชด",
    "question": "คำถาม",
    "checkin": "เช็กชื่อ/แจ้งข่าว",
    "indifferent": "เฉยๆ",
}
NEAR_DUP_THRESHOLD = 0.6


def read_csv(path: str) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------- overlap check

def normalize(text: str) -> str:
    text = re.sub(r"\s*\(\d+\)\s*$", "", text)  # novel_dataset.csv ต่อท้ายเลข (n) ให้ประโยคซ้ำดูไม่ซ้ำ
    text = re.sub(r"(.)\1{2,}", r"\1\1", text)  # มากกกก -> มากก
    return re.sub(r"\s+", "", text).lower()


def trigrams(text: str) -> set[str]:
    return {text[i : i + 3] for i in range(max(1, len(text) - 2))}


def check_overlap(test_rows: list[dict], train_texts: list[str]) -> list[dict]:
    train_norm = {normalize(t) for t in train_texts}
    train_grams = [(t, trigrams(t)) for t in train_norm]
    hits = []
    for row in test_rows:
        n = normalize(row["text"])
        if n in train_norm:
            hits.append({"id": row["id"], "text": row["text"], "match": "exact", "similarity": 1.0})
            continue
        g = trigrams(n)
        best, best_text = 0.0, ""
        for t, tg in train_grams:
            sim = len(g & tg) / len(g | tg)
            if sim > best:
                best, best_text = sim, t
        if best >= NEAR_DUP_THRESHOLD:
            hits.append({"id": row["id"], "text": row["text"], "match": best_text, "similarity": round(best, 2)})
    return hits


# ---------------------------------------------------------------- metrics

def evaluate(rows: list[dict], preds: list[str]) -> dict:
    gold = [r["label"] for r in rows]
    confusion = {g: Counter() for g in LABELS}
    for g, p in zip(gold, preds):
        confusion[g][p] += 1

    per_class = {}
    for c in LABELS:
        tp = confusion[c][c]
        fp = sum(confusion[g][c] for g in LABELS if g != c)
        fn = sum(confusion[c][p] for p in LABELS if p != c)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[c] = {"precision": precision, "recall": recall, "f1": f1, "support": tp + fn}

    by_category = defaultdict(lambda: [0, 0])
    for r, p in zip(rows, preds):
        by_category[r["category"]][1] += 1
        by_category[r["category"]][0] += p == r["label"]

    correct = sum(g == p for g, p in zip(gold, preds))
    return {
        "n": len(rows),
        "accuracy": correct / len(rows),
        "macro_f1": sum(m["f1"] for m in per_class.values()) / len(LABELS),
        "per_class": per_class,
        "confusion": {g: dict(confusion[g]) for g in LABELS},
        "by_category": {k: {"correct": v[0], "total": v[1]} for k, v in by_category.items()},
    }


def run_model(model_path: str, rows: list[dict]) -> tuple[list[str], list[float]]:
    from sentiment import SentimentAnalyzer

    analyzer = SentimentAnalyzer(model_path)
    analyzer.load()
    preds, polarities = [], []
    for r in rows:
        result = analyzer.analyze(r["text"])
        preds.append(result.label)
        polarities.append(result.polarity)
    return preds, polarities


# ---------------------------------------------------------------- report

def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def render(test_path: str, rows: list[dict], overlap: list[dict] | None, results: dict) -> str:
    counts = Counter(r["label"] for r in rows)
    cat_counts = Counter(r["category"] for r in rows)
    names = list(results)
    out = [
        "# ผลวัด sentiment model บนชุดทดสอบแยก",
        "",
        "สร้างโดย `apps/nlp-worker/eval/evaluate.py` · ชุดทดสอบ `apps/nlp-worker/eval/test_set.csv`",
        "",
        "## ชุดทดสอบ",
        "",
        f"- {len(rows)} ประโยค: pos {counts['pos']} · neg {counts['neg']} · neutral {counts['neutral']}",
        "- แยกประเภท: " + " · ".join(f"{CATEGORY_TH[c]} {cat_counts[c]}" for c in CATEGORY_ORDER if cat_counts[c]),
        "- label ตามความรู้สึกต่อ**ตัวนิยาย**: ด่าตัวละครเพราะอิน = pos, ชมประชด = neg (ตรงกับที่ novel_dataset ยุบ sarcasm เป็น neg)",
        "- ประโยคเขียนใหม่ ไม่ได้มาจาก novel_dataset.csv หรือ Wisesight",
        "",
    ]
    if overlap is not None:
        if overlap:
            out += [f"**ซ้ำหรือเกือบซ้ำกับข้อมูลเทรน {len(overlap)} ประโยค** (trigram Jaccard ≥ {NEAR_DUP_THRESHOLD}):", ""]
            out += [f"- #{h['id']} {h['text']} ↔ {h['match']} ({h['similarity']})" for h in overlap]
            out.append("")
        else:
            out += [f"ตรวจกับ novel_dataset.csv แล้ว: ไม่มีประโยคซ้ำหรือเกือบซ้ำ (trigram Jaccard < {NEAR_DUP_THRESHOLD})", ""]

    out += ["## สรุป", "", "| โมเดล | Accuracy | Macro-F1 |", "|---|---:|---:|"]
    for name in names:
        m = results[name]["metrics"]
        out.append(f"| {name} | {pct(m['accuracy'])} | {m['macro_f1']:.3f} |")

    out += ["", "## ความแม่นยำแยกตามประเภทข้อความ", "", "| ประเภท | label ที่ถูก | " + " | ".join(names) + " |",
            "|---|---|" + "---:|" * len(names)]
    for c in CATEGORY_ORDER:
        if not cat_counts[c]:
            continue
        label = next(r["label"] for r in rows if r["category"] == c)
        cells = []
        for name in names:
            bc = results[name]["metrics"]["by_category"][c]
            cells.append(f"{bc['correct']}/{bc['total']}")
        out.append(f"| {CATEGORY_TH[c]} | {label} | " + " | ".join(cells) + " |")

    for name in names:
        m = results[name]["metrics"]
        out += ["", f"## {name}", "", "| คลาส | Precision | Recall | F1 | จำนวน |", "|---|---:|---:|---:|---:|"]
        for c in LABELS:
            pc = m["per_class"][c]
            out.append(f"| {c} | {pc['precision']:.3f} | {pc['recall']:.3f} | {pc['f1']:.3f} | {pc['support']} |")
        out += ["", "Confusion matrix (แถว = label จริง, คอลัมน์ = ที่โมเดลทาย)", "", "| | " + " | ".join(LABELS) + " |",
                "|---|" + "---:|" * len(LABELS)]
        for g in LABELS:
            out.append(f"| {g} | " + " | ".join(str(m["confusion"][g].get(p, 0)) for p in LABELS) + " |")
        wrong = [(r, p, pol) for r, p, pol in zip(rows, results[name]["preds"], results[name]["polarity"]) if p != r["label"]]
        out += ["", f"<details><summary>ทายผิด {len(wrong)} ประโยค</summary>", "", "| # | ประเภท | ควรเป็น | ทาย | ขั้ว | ข้อความ |", "|---|---|---|---|---:|---|"]
        for r, p, pol in wrong:
            out.append(f"| {r['id']} | {CATEGORY_TH[r['category']]} | {r['label']} | {p} | {pol:+.2f} | {r['text']} |")
        out += ["", "</details>"]

    out += ["", "## ข้อจำกัด", "",
            "- ชุดทดสอบเขียนและ label โดยทีมพัฒนา ยังไม่ใช่คอมเมนต์จริงจากผู้ใช้ ควรเพิ่มคอมเมนต์จริงช่วง UAT",
            "- 180 ประโยค ช่วงความเชื่อมั่นของ accuracy ยังกว้างราว ±7 จุด (95%)", ""]
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", action="append", required=True, help="โฟลเดอร์โมเดล ใส่ได้หลายครั้ง")
    ap.add_argument("--test", default=os.path.join(os.path.dirname(__file__), "test_set.csv"))
    ap.add_argument("--train-data", help="novel_dataset.csv สำหรับเช็คประโยคซ้ำ")
    ap.add_argument("--out", help="ไฟล์รายงาน .md (ไม่ใส่ = พิมพ์ออกจอ)")
    args = ap.parse_args()

    rows = read_csv(args.test)
    bad = [r["id"] for r in rows if r["label"] not in LABELS or r["category"] not in CATEGORY_TH]
    if bad:
        sys.exit(f"label/category ไม่ถูกต้องที่ id: {bad}")

    overlap = None
    if args.train_data:
        overlap = check_overlap(rows, [r["text"] for r in read_csv(args.train_data)])

    results = {}
    for path in args.model:
        name = os.path.basename(os.path.normpath(path))
        preds, polarity = run_model(path, rows)
        results[name] = {"preds": preds, "polarity": polarity, "metrics": evaluate(rows, preds)}
        m = results[name]["metrics"]
        print(f"{name}: accuracy {pct(m['accuracy'])}  macro-F1 {m['macro_f1']:.3f}", file=sys.stderr)

    report = render(args.test, rows, overlap, results)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(report)
        with open(os.path.splitext(args.out)[0] + ".json", "w", encoding="utf-8") as f:
            json.dump({k: v["metrics"] for k, v in results.items()}, f, ensure_ascii=False, indent=1)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(report)


if __name__ == "__main__":
    main()
