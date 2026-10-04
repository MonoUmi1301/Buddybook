/**
 * gap 3.5 — "Social listening ภายในแพลตฟอร์ม": คำที่ผู้อ่านพูดถึงบ่อยในคอมเมนต์/รีวิว แยกฝั่งบวก/ลบ
 * ตัดคำไทยด้วย Intl.Segmenter (ICU ใน Node — ไม่ต้องพึ่ง Python/PyThaiNLP บน hot path ของ API)
 * ความแม่นยำการตัดคำด้อยกว่า PyThaiNLP เล็กน้อย พอสำหรับภาพรวมว่าผู้อ่านพูดถึงอะไร ไม่ใช่งาน NLP เต็มรูป
 */

// คำเชื่อม/คำลงท้าย/คำทั่วไปที่ไม่บอกอะไรเกี่ยวกับเนื้อหา
const STOPWORDS = new Set(
  (
    "และ หรือ แต่ ที่ ซึ่ง อัน ของ ใน บน กับ จาก ถึง แล้ว ก็ จะ ได้ ให้ ไป มา อยู่ คือ เป็น มี ไม่ ไม่ได้ " +
    "นี้ นั้น โน้น นะ คะ ค่ะ ครับ จ้า จ้ะ ฮะ อ่ะ อะ เลย มาก มากๆ จัง ด้วย อีก ยัง เพราะ ว่า เมื่อ ถ้า " +
    "ทำ ทำให้ ตอน เรื่อง นิยาย อ่าน คน เรา ผม ฉัน เค้า เขา เธอ มัน พวก การ ความ กว่า เท่า แค่ ทุก บาง " +
    "ตัว นึง หนึ่ง อัน ชิ้น ขอ ช่วย กัน เอง สุด ๆ อยาก รู้สึก คิด ดู นิด หน่อย เยอะ จริง จริงๆ ก่อน หลัง ใช่ หรอ เหรอ ไหม มั้ย " +
    "the a an and or but is are was were to of in on for it this that with be have has i you he she they we"
  ).split(/\s+/)
);

// คำเฉพาะวงการนิยายที่ ICU ตัดผิดบ่อย (เช่น "พล็อตมาก" → "พล็อ|ตมาก") — แยกออกเป็นคำเดี่ยวก่อนส่งให้ ICU
// แนวคิดเดียวกับ custom_dict ของ PyThaiNLP; เรียงยาวไปสั้นเพื่อให้ "ตัวละครหลัก" ชนะ "ตัวละคร"
const DOMAIN_TERMS = [
  "ตัวละครหลัก", "ตัวละคร", "นางเอก", "พระเอก", "ตัวร้าย", "ตัวประกอบ", "พล็อต", "เนื้อเรื่อง", "ตอนจบ", "ฉากจบ",
  "ปมเรื่อง", "หักมุม", "ฟินมาก", "ฟิน", "ดราม่า", "แฟนตาซี", "โรแมนติก", "สำนวน", "ภาษาสวย", "บรรยาย", "ไรท์",
  "นักเขียน", "อัปเดต", "อัพเดท", "ยืดเยื้อ", "น่าเบื่อ", "น่ารัก", "สนุก", "ซึ้ง", "เศร้า", "ตลก", "คำผิด",
].sort((a, b) => b.length - a.length);
const DOMAIN_SET = new Set(DOMAIN_TERMS);
const DOMAIN_RE = new RegExp(`(${DOMAIN_TERMS.join("|")})`, "g");

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("th", { granularity: "word" }) : null;

export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
}

/** แยกคำ (ตัว ๆ ซ้ำและเครื่องหมายทิ้ง, ตัวพิมพ์เล็ก, ยาว ≥ 2 ตัวอักษร, ไม่ใช่ stopword/ตัวเลข) */
export function tokenize(text: string): string[] {
  const clean = stripHtml(text).toLowerCase().replace(/ๆ/g, " ");
  // คำในพจนานุกรมเก็บไว้ทั้งคำ ส่วนที่เหลือเท่านั้นที่ส่งให้ ICU ตัด (ICU ตัดซ้ำ "น่ารัก" → "น่า|รัก" แม้เว้นวรรคไว้แล้ว)
  const words: string[] = [];
  for (const part of clean.split(DOMAIN_RE)) {
    if (!part) continue;
    if (DOMAIN_SET.has(part)) {
      words.push(part);
    } else if (segmenter) {
      for (const seg of segmenter.segment(part)) if (seg.isWordLike) words.push(seg.segment.trim());
    } else {
      words.push(...part.split(/[^\p{L}\p{M}\p{N}]+/u));
    }
  }
  return words.filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export interface KeywordCount {
  term: string;
  count: number;
}

/** นับคำที่พบใน "จำนวนข้อความ" (คำซ้ำในข้อความเดียวนับครั้งเดียว — กันคนพิมพ์คำเดิมรัว ๆ ครองอันดับ) */
export function topKeywords(texts: string[], limit = 12, minCount = 2): KeywordCount[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    for (const w of new Set(tokenize(t))) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}
