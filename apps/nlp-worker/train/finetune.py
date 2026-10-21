"""
เทรนต่อ (continue fine-tune) จากโมเดล v2 ด้วยชุดข้อมูลที่ build_dataset.py สร้าง
ใช้ GPU อัตโนมัติถ้ามี (Google Colab ~10–15 นาที ดู train/finetune_colab.ipynb) — บน CPU ช้ามาก (หลายชั่วโมง)

- เริ่มจากโมเดลเดิม (ไม่เริ่มจาก WangchanBERTa เปล่า) learning rate ต่ำ ไม่กี่ epoch → ความรู้เดิมไม่หาย
- เก็บ checkpoint ที่ macro-F1 บน val ดีที่สุด (val มาจากแหล่งเดียวกับ train แต่ไม่มีประโยคซ้ำกัน)
- ห้ามใช้ eval/test_set.csv ระหว่างเทรน — วัดผลหลังเทรนเสร็จด้วย eval/evaluate.py เท่านั้น
- label id ต้องตรงกับ config.json ของโมเดลเดิม: LABEL_0=pos, LABEL_1=neg, LABEL_2=neutral (ดู sentiment.py)

รัน (จาก apps/nlp-worker):
    python train/finetune.py --base ./model --data train/data --out ../../../models/my_final_sentiment_model_v4
"""

import argparse
import csv
import os
import random
import time

import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

LABEL2ID = {"pos": 0, "neg": 1, "neutral": 2}


def read(path: str) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def macro_f1(golds: list[int], preds: list[int]) -> float:
    f1s = []
    for c in range(3):
        tp = sum(1 for g, p in zip(golds, preds) if g == c and p == c)
        fp = sum(1 for g, p in zip(golds, preds) if g != c and p == c)
        fn = sum(1 for g, p in zip(golds, preds) if g == c and p != c)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1s.append(2 * prec * rec / (prec + rec) if prec + rec else 0.0)
    return sum(f1s) / 3


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="โฟลเดอร์โมเดลตั้งต้น (v2)")
    ap.add_argument("--data", required=True, help="โฟลเดอร์ที่มี train.csv / val.csv")
    ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--max-len", type=int, default=96)
    ap.add_argument("--synthetic-weight", type=int, default=2, help="ทำซ้ำข้อมูล synthetic กี่เท่าในแต่ละ epoch (ข้อมูลน้อยกว่าแหล่งอื่นมาก)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}", flush=True)
    tok = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForSequenceClassification.from_pretrained(args.base).to(device)
    assert model.config.num_labels == 3, "โมเดลตั้งต้นต้องเป็น 3 คลาส"

    train_rows = read(os.path.join(args.data, "train.csv"))
    val_rows = read(os.path.join(args.data, "val.csv"))
    train_rows = [r for r in train_rows for _ in range(args.synthetic_weight if r["source"] == "synthetic" else 1)]

    def collate(batch):
        enc = tok([r["text"] for r in batch], truncation=True, max_length=args.max_len, padding=True, return_tensors="pt")
        enc["labels"] = torch.tensor([LABEL2ID[r["label"]] for r in batch])
        return enc

    train_dl = DataLoader(train_rows, batch_size=args.batch, shuffle=True, collate_fn=collate)
    val_dl = DataLoader(val_rows, batch_size=32, shuffle=False, collate_fn=collate)

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total = len(train_dl) * args.epochs
    sched = get_linear_schedule_with_warmup(opt, int(total * 0.06), total)

    def evaluate() -> float:
        model.eval()
        golds, preds = [], []
        with torch.no_grad():
            for b in val_dl:
                b = b.to(device)
                labels = b.pop("labels")
                preds += model(**b).logits.argmax(-1).tolist()
                golds += labels.tolist()
        model.train()
        return macro_f1(golds, preds)

    best = evaluate()
    print(f"val macro-F1 ก่อนเทรน (v2): {best:.3f}  · train {len(train_rows)} แถว · {total} steps", flush=True)
    model.save_pretrained(args.out)
    tok.save_pretrained(args.out)

    model.train()
    step, t0 = 0, time.time()
    for epoch in range(args.epochs):
        for b in train_dl:
            b = b.to(device)
            loss = model(**b).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            opt.zero_grad()
            step += 1
            if step % 25 == 0:
                rate = (time.time() - t0) / step
                print(f"epoch {epoch + 1} step {step}/{total} loss {loss.item():.3f} · เหลือ ~{(total - step) * rate / 60:.0f} นาที", flush=True)
        f1 = evaluate()
        print(f"epoch {epoch + 1}: val macro-F1 {f1:.3f}", flush=True)
        if f1 > best:
            best = f1
            model.save_pretrained(args.out)
            tok.save_pretrained(args.out)
            print(f"  บันทึก checkpoint ที่ {args.out}", flush=True)

    print(f"เสร็จ — val macro-F1 ดีที่สุด {best:.3f}", flush=True)


if __name__ == "__main__":
    main()
