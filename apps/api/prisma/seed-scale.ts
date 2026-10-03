/**
 * BuddyBook — ข้อมูลจำลองขนาดใหญ่ที่เลียนแบบพฤติกรรมผู้ใช้จริง (สำหรับทดลองระบบแนะนำ / threshold)
 *
 * ค่าเริ่มต้น: นักอ่าน 3,000 คน, นักเขียน 200 คน, นิยาย 800 เรื่อง, ช่วงเวลา 18 เดือน
 *
 * รูปแบบที่จำลอง (เพื่อให้ collaborative filtering มีสัญญาณจริงให้จับ):
 *   - ความนิยมของนิยายเป็น long-tail: ไม่กี่เรื่องดังมาก ส่วนใหญ่มีคนอ่านไม่มาก (Zipf)
 *   - ผู้ใช้แต่ละคนชอบแนวหลัก 1-2 แนวเป็นพิเศษ และมีคู่ความสัมพันธ์ (BL/GL/...) ที่ชอบ
 *   - จำนวนเรื่องที่อ่านต่อคนเป็น long-tail: ส่วนใหญ่อ่านไม่กี่เรื่อง บางคนอ่านเป็นร้อย มีคนสมัครแล้วไม่อ่านด้วย
 *   - คะแนนรีวิว = คุณภาพเรื่อง + ความตรงรสนิยม + noise  (คนชอบแนวเดียวกันจึงให้คะแนนไปทางเดียวกัน)
 *   - ทุก interaction มีเวลา และเกิดหลังวันที่ผู้ใช้สมัครและหลังวันที่นิยายเปิดตัว (แบ่ง train/test ตามเวลาได้)
 *
 * วิธีรัน (ใน apps/api, ต้องรัน seed.ts หลักก่อนเพื่อให้มีแท็ก):
 *   npx tsx prisma/seed-scale.ts --dry-run          # สร้างข้อมูลในหน่วยความจำ พิมพ์สถิติ ไม่แตะฐานข้อมูล
 *   npx tsx prisma/seed-scale.ts                     # เขียนลงฐานข้อมูล (ลบชุด @scale.buddybook.local เดิมก่อน)
 *   npx tsx prisma/seed-scale.ts --users 5000 --novels 1200 --seed 7
 *
 * - รันซ้ำได้ ผลเหมือนเดิมทุกครั้งเมื่อใช้ --seed เดิม
 * - ไม่แตะผู้ใช้จริง / mock / demo (ระบุชุดนี้จากอีเมล @scale.buddybook.local)
 * - id ทุกตัวสร้างฝั่งสคริปต์ด้วย UUID เพื่อใช้ createMany แบบ batch ได้
 * - ข้อมูลใน Neo4j ไม่ถูกสร้างที่นี่ ต้องรัน sync ของระบบหลังจากนี้
 */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// ตั้งค่า
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name: string, def: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : def;
};
const CFG = {
  readers: arg("users", 3000),
  authors: arg("authors", 200),
  novels: arg("novels", 800),
  seed: arg("seed", 42),
  days: 540, // อายุแพลตฟอร์มจำลอง (วัน)
  reviewRate: 0.3, // โอกาสที่คนอ่านจะเขียนรีวิว (ปรับได้)
  commentRate: 0.08, // โอกาสที่คนอ่านจะคอมเมนต์อย่างน้อย 1 ตอน
  inactiveShare: 0.08, // สัดส่วนคนสมัครแล้วแทบไม่อ่าน
};
const DRY_RUN = argv.includes("--dry-run");
const EXPORT = argv.includes("--export-csv"); // เขียน scale-interactions.csv สำหรับทดลองนอกฐานข้อมูล
const DOMAIN = "scale.buddybook.local";

// ---------------------------------------------------------------------------
// สุ่มแบบกำหนด seed ได้
// ---------------------------------------------------------------------------
let s = CFG.seed >>> 0;
const rand = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const pickW = <T,>(xs: readonly T[], w: readonly number[]): T => {
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < xs.length; i++) if ((r -= w[i]) <= 0) return xs[i];
  return xs[xs.length - 1];
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const DAY = 86_400_000;
const NOW = Date.now();
const START = NOW - CFG.days * DAY;
const at = (dayOffset: number) => new Date(START + dayOffset * DAY);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// ---------------------------------------------------------------------------
// คลังคำ (แท็กต้องตรงกับ seed.ts หลัก)
// ---------------------------------------------------------------------------
type Genre = { main: string; subs: string[]; weight: number; nouns: string[]; hooks: string[] };
const GENRES: Genre[] = [
  { main: "แฟนตาซี", subs: ["เกิดใหม่/ต่างโลก", "กำลังภายใน/ยุทธภพ", "โรงเรียนเวทมนตร์", "เกมออนไลน์/ระบบ"], weight: 2.2,
    nouns: ["จอมเวท", "มังกร", "อาณาจักร", "ดาบ", "หอคอย", "ผู้กล้า", "จักรพรรดิ", "เทพธิดา", "ระบบ", "ยุทธภพ"],
    hooks: ["ตื่นมาในโลกที่ไม่รู้จัก", "ได้รับพลังที่ไม่มีใครต้องการ", "ต้องปกป้องอาณาจักรที่กำลังล่มสลาย", "ถูกระบบลึกลับเลือกให้เป็นผู้ทดสอบ"] },
  { main: "โรแมนติก", subs: ["รักหวานแหวว", "ดราม่า", "แอบรัก", "สัญญาหมั้นหมาย"], weight: 2.5,
    nouns: ["หัวใจ", "สัญญา", "คู่หมั้น", "รักแรก", "คุณชาย", "เจ้าสาว", "ดอกไม้", "จดหมาย", "ฤดูร้อน", "คำสารภาพ"],
    hooks: ["ต้องแต่งงานกับคนที่ไม่เคยเจอ", "แอบรักเพื่อนสนิทมาสิบปี", "เซ็นสัญญาเป็นแฟนปลอมร้อยวัน", "กลับมาเจอรักแรกในวันที่ทุกอย่างเปลี่ยนไป"] },
  { main: "สืบสวน & ระทึกขวัญ", subs: ["ไขคดี/ฆาตกรรม", "ชิงไหวชิงพริบ", "เอาชีวิตรอด"], weight: 1.2,
    nouns: ["คดี", "ห้องปิดตาย", "พยาน", "ฆาตกร", "เบาะแส", "รหัสลับ", "เกาะร้าง", "เงามืด", "นักสืบ", "คืนสุดท้าย"],
    hooks: ["พบศพในห้องที่ล็อกจากด้านใน", "ได้รับจดหมายเตือนก่อนเกิดเหตุ", "ติดอยู่บนเกาะกับฆาตกรหนึ่งคน", "ต้องไขคดีให้ได้ก่อนรุ่งเช้า"] },
  { main: "สยองขวัญ", subs: ["เรื่องเล่าสยองขวัญ", "ไสยศาสตร์", "สิ่งลึกลับ"], weight: 0.9,
    nouns: ["บ้านร้าง", "ตุ๊กตา", "ป่าช้า", "กระจก", "เสียงเคาะ", "คำสาป", "หิ้งบูชา", "เงา", "คืนวันพระ", "ศาลเพียงตา"],
    hooks: ["ย้ายเข้าบ้านที่ไม่มีใครอยู่ได้นาน", "ได้ยินเสียงเรียกชื่อตอนตีสาม", "เปิดกล่องที่ยายห้ามเปิด", "ถ่ายรูปแล้วเห็นคนที่ไม่ควรอยู่ตรงนั้น"] },
  { main: "ไซไฟ", subs: ["ล้ำยุค/หุ่นยนต์", "วันสิ้นโลก", "อวกาศ"], weight: 0.8,
    nouns: ["สถานีอวกาศ", "หุ่นยนต์", "สัญญาณ", "อนาคต", "ดาวเคราะห์", "ปัญญาประดิษฐ์", "เมืองใต้ดิน", "ยานสำรวจ", "ไวรัส", "เวลา"],
    hooks: ["ได้รับข้อความจากอนาคต", "ตื่นมาเป็นมนุษย์คนสุดท้าย", "หุ่นยนต์เริ่มมีความฝัน", "ต้องพาคนรอดจากเมืองที่กำลังจม"] },
  { main: "ชีวิตประจำวัน & ดราม่า", subs: ["ตลกขบขัน", "สโลว์ไลฟ์", "สะท้อนสังคม"], weight: 1.1,
    nouns: ["ร้านกาแฟ", "บ้านเกิด", "แมว", "หอพัก", "ครอบครัว", "ตลาดเช้า", "สวนผัก", "เพื่อนร่วมห้อง", "ฝนตก", "วันธรรมดา"],
    hooks: ["ลาออกจากงานแล้วกลับบ้านเกิด", "เปิดร้านเล็ก ๆ ที่มีแต่ลูกค้าแปลก ๆ", "ต้องอยู่ร่วมห้องกับคนที่ไม่ถูกกัน", "เริ่มต้นใหม่ในวัยสามสิบ"] },
  { main: "ประวัติศาสตร์", subs: ["จีนโบราณ", "ไทยพีเรียด", "ยุโรปโบราณ"], weight: 1.0,
    nouns: ["วังหลวง", "องครักษ์", "พระชายา", "ราชสำนัก", "ขุนนาง", "เรือนไม้สัก", "แม่ทัพ", "พงศาวดาร", "กรุงเก่า", "ราชวงศ์"],
    hooks: ["ข้ามเวลาไปอยู่ในร่างขุนนางชั้นผู้น้อย", "ถูกส่งเข้าวังเป็นสนมที่ไม่มีใครสนใจ", "ต้องเลือกระหว่างหน้าที่กับหัวใจ", "รู้ว่าราชวงศ์จะล่มในอีกสามปี"] },
];
const PAIRINGS = ["ชายรักชาย (BL)", "หญิงรักหญิง (GL)", "ชายหญิง (Straight)", "ความสัมพันธ์หลากหลาย (LGBTQ+)", "ไม่เน้นความสัมพันธ์ (Gen)"];
const PAIRING_W = [2.0, 0.8, 2.4, 0.3, 1.2];
const FREEFORM = ["#เกิดใหม่", "#ระบบ", "#ต่างโลก", "#แก้แค้น", "#ฟีลกู้ด", "#ดราม่าตับพัง", "#คอมเมดี้", "#ทีมเวิร์ก", "#ลึกลับ", "#สงคราม", "#โรงเรียน", "#ราชวงศ์"];
const FANDOMS = ["Jujutsu Kaisen (มหาเวทย์ผนึกมาร)", "Harry Potter (แฮร์รี่ พอตเตอร์)"];
const NAME_A = ["ภู", "ธาร", "แพร", "ฟ้า", "ดาว", "ตะวัน", "พิม", "กาย", "นิล", "เมฆ", "ใบ", "ข้าว", "ปราง", "ภัทร", "วิน", "มิ้นท์", "กันต์", "ณัฐ", "ไอริน", "เจ", "หลิน", "เซียว", "หยาง", "อลิส", "เอเดน"];
const NAME_B = ["", "รินทร์", "วา", "ธิดา", "พล", "ภพ", "ฤทัย", "นภา", "กร", "ดา", "เทพ", "พร"];
const TITLE_PATTERNS = ["{n}แห่ง{m}", "{h}", "บันทึก{n}", "{n}กับ{m}", "เมื่อ{n}ไม่ใช่{m}", "{n}ที่หายไป", "ตำนาน{n}", "{n}ร้อยวัน", "ย้อนรอย{n}", "{n}ของฉัน"];
const REVIEW_TEXT: Record<number, string[]> = {
  5: ["ชอบมาก อ่านรวดเดียวจบ", "คาแรกเตอร์มีมิติมาก ตามต่อแน่นอน", "ดีที่สุดที่อ่านปีนี้", "เขียนดีมาก ภาษาสวย"],
  4: ["สนุกดี บางช่วงยืดไปนิด", "พล็อตดี รอตอนต่อไป", "ชอบตัวรองมากกว่าพระเอกอีก", "อ่านเพลิน แนะนำ"],
  3: ["พออ่านได้ ยังไม่ค่อยอิน", "เปิดเรื่องดีแต่กลางเรื่องแผ่ว", "พล็อตคุ้น ๆ แต่ก็โอเค"],
  2: ["ช้าไปหน่อย ไม่ค่อยเข้าทาง", "ตัวละครทำอะไรไม่ค่อยสมเหตุผล"],
  1: ["ไม่ใช่แนว อ่านไม่จบ", "ผิดหวัง เปิดเรื่องดีแต่หลุดโฟกัส"],
};
const COMMENT_POS = ["ตอนนี้ดีมาก", "รอตอนต่อไปค่ะ", "ฉากนี้ทำใจสั่น", "555 ขำมาก", "ร้องไห้หนักมาก", "ขอบคุณที่อัปนะคะ"];
const COMMENT_NEU = ["ปมนี้น่าจะเฉลยตอนท้าย", "สงสัยตัวร้ายตัวจริงคือใคร", "ตอนนี้สั้นไปนิด"];
const COMMENT_NEG = ["งงตรงนี้นิดหน่อย", "ทำไมพระเอกทำแบบนั้น", "เดาทางได้แล้ว"];

const charName = () => pick(NAME_A) + pick(NAME_B);

// ---------------------------------------------------------------------------
// ชนิดข้อมูลที่สร้าง
// ---------------------------------------------------------------------------
type UserRow = {
  user_id: string; username: string; pen_name: string | null; email: string; oauth_provider: "google"; oauth_id: string;
  bio: string | null; age_verified: boolean; created_at: Date;
};
type NovelRow = {
  novel_id: string; author_id: string; title: string; synopsis: string; introduction: string; cover_image_url: string;
  status: "ongoing" | "completed" | "hiatus"; legal_status: "original" | "fan_fiction"; visibility: "published";
  format: "multi_chapter" | "one_shot"; content_rating: "all_ages" | "teen" | "mature"; view_count: bigint;
  genreMain: string; genreSub: string; created_at: Date; updated_at: Date;
};
type ChapterRow = {
  chapter_id: string; novel_id: string; chapter_number: number; title: string; content: string; status: "published";
  word_count: number; published_at: Date; created_at: Date;
};
type Interaction = { user: number; novel: number; t: number; latent: number; rating: number | null; liked: boolean; chaptersRead: number };

// ---------------------------------------------------------------------------
// สร้างข้อมูล
// ---------------------------------------------------------------------------
function generate() {
  const G = GENRES.length;
  const users: UserRow[] = [];
  const pref: number[][] = [];
  const pairPref: number[][] = [];
  const activity: number[] = [];
  const signupDay: number[] = [];

  const mkUser = (i: number, role: "author" | "reader"): UserRow => {
    const username = `${role === "author" ? "sim_writer" : "sim_reader"}_${String(i).padStart(5, "0")}`;
    const day = rand() * (CFG.days - 20);
    return {
      user_id: randomUUID(), username, email: `${username}@${DOMAIN}`, oauth_provider: "google", oauth_id: `scale-${username}`,
      pen_name: role === "author" || rand() < 0.15 ? `${charName()}${pick(["", "ฟิค", "หมึก", "ราตรี", "นิยาย"])}` : null,
      bio: role === "author" ? `เขียนแนว${pick(GENRES).main}เป็นหลัก` : null, age_verified: rand() < 0.85, created_at: at(day),
    };
  };

  // นักเขียน: ถนัด 1 แนวหลัก
  const authors = Array.from({ length: CFG.authors }, (_, i) => mkUser(i, "author"));
  const authorGenre = authors.map(() => pickW(GENRES.map((_, g) => g), GENRES.map((g) => g.weight)));

  // นักอ่าน: รสนิยม = แนวที่ชอบ 1-2 แนว (log-normal weights) + ความถี่ในการอ่าน (long-tail)
  for (let i = 0; i < CFG.readers; i++) {
    const u = mkUser(i, "reader");
    users.push(u);
    const p = GENRES.map((g) => g.weight * Math.exp(1.6 * normal()));
    const sum = p.reduce((a, b) => a + b, 0);
    pref.push(p.map((x) => x / sum));
    const pp = PAIRING_W.map((w) => w * Math.exp(1.2 * normal()));
    const ps = pp.reduce((a, b) => a + b, 0);
    pairPref.push(pp.map((x) => x / ps));
    activity.push(rand() < CFG.inactiveShare ? Math.floor(rand() * 3) : Math.round(clamp(Math.exp(2.4 + 0.95 * normal()), 3, 250)));
    signupDay.push((u.created_at.getTime() - START) / DAY);
  }

  // นิยาย
  const novels: NovelRow[] = [];
  const novelGenre: number[] = [];
  const novelPair: number[] = [];
  const quality: number[] = [];
  const popularity: number[] = [];
  const novelDay: number[] = [];
  const novelTags: string[][] = [];
  const chapterCount: number[] = [];
  const usedTitles = new Set<string>();
  const ranks = Array.from({ length: CFG.novels }, (_, i) => i + 1).sort(() => rand() - 0.5);

  for (let i = 0; i < CFG.novels; i++) {
    const a = Math.floor(rand() * CFG.authors);
    const g = rand() < 0.75 ? authorGenre[a] : pickW(GENRES.map((_, k) => k), GENRES.map((x) => x.weight));
    const genre = GENRES[g];
    const sub = pick(genre.subs);
    const pi = pickW(PAIRINGS.map((_, k) => k), PAIRING_W);
    const hero = charName();
    let title = "";
    for (let tries = 0; tries < 20 && (!title || usedTitles.has(title)); tries++) {
      title = pick(TITLE_PATTERNS).replace("{n}", pick(genre.nouns)).replace("{m}", pick(genre.nouns)).replace("{h}", `${hero}${pick(genre.hooks)}`);
    }
    if (usedTitles.has(title)) title = `${title} ${i}`;
    usedTitles.add(title);
    const fanfic = rand() < 0.05;
    const day = 5 + rand() * (CFG.days - 30);
    const isOneShot = rand() < 0.06;
    const chapters = isOneShot ? 1 : Math.round(clamp(Math.exp(2.6 + 0.6 * normal()), 3, 60));
    const status = isOneShot ? "completed" : pickW(["ongoing", "completed", "hiatus"] as const, [6, 3, 1]);
    const free = Array.from(new Set([pick(FREEFORM), ...(rand() < 0.6 ? [pick(FREEFORM)] : [])]));
    const created = at(day);
    novels.push({
      novel_id: randomUUID(), author_id: authors[a].user_id, title,
      synopsis: `${hero}${pick(genre.hooks)} เรื่องราว${sub}ที่ว่าด้วย${pick(genre.nouns)}และ${pick(genre.nouns)} ที่จะทำให้คุณวางไม่ลง`,
      introduction: [
        `${hero}ไม่เคยคิดว่าชีวิตจะเปลี่ยนเพราะ${pick(genre.nouns)}เพียงอย่างเดียว จนกระทั่งวันที่${pick(genre.hooks)}`,
        `นิยายแนว${genre.main} (${sub}) ${PAIRINGS[pi]} ${chapters > 1 ? `อัปเดตสัปดาห์ละ ${1 + Math.floor(rand() * 3)} ตอน` : "จบในตอนเดียว"} เหมาะกับคนที่ชอบ${free.join(" ")}`,
      ].join("\n\n"),
      cover_image_url: `https://picsum.photos/seed/buddybook-scale-${i}/400/600`,
      status, legal_status: fanfic ? "fan_fiction" : "original", visibility: "published", format: isOneShot ? "one_shot" : "multi_chapter",
      content_rating: pickW(["all_ages", "teen", "mature"] as const, [5, 4, 1]), view_count: 0n,
      genreMain: genre.main, genreSub: sub, created_at: created, updated_at: created,
    });
    novelGenre.push(g);
    novelPair.push(pi);
    quality.push(normal());
    // long-tail: Zipf ตามอันดับ x คุณภาพ
    popularity.push(Math.pow(ranks[i], -0.9) * Math.exp(0.5 * quality[i]));
    novelDay.push(day);
    novelTags.push([genre.main, sub, PAIRINGS[pi], ...free, ...(fanfic ? [pick(FANDOMS)] : [])]);
    chapterCount.push(chapters);
  }

  // การอ่าน: เลือกเรื่องแบบถ่วงน้ำหนัก (ไม่ซ้ำ) ด้วย Efraimidis–Spirakis
  const interactions: Interaction[] = [];
  for (let u = 0; u < CFG.readers; u++) {
    const k = activity[u];
    if (k === 0) continue;
    const keys: [number, number][] = [];
    for (let n = 0; n < CFG.novels; n++) {
      if (novelDay[n] > CFG.days - 1) continue;
      const w = popularity[n] * Math.pow(pref[u][novelGenre[n]], 1.3) * Math.pow(pairPref[u][novelPair[n]], 0.8);
      keys.push([Math.pow(rand(), 1 / w), n]);
    }
    keys.sort((a, b) => b[0] - a[0]);
    for (const [, n] of keys.slice(0, k)) {
      const from = Math.max(signupDay[u], novelDay[n]);
      const t = from + rand() * (CFG.days - from);
      // ความพอใจแฝง: คุณภาพ + ตรงแนวที่ชอบ + noise
      const fit = Math.log(pref[u][novelGenre[n]] * G) * 0.55 + Math.log(pairPref[u][novelPair[n]] * PAIRINGS.length) * 0.3;
      const latent = 0.55 * quality[n] + fit + 0.6 * normal();
      interactions.push({ user: u, novel: n, t, latent, rating: null, liked: false, chaptersRead: 1 });
    }
  }
  // ปรับ latent เป็น z-score แล้วแปลงเป็นพฤติกรรม ให้สัดส่วนดาวใกล้เว็บรีวิวหนังสือจริง (เฉลี่ยราว 3.9)
  const mean = interactions.reduce((a, x) => a + x.latent, 0) / interactions.length;
  const sd = Math.sqrt(interactions.reduce((a, x) => a + (x.latent - mean) ** 2, 0) / interactions.length);
  for (const x of interactions) {
    const z = (x.latent - mean) / sd;
    x.latent = z;
    const rating = clamp(Math.round(3.85 + 0.95 * z), 1, 5);
    const writes = rand() < CFG.reviewRate * (rating === 5 || rating <= 2 ? 1.3 : 0.85);
    x.rating = writes ? rating : null;
    x.liked = rand() < sigmoid(1.6 * z - 0.5);
    x.chaptersRead = Math.max(1, Math.round(chapterCount[x.novel] * clamp(sigmoid(1.4 * z + 0.6) + 0.15 * normal(), 0.05, 1)));
  }
  interactions.sort((a, b) => a.t - b.t);

  // จำนวนวิวและวันที่อัปเดต
  const readers = new Array(CFG.novels).fill(0);
  for (const it of interactions) readers[it.novel]++;
  novels.forEach((n, i) => {
    n.view_count = BigInt(Math.round(readers[i] * (25 + rand() * 60) + rand() * 40));
    n.updated_at = at(Math.min(CFG.days - 0.5, novelDay[i] + chapterCount[i] * (2 + rand() * 6)));
  });

  // ตอน
  const chapters: ChapterRow[] = [];
  const chapterIdOf: string[][] = [];
  novels.forEach((n, i) => {
    const g = GENRES[novelGenre[i]];
    const ids: string[] = [];
    const span = (n.updated_at.getTime() - n.created_at.getTime()) / Math.max(1, chapterCount[i]);
    for (let c = 1; c <= chapterCount[i]; c++) {
      const paras = Array.from({ length: 3 }, () => `<p>${charName()}มองไปที่${pick(g.nouns)}อยู่นาน ก่อนจะตัดสินใจว่า${pick(g.hooks)}อาจไม่ใช่เรื่องบังเอิญ</p>`).join("");
      const when = new Date(n.created_at.getTime() + span * (c - 1));
      const id = randomUUID();
      ids.push(id);
      chapters.push({ chapter_id: id, novel_id: n.novel_id, chapter_number: c, title: chapterCount[i] === 1 ? n.title : `ตอนที่ ${c} ${pick(g.nouns)}`,
        content: paras, status: "published", word_count: 1200 + Math.floor(rand() * 2400), published_at: when, created_at: when });
    }
    chapterIdOf.push(ids);
  });

  // ตัวละคร (3-5 ต่อเรื่อง) + ความสัมพันธ์
  const nodes: { node_id: string; novel_id: string; character_name: string; description: string; character_role: "protagonist" | "supporting" | "antagonist"; position_x: number; position_y: number }[] = [];
  const edges: { novel_id: string; source_node_id: string; target_node_id: string; relationship_type: string; edge_label: string }[] = [];
  novels.forEach((n, i) => {
    const g = GENRES[novelGenre[i]];
    const count = 3 + Math.floor(rand() * 3);
    const romance = PAIRINGS[novelPair[i]] !== "ไม่เน้นความสัมพันธ์ (Gen)";
    const ids: string[] = [];
    for (let c = 0; c < count; c++) {
      const role = c === 0 || (c === 1 && romance) ? "protagonist" : c === count - 1 && rand() < 0.7 ? "antagonist" : "supporting";
      const id = randomUUID();
      ids.push(id);
      nodes.push({ node_id: id, novel_id: n.novel_id, character_name: charName(), character_role: role,
        description: role === "antagonist" ? `ผู้อยู่เบื้องหลัง${pick(g.nouns)}` : `ตัวละครที่ผูกพันกับ${pick(g.nouns)}`,
        position_x: Math.round(Math.cos((2 * Math.PI * c) / count) * 220), position_y: Math.round(Math.sin((2 * Math.PI * c) / count) * 220) });
    }
    if (romance) edges.push({ novel_id: n.novel_id, source_node_id: ids[0], target_node_id: ids[1], relationship_type: "love", edge_label: "คนรัก" });
    for (let c = romance ? 2 : 1; c < count; c++) {
      const anta = nodes[nodes.length - count + c].character_role === "antagonist";
      edges.push({ novel_id: n.novel_id, source_node_id: ids[0], target_node_id: ids[c], relationship_type: anta ? "rival" : pick(["friend", "family", "mentor"]), edge_label: anta ? "ศัตรู" : "คนใกล้ตัว" });
    }
  });

  return { users, authors, novels, chapters, chapterIdOf, novelTags, interactions, nodes, edges, pref };
}

// ---------------------------------------------------------------------------
// สถิติ (ใช้ตรวจว่าข้อมูลสมจริงก่อนเขียนลงฐาน)
// ---------------------------------------------------------------------------
function report(d: ReturnType<typeof generate>) {
  const per = new Array(CFG.readers).fill(0);
  const perNovel = new Array(CFG.novels).fill(0);
  for (const it of d.interactions) { per[it.user]++; perNovel[it.novel]++; }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
  const reviews = d.interactions.filter((x) => x.rating !== null);
  const hist = [1, 2, 3, 4, 5].map((r) => reviews.filter((x) => x.rating === r).length);
  const top10 = [...perNovel].sort((a, b) => b - a).slice(0, Math.ceil(CFG.novels * 0.1)).reduce((a, b) => a + b, 0);
  const revPer = new Array(CFG.readers).fill(0);
  for (const r of reviews) revPer[r.user]++;
  console.log(`ผู้ใช้ ${CFG.readers + CFG.authors} (นักอ่าน ${CFG.readers}, นักเขียน ${CFG.authors}) | นิยาย ${CFG.novels} | ตอน ${d.chapters.length} | ตัวละคร ${d.nodes.length}`);
  console.log(`การอ่าน (ชั้นหนังสือ) ${d.interactions.length} | รีวิว ${reviews.length} | ถูกใจ ${d.interactions.filter((x) => x.liked).length}`);
  console.log(`เรื่องต่อคน: median ${q(per, 0.5)}, p90 ${q(per, 0.9)}, max ${Math.max(...per)} | คนที่อ่าน 0 เรื่อง ${per.filter((x) => x === 0).length}`);
  console.log(`คนอ่านต่อเรื่อง: median ${q(perNovel, 0.5)}, p90 ${q(perNovel, 0.9)}, max ${Math.max(...perNovel)} | 10% เรื่องดังสุดกินสัดส่วน ${((100 * top10) / d.interactions.length).toFixed(1)}% ของการอ่าน`);
  console.log(`รีวิวต่อคน: median ${q(revPer, 0.5)} | คนที่มีรีวิว >= 5 รายการ ${revPer.filter((x) => x >= 5).length}`);
  console.log(`การกระจายดาว 1-5: ${hist.join(" / ")}  (เฉลี่ย ${(reviews.reduce((a, b) => a + (b.rating ?? 0), 0) / reviews.length).toFixed(2)})`);
  console.log(`ความหนาแน่น user x novel: ${((100 * d.interactions.length) / (CFG.readers * CFG.novels)).toFixed(2)}%`);
}

// ---------------------------------------------------------------------------
// เขียนลงฐานข้อมูล
// ---------------------------------------------------------------------------
async function insert(d: ReturnType<typeof generate>) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const chunk = async <T,>(rows: T[], fn: (batch: T[]) => Promise<unknown>, size = 2000) => {
    for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
  };
  try {
    // ลบชุดเดิม (ลำดับเดียวกับ seed-mock-novels.ts)
    const old = (await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { user_id: true } })).map((u: { user_id: string }) => u.user_id);
    if (old.length) {
      await prisma.comment.deleteMany({ where: { user_id: { in: old } } });
      await prisma.review.deleteMany({ where: { user_id: { in: old } } });
      await prisma.novel.deleteMany({ where: { author_id: { in: old } } });
      await prisma.user.deleteMany({ where: { user_id: { in: old } } });
      console.log(`ลบชุดเดิม ${old.length} ผู้ใช้`);
    }

    const tags = new Map((await prisma.tag.findMany()).map((t: { name: string; tag_id: number }) => [t.name, t.tag_id] as const));
    for (const f of FANDOMS) if (!tags.has(f)) tags.set(f, (await prisma.tag.upsert({ where: { name: f }, update: {}, create: { name: f, category: "fandom" } })).tag_id);
    const tagId = (name: string) => {
      const id = tags.get(name);
      if (!id) throw new Error(`ไม่พบแท็ก "${name}" — รัน seed.ts หลักก่อน`);
      return id;
    };

    await chunk([...d.authors, ...d.users], (b) => prisma.user.createMany({ data: b }));
    await chunk(d.users.flatMap((u, i) => {
      const top = d.pref[i].map((p, g) => [p, g] as const).sort((a, b) => b[0] - a[0]).slice(0, 2);
      return top.map(([, g]) => ({ user_id: u.user_id, tag_id: tagId(GENRES[g].main) }));
    }), (b) => prisma.userInterest.createMany({ data: b, skipDuplicates: true }));

    await chunk(d.novels.map(({ genreMain, genreSub, ...n }) => ({ ...n, primary_tag_id: tagId(genreMain), secondary_tag_id: tagId(genreSub) })),
      (b) => prisma.novel.createMany({ data: b }), 500);
    await chunk(d.novels.flatMap((n, i) => Array.from(new Set(d.novelTags[i])).map((t) => ({ novel_id: n.novel_id, tag_id: tagId(t) }))),
      (b) => prisma.novelTag.createMany({ data: b, skipDuplicates: true }));
    await chunk(d.chapters, (b) => prisma.chapter.createMany({ data: b }), 1000);
    await chunk(d.nodes, (b) => prisma.characterNode.createMany({ data: b }));
    await chunk(d.edges, (b) => prisma.characterEdge.createMany({ data: b }));

    const U = d.users, N = d.novels;
    const it = d.interactions;
    const statusOf = (x: Interaction) => {
      const total = d.chapterIdOf[x.novel].length;
      return x.chaptersRead >= total && N[x.novel].status === "completed" ? "completed" : x.latent < -1.2 ? "up_next" : "reading";
    };
    await chunk(it.map((x) => ({ user_id: U[x.user].user_id, novel_id: N[x.novel].novel_id, status: statusOf(x), added_at: at(x.t) })),
      (b) => prisma.userLibrary.createMany({ data: b, skipDuplicates: true }));
    await chunk(it.filter((x) => statusOf(x) !== "up_next").map((x) => {
      const n = Math.min(x.chaptersRead, d.chapterIdOf[x.novel].length);
      return { user_id: U[x.user].user_id, novel_id: N[x.novel].novel_id, last_chapter_id: d.chapterIdOf[x.novel][n - 1], last_chapter_number: n,
        last_read_at: at(Math.min(CFG.days - 0.01, x.t + rand() * 20)) };
    }), (b) => prisma.readingProgress.createMany({ data: b, skipDuplicates: true }));
    // ตรวจชื่อฟิลด์ created_at ของ review / like / comment ใน schema.prisma ก่อนรัน ถ้าไม่มีให้ลบออก
    await chunk(it.filter((x) => x.liked).map((x) => ({ user_id: U[x.user].user_id, novel_id: N[x.novel].novel_id, created_at: at(x.t + 0.2) })),
      (b) => prisma.novelLike.createMany({ data: b, skipDuplicates: true }));
    await chunk(it.filter((x) => x.rating !== null).map((x) => {
      const r = x.rating as number;
      return { user_id: U[x.user].user_id, novel_id: N[x.novel].novel_id, rating: r, comment_text: pick(REVIEW_TEXT[r]),
        sentiment_label: r >= 4 ? "pos" as const : r === 3 ? "neutral" as const : "neg" as const,
        sentiment_score: Number(clamp(0.15 + (r - 1) * 0.2 + 0.05 * normal(), 0, 1).toFixed(2)),
        is_anonymous: rand() < 0.05, created_at: at(Math.min(CFG.days - 0.01, x.t + 1 + rand() * 10)) };
    }), (b) => prisma.review.createMany({ data: b, skipDuplicates: true }));
    await chunk(it.filter(() => rand() < CFG.commentRate).map((x) => {
      const ch = d.chapterIdOf[x.novel][Math.floor(rand() * Math.min(x.chaptersRead, d.chapterIdOf[x.novel].length))];
      const mood = x.latent > 0.3 ? "pos" : x.latent < -0.5 ? "neg" : "neutral";
      return { chapter_id: ch, user_id: U[x.user].user_id, content: pick(mood === "pos" ? COMMENT_POS : mood === "neg" ? COMMENT_NEG : COMMENT_NEU),
        sentiment_label: mood as "pos" | "neg" | "neutral", sentiment_score: mood === "pos" ? 0.85 : mood === "neg" ? 0.25 : 0.5,
        created_at: at(Math.min(CFG.days - 0.01, x.t + rand() * 15)) };
    }), (b) => prisma.comment.createMany({ data: b }));
    console.log("เขียนลงฐานข้อมูลเสร็จ — อย่าลืมรัน sync ไป Neo4j");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const t = Date.now();
  const d = generate();
  report(d);
  if (EXPORT) {
    const lines = ["user,novel,day,rating,liked,genre"];
    for (const x of d.interactions) lines.push(`${x.user},${x.novel},${x.t.toFixed(3)},${x.rating ?? ""},${x.liked ? 1 : 0},${d.novels[x.novel].genreMain}`);
    writeFileSync("scale-interactions.csv", lines.join("\n"));
    console.log("เขียน scale-interactions.csv แล้ว");
  }
  if (!DRY_RUN) await insert(d);
  console.log(`เสร็จใน ${((Date.now() - t) / 1000).toFixed(1)} วินาที${DRY_RUN ? " (dry-run ไม่ได้แตะฐานข้อมูล)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
