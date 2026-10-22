"""
BuddyBook NLP Worker — ปรับผลตาม "เป้าหมาย" ของความรู้สึก (ตัวละคร vs ตัวงาน)

ปัญหา: โมเดล 3 คลาสอ่าน "เกลียดนางร้าย" / "น็อกซ์น่าสงสาร" เป็นลบ ทั้งที่ผู้อ่านอินกับเรื่อง (= ชอบงาน)
บนชุดทดสอบแยก (eval/test_set.csv) v2 ทายประเภท "ด่าตัวละครเพราะอิน" ถูก 0/25

วิธี: กฎหลังโมเดล (ไม่เพิ่มคลาสใหม่ ไม่แตะ schema — label ยังเป็น pos/neg/neutral ตามสเปก)
  ถ้าโมเดลทาย neg และข้อความ "ไม่ได้ติตัวงาน" (ไม่มีคำวิจารณ์งานเขียน/การอัพ/ความคุ้มค่า)
  แต่ "พุ่งไปที่ตัวละคร" (คำเรียกบทบาท เช่น ตัวร้าย/พระเอก หรือชื่อตัวละครของนิยายเรื่องนั้น)
  หรือมีคำที่บอกว่าอินจัด (ร้องไห้ ใจสลาย แค้นแทน ฯลฯ) → นับเป็น pos ขั้วกลาง ๆ (อินกับเรื่อง ≠ ชอบสุด ๆ)

คำว่า "สนุก" ไม่นับเป็นสัญญาณอิน — ประโยคประชด ("สนุกจังเลย หลับไปสามรอบ") ใช้คำนี้บ่อย
ปรับคำในลิสต์ได้ แต่ต้องวัดผลด้วย eval/evaluate.py (dev_set สำหรับจูน, test_set สำหรับรายงาน) ทุกครั้ง
"""

import re
from dataclasses import dataclass

# คำเรียกบทบาท/ตัวละคร — ผู้อ่านไทยมักเรียกตัวละครตามบทบาทแทนชื่อ
CHARACTER_ROLE_WORDS = [
    "ตัวร้าย", "นางร้าย", "ตัวโกง", "พระเอก", "นางเอก", "พระรอง", "นางรอง", "ตัวละคร", "ตัวประกอบ",
    "แม่เลี้ยง", "พ่อเลี้ยง", "แม่สามี", "พ่อสามี", "ฝ่ายร้าย", "ตัวปัญหา", "พี่ชายนางเอก", "น้องสาวนางเอก",
    "พ่อนางเอก", "แม่นางเอก", "พ่อพระเอก", "แม่พระเอก", "เพื่อนสนิท", "ผี",
]
# คำนำหน้าเรียกตัวละครแบบด่า ๆ ("ยัยลิเลีย", "อีนางร้าย", "ไอ้ตัวร้าย") — ต้องตามด้วยคำ ไม่ใช่ลงท้าย
# ไม่ใช้ "อี" เดี่ยว ๆ เพราะชนกับ "อีก"
CHARACTER_PREFIX = re.compile(r"(ยัย|อีนาง|อีนี่|ไอ้)(?=\S)")

# คำที่บอกว่าวิจารณ์ "ตัวงาน" — มีคำพวกนี้ = ลบจริง ห้ามพลิก
WORK_CRITICISM_WORDS = [
    "คำผิด", "พิมพ์ผิด", "พล็อต", "ภาษา", "สำนวน", "บรรยาย", "เขียนไม่", "เขียนแย่", "เขียนห่วย", "เขียนไม่ถึง",
    "ดอง", "อัพช้า", "ปีละ", "แปล", "ก๊อป", "ลอกมา", "ลอกงาน", "ลอกเลียน", "ลอกฉาก", "เอาฉากมา", "ยืด", "น่าเบื่อ", "ไม่สนุก", "เลิกอ่าน",
    "ไม่ตาม", "เสียเวลา", "เสียดาย", "ไม่คุ้ม", "ตัดจบ", "รีบจบ", "รีบปิด", "จบห่วย", "ห่วย", "ไม่ให้ดาว",
    "อ่านยาก", "วกวน", "ซ้ำซาก", "แบน", "ไม่มีมิติ", "ไม่สมเหตุสมผล", "ไม่มีเหตุผล", "ไม่สม่ำเสมอ",
    # "หลับ" เฉย ๆ ชนกับ "นอนไม่หลับ" (อินจนนอนไม่หลับ = บวก) — ใช้เฉพาะแบบที่บอกว่าเบื่อจนหลับ
    "เกินจริง", "หลับไป", "อ่านแล้วหลับ", "หลับคา", "ง่วง", "ประชด", "อ่านไม่รู้เรื่อง", "ทิ้งคนอ่าน", "เสียความรู้สึก", "เสียอรรถรส",
    "ไม่โอเค", "รวบรัด", "ข้ามฉาก", "ไม่ไปไหน", "เหนื่อย",
]

# คำที่บอกว่าผู้อ่าน "อิน" จัด — ความรู้สึกแรงต่อเหตุการณ์ในเรื่อง ไม่ใช่ต่องาน
IMMERSION_WORDS = [
    "อิน", "ร้องไห้", "น้ำตา", "ใจสลาย", "ใจจะขาด", "ใจหาย", "แค้นแทน", "เจ็บแทน", "โมโหแทน", "สงสาร",
    "ขนลุก", "หลอน", "สะใจ", "บีบหัวใจ", "สะเทือนใจ", "ใจเต้น", "ช็อก", "วางไม่ลง", "ติดงอมแงม",
    "รอตอนต่อไป", "ลุ้น", "เขียนเก่ง", "เขียนดี", "บรรยายดี", "ความดันขึ้น", "ของขึ้น", "หัวร้อน",
    "ทำใจไม่ได้", "เจ็บจี๊ด",
]

# ขั้วที่ให้หลังพลิก — อินกับเรื่องคือสัญญาณบวก แต่ไม่แรงเท่าคำชมตรง ๆ
IMMERSION_POLARITY = 0.5


# คำชมฝีมือเขียน — อยู่ใน IMMERSION_WORDS เพื่อช่วยกฎพลิก แต่ตอนติดป้ายนับเป็น "งานเขียน" ไม่ใช่ "อินกับเรื่อง"
WRITING_PRAISE_WORDS = ["เขียนเก่ง", "เขียนดี", "บรรยายดี"]

# คำที่พูดถึงตัวงานเพิ่มเติม ใช้ตอนติดป้ายเท่านั้น — ไม่เพิ่มใน WORK_CRITICISM_WORDS เพราะกฎพลิก (v2) วัดผลไว้กับลิสต์เดิม
# (เพิ่มแล้วตัวเลข v2 + กฎใน docs/evaluation.md จะเปลี่ยน)
WORK_TAG_EXTRA_WORDS = ["คำซ้ำ", "ใช้คำซ้ำ", "ประโยคซ้ำ", "ตรวจทาน", "ตรวจคำ", "เรียบเรียง", "การเว้นวรรค", "ย่อหน้า"]

# ป้ายเป้าหมายของความรู้สึก (ไม่เปลี่ยน label ของโมเดล) — เก็บลง comments/reviews.sentiment_target
#   character = พูดถึงตัวละคร (ชื่อ/บทบาท/ยัย-ไอ้)   immersion = อินกับเหตุการณ์ในเรื่อง
#   work      = พูดถึงตัวงานเขียน (ชมหรือติก็ได้)     None = ระบุไม่ได้
TARGET_CHARACTER = "character"
TARGET_IMMERSION = "immersion"
TARGET_WORK = "work"


def classify_targets(text: str, character_names: list[str] | None = None) -> list[str]:
    """ความรู้สึกในข้อความพุ่งไปที่อะไรบ้าง — ได้หลายป้าย เช่นรีวิวที่ทั้งชมนางเอกและติคำซ้ำ = [character, work]
    เรียงตามลำดับ ตัวละคร, อินกับเรื่อง, ตัวงาน (ว่าง = ระบุไม่ได้)"""
    tags: list[str] = []
    names = [n.strip() for n in (character_names or []) if n and len(n.strip()) >= 2]
    if _contains_any(text, names) or _contains_any(text, CHARACTER_ROLE_WORDS) or CHARACTER_PREFIX.search(text):
        tags.append(TARGET_CHARACTER)
    immersion = [w for w in IMMERSION_WORDS if w not in WRITING_PRAISE_WORDS]
    if _contains_any(text, immersion):
        tags.append(TARGET_IMMERSION)
    if _contains_any(text, WORK_CRITICISM_WORDS + WORK_TAG_EXTRA_WORDS + WRITING_PRAISE_WORDS):
        tags.append(TARGET_WORK)
    return tags


def classify_target(text: str, character_names: list[str] | None = None) -> str | None:
    """ป้ายหลักป้ายเดียว (ตัวแรกของ classify_targets) — คงไว้ให้โค้ด/สคริปต์วัดผลรุ่นเดิม"""
    tags = classify_targets(text, character_names)
    return tags[0] if tags else None


@dataclass
class TargetDecision:
    flipped: bool
    reason: str = ""


def _contains_any(text: str, words: list[str]) -> str | None:
    for w in words:
        if w in text:
            return w
    return None


def decide(text: str, label: str, character_names: list[str] | None = None) -> TargetDecision:
    """คืนว่าควรพลิกผล neg → pos หรือไม่ (เรียกเฉพาะตอนโมเดลทาย neg)"""
    if label != "neg":
        return TargetDecision(False)

    critic = _contains_any(text, WORK_CRITICISM_WORDS)
    if critic:
        return TargetDecision(False, f"วิจารณ์งาน ({critic})")

    names = [n.strip() for n in (character_names or []) if n and len(n.strip()) >= 2]
    name = _contains_any(text, names)
    if name:
        return TargetDecision(True, f"ชื่อตัวละคร ({name})")

    role = _contains_any(text, CHARACTER_ROLE_WORDS)
    if role:
        return TargetDecision(True, f"บทบาทตัวละคร ({role})")

    if CHARACTER_PREFIX.search(text):
        return TargetDecision(True, "เรียกตัวละคร (ยัย/อี/ไอ้)")

    cue = _contains_any(text, IMMERSION_WORDS)
    if cue:
        return TargetDecision(True, f"อินกับเรื่อง ({cue})")

    return TargetDecision(False)
