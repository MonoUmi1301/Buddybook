"""
หาค่า temperature (T) ให้ความมั่นใจของโมเดลตรงกับความจริง — temperature scaling (Guo et al., 2017)

ปัญหา: โมเดลตอบ P = 0.99+ แทบทุกประโยค ทั้งที่ทายผิด ~20% → ขั้ว (P(pos) − P(neg)) ติดเพดาน ±1
ระบบแนะนำจึงให้น้ำหนักคอมเมนต์ที่โมเดลเดาผิดเต็ม ๆ

วิธี: p_T = softmax(log p / T) — T > 1 ทำให้ความน่าจะเป็นนุ่มลง โดย label ที่ทายไม่เปลี่ยน (argmax เดิม)
เลือก T ที่ log-loss ต่ำสุดบนชุดจูน (dev_set) แล้ววัด ECE / Brier บนชุดทดสอบ (test_set) ก่อน-หลัง
ใช้เฉพาะประโยคที่กฎ target.py ไม่ได้พลิก — ประโยคที่ถูกพลิกได้ขั้วคงที่ (+0.5) อยู่แล้ว ไม่ได้ใช้ความน่าจะเป็นจากโมเดล
(ถ้ารวมไว้ T จะถูกดันขึ้นไปสูงเพื่อชดเชยประโยค "ด่าตัวละครเพราะอิน" ที่กฎแก้ให้แล้ว)
ใช้ผลดิบจาก cache ของ evaluate.py (--cache) จึงไม่ต้องรันโมเดลซ้ำ

รัน (จาก apps/nlp-worker):
    python eval/evaluate.py --model ./model --test eval/dev_set.csv --cache raw.json --no-target
    python eval/evaluate.py --model ./model --cache raw.json --no-target
    python eval/calibrate.py --model ./model --cache raw.json
แล้วตั้ง SENTIMENT_TEMPERATURE ใน .env ของ worker ตามค่าที่ได้
"""

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from evaluate import read_csv  # noqa: E402
from sentiment import SentimentAnalyzer  # noqa: E402
import target  # noqa: E402

LABELS = ["pos", "neg", "neutral"]


def probs_for(raw: list[dict], temperature: float) -> dict[str, float]:
    return SentimentAnalyzer.probabilities(raw, temperature)


def nll(rows, raws, t) -> float:
    return -sum(math.log(max(1e-12, probs_for(raw, t)[r["label"]])) for r, raw in zip(rows, raws)) / len(rows)


def ece(rows, raws, t, bins: int = 10) -> float:
    """Expected Calibration Error — ความมั่นใจเฉลี่ยห่างจากความแม่นยำจริงแค่ไหน (0 = ตรงเป๊ะ)"""
    buckets = [[] for _ in range(bins)]
    for r, raw in zip(rows, raws):
        p = probs_for(raw, t)
        pred = max(p, key=p.get)
        conf = p[pred]
        buckets[min(bins - 1, int(conf * bins))].append((conf, pred == r["label"]))
    total = len(rows)
    return sum(len(b) / total * abs(sum(c for c, _ in b) / len(b) - sum(ok for _, ok in b) / len(b)) for b in buckets if b)


def brier(rows, raws, t) -> float:
    s = 0.0
    for r, raw in zip(rows, raws):
        p = probs_for(raw, t)
        s += sum((p[l] - (1.0 if l == r["label"] else 0.0)) ** 2 for l in LABELS)
    return s / len(rows)


def mean_abs_polarity_when_wrong(rows, raws, t) -> float:
    vals = []
    for r, raw in zip(rows, raws):
        p = probs_for(raw, t)
        if max(p, key=p.get) != r["label"]:
            vals.append(abs(p["pos"] - p["neg"]))
    return sum(vals) / len(vals) if vals else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--cache", required=True)
    here = os.path.dirname(__file__)
    ap.add_argument("--dev", default=os.path.join(here, "dev_set.csv"))
    ap.add_argument("--test", default=os.path.join(here, "test_set.csv"))
    args = ap.parse_args()

    with open(args.cache, encoding="utf-8") as f:
        cache = json.load(f)[os.path.abspath(args.model)]
    def not_flipped(rows):
        keep = []
        for r in rows:
            label = SentimentAnalyzer.from_scores(cache[r["text"]]).label
            names = [n for n in (r.get("characters") or "").split("|") if n]
            if not target.decide(r["text"], label, names).flipped:
                keep.append(r)
        return keep

    dev, test = not_flipped(read_csv(args.dev)), not_flipped(read_csv(args.test))
    dev_raw, test_raw = [cache[r["text"]] for r in dev], [cache[r["text"]] for r in test]

    grid = [round(1 + i * 0.25, 2) for i in range(0, 77)]  # 1.0 .. 20.0
    best_t = min(grid, key=lambda t: nll(dev, dev_raw, t))

    sys.stdout.reconfigure(encoding="utf-8")
    print(f"T ที่ดีที่สุดบน dev_set: {best_t}  (dev {len(dev)} · test {len(test)} ประโยคที่กฎ target ไม่ได้พลิก)")
    print("| วัดบน test_set | T = 1 (เดิม) | T = %s |" % best_t)
    print("|---|---:|---:|")
    for name, fn in (("log-loss", nll), ("ECE", ece), ("Brier", brier), ("|ขั้ว| เฉลี่ยตอนทายผิด", mean_abs_polarity_when_wrong)):
        print(f"| {name} | {fn(test, test_raw, 1.0):.3f} | {fn(test, test_raw, best_t):.3f} |")


if __name__ == "__main__":
    main()
