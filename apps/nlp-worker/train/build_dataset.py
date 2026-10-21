"""
สร้างชุดเทรน v4 จากหลายแหล่ง — ตัดประโยคซ้ำ และตัดทุกประโยคที่ซ้ำ/เกือบซ้ำกับชุดทดสอบ (eval/test_set.csv)
และชุดจูนกฎ (eval/dev_set.csv) ออก ไม่ให้เกิด leakage แบบ 99.33% เดิม

แหล่งข้อมูล (ดาวน์โหลดเองแล้วชี้ path ให้สคริปต์ — ไม่ commit ไฟล์ดิบเข้า repo):
  1. novel_dataset.csv (buddybook_real/My_Novel_Project) — ข้อมูลเดิมที่ใช้เทรน v1–v3 (164 ประโยคไม่ซ้ำ)
  2. Wisesight Sentiment (CC0-1.0) — โพสต์โซเชียลไทยจริง
     https://github.com/PyThaiNLP/wisesight-sentiment (kaggle-competition/train.txt + train_label.txt)
     Suriyawongkul et al. (2019) doi:10.5281/zenodo.3457447 — label q (คำถาม) ยุบเป็น neutral
  3. PyThaiNLP thai-sentiment-analysis-dataset (CC BY 4.0) — review_shopping.csv, general-amy.csv
     https://github.com/PyThaiNLP/thai-sentiment-analysis-dataset
  4. train/novel_comments_synthetic.csv — คอมเมนต์นิยายที่ทีมพัฒนาแต่งขึ้น (เน้นด่าตัวละครเพราะอิน = pos
     ซึ่งไม่มีในแหล่งไหนเลย) source = synthetic ในไฟล์ผลลัพธ์

รัน (จาก apps/nlp-worker):
    python train/build_dataset.py --novel-dataset ".../novel_dataset.csv" \
        --wisesight-dir ".../datasets" --pythainlp-dir ".../datasets" --out train/data
"""

import argparse
import csv
import os
import random
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "eval"))
from evaluate import NEAR_DUP_THRESHOLD, normalize, trigrams  # noqa: E402  ใช้เกณฑ์เดียวกับตัววัดผล

LABELS = ("pos", "neg", "neutral")
HERE = os.path.dirname(__file__)


def read_csv(path: str) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_novel_dataset(path: str) -> list[dict]:
    rows = read_csv(path)
    text_key = next(k for k in rows[0] if k.lower() in ("text", "comment", "sentence", "texts"))
    label_key = next(k for k in rows[0] if k.lower() in ("label", "labels", "sentiment", "category"))
    mapping = {"positive": "pos", "pos": "pos", "negative": "neg", "neg": "neg", "neutral": "neutral",
               "neu": "neutral", "sarcasm": "neg", "sarcastic": "neg"}  # notebook เดิมยุบ sarcasm เป็น neg
    out = []
    for r in rows:
        label = mapping.get(str(r[label_key]).strip().lower())
        if label:
            out.append({"text": r[text_key], "label": label, "source": "novel_dataset"})
    return out


def load_wisesight(d: str) -> list[dict]:
    with open(os.path.join(d, "ws_train.txt"), encoding="utf-8") as f:
        texts = f.read().splitlines()
    with open(os.path.join(d, "ws_train_label.txt"), encoding="utf-8") as f:
        labels = f.read().splitlines()
    mapping = {"pos": "pos", "neg": "neg", "neu": "neutral", "q": "neutral"}
    return [{"text": t, "label": mapping[l.strip()], "source": "wisesight"} for t, l in zip(texts, labels) if l.strip() in mapping]


def load_pythainlp(d: str) -> list[dict]:
    out = []
    for name in ("pt_review_shopping.csv", "pt_general-amy.csv"):
        with open(os.path.join(d, name), encoding="utf-8") as f:
            for line in f:
                text, _, label = line.rstrip("\n").rpartition("\t")
                if label.strip() in ("pos", "neg") and text.strip():
                    out.append({"text": text, "label": label.strip(), "source": f"pythainlp/{name[3:-4]}"})
    return out


def load_synthetic() -> list[dict]:
    rows = read_csv(os.path.join(HERE, "novel_comments_synthetic.csv"))
    return [{"text": r["text"], "label": r["label"], "source": "synthetic", "category": r["category"]} for r in rows]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--novel-dataset", required=True)
    ap.add_argument("--wisesight-dir", required=True)
    ap.add_argument("--pythainlp-dir", required=True)
    ap.add_argument("--wisesight-per-class", type=int, default=1200, help="สุ่ม Wisesight ต่อคลาส (เทรนบน CPU ได้)")
    ap.add_argument("--val-ratio", type=float, default=0.1)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=os.path.join(HERE, "data"))
    args = ap.parse_args()
    rng = random.Random(args.seed)

    held_out = read_csv(os.path.join(HERE, "..", "eval", "test_set.csv")) + read_csv(os.path.join(HERE, "..", "eval", "dev_set.csv"))
    held_norm = {normalize(r["text"]) for r in held_out}
    held_grams = [trigrams(normalize(r["text"])) for r in held_out]

    wisesight = load_wisesight(args.wisesight_dir)
    ws_sample = []
    for label in LABELS:
        pool = [r for r in wisesight if r["label"] == label and 8 <= len(r["text"]) <= 300]
        rng.shuffle(pool)
        ws_sample += pool[: args.wisesight_per_class]

    sources = load_novel_dataset(args.novel_dataset) + ws_sample + load_pythainlp(args.pythainlp_dir) + load_synthetic()

    seen: dict[str, str] = {}
    kept, dropped = [], Counter()
    for r in sources:
        r["text"] = " ".join(r["text"].split())
        n = normalize(r["text"])
        if len(n) < 2:
            dropped["empty"] += 1
            continue
        if n in held_norm:
            dropped[f"exact-heldout:{r['source']}"] += 1
            continue
        g = trigrams(n)
        if any(len(g & h) / max(1, len(g | h)) >= NEAR_DUP_THRESHOLD for h in held_grams):
            dropped[f"near-heldout:{r['source']}"] += 1
            continue
        if n in seen:
            # ประโยคเดียวกันแต่ label ต่างกัน = ข้อมูลขัดกัน ทิ้งทั้งคู่ไม่ได้ (อันแรกเข้าไปแล้ว) เลยนับไว้ให้เห็น
            dropped["dup-conflict" if seen[n] != r["label"] else "dup"] += 1
            continue
        seen[n] = r["label"]
        kept.append(r)

    # แบ่ง val แบบ stratified ตามแหล่ง+label — ตัดซ้ำแล้วจึงไม่มีประโยคเดียวกันข้ามสองฝั่ง
    rng.shuffle(kept)
    by_group: dict[tuple, list] = {}
    for r in kept:
        by_group.setdefault((r["source"], r["label"]), []).append(r)
    train, val = [], []
    for group in by_group.values():
        k = max(1, round(len(group) * args.val_ratio)) if len(group) >= 5 else 0
        val += group[:k]
        train += group[k:]

    os.makedirs(args.out, exist_ok=True)
    for name, rows in (("train.csv", train), ("val.csv", val)):
        with open(os.path.join(args.out, name), "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["text", "label", "source"])
            w.writeheader()
            for r in rows:
                w.writerow({k: r[k] for k in ("text", "label", "source")})

    print(f"train {len(train)} · val {len(val)}")
    print("train ตามแหล่ง/label:", dict(sorted(Counter((r["source"], r["label"]) for r in train).items())))
    print("ตัดทิ้ง:", dict(dropped))


if __name__ == "__main__":
    main()
