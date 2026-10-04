/**
 * KPI-4 — Load test ด้วย k6 (Proposal 3.5.1): ผู้ใช้พร้อมกัน 50 คน, เวลาตอบสนองเฉลี่ยของ API ต้องไม่เกิน 3 วินาที
 *
 *   k6 run loadtest/buddybook.k6.js                      # 50 VUs, 2 นาที (ค่าเริ่มต้น)
 *   k6 run -e VUS=50 -e DURATION=5m -e API=http://localhost:4000 loadtest/buddybook.k6.js
 *   k6 run --summary-export=loadtest/result.json loadtest/buddybook.k6.js
 *
 * ต้อง seed ก่อน: apps/api → npx tsx prisma/seed-e2e.ts --rich (ผู้ใช้ e2e_reader1-12 / e2e_writer รหัส e2e12345)
 * พฤติกรรมจำลอง (ตามสัดส่วนการใช้งานจริงโดยประมาณ):
 *   60% ผู้อ่านทั่วไป: ค้นหา → เปิดหน้าเรื่อง → อ่านตอน → ดูคอมเมนต์
 *   30% ผู้อ่านที่ล็อกอิน: หน้าแรก (แนะนำนิยาย) → อ่านตอน → การแจ้งเตือน
 *   10% นักเขียน: auto-save ตอน → ดูสถิติ
 * ผู้อ่านทั่วไปแต่ละ VU ใช้ X-Forwarded-For ของตัวเอง (เหมือนผู้ใช้คนละเครื่องผ่าน Next proxy)
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const API = (__ENV.API || "http://localhost:4000") + "/api/v1";
const PASSWORD = __ENV.PASSWORD || "e2e12345";

export const options = {
  scenarios: {
    mixed: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: Number(__ENV.VUS || 50) },
        { duration: __ENV.DURATION || "2m", target: Number(__ENV.VUS || 50) },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["avg<3000", "p(95)<3000"], // KPI-4
    http_req_failed: ["rate<0.01"],
    "endpoint_recommendations": ["avg<3000"],
    "endpoint_chapter": ["avg<3000"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
};

const tRecs = new Trend("endpoint_recommendations", true);
const tChapter = new Trend("endpoint_chapter", true);
const tSearch = new Trend("endpoint_search", true);
const tAutosave = new Trend("endpoint_autosave", true);

const json = { headers: { "Content-Type": "application/json" } };

export function setup() {
  const login = (email) => {
    const r = http.post(`${API}/auth/login`, JSON.stringify({ email, password: PASSWORD }), json);
    if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status} ${r.body}`);
    return r.json("access_token");
  };
  const readers = [];
  for (let i = 1; i <= 12; i++) readers.push(login(`e2e_reader${i}@e2e.buddybook.local`));
  const writer = login("e2e_writer@e2e.buddybook.local");

  const novels = http.get(`${API}/novels/search?sort=views&page=1`).json("novels").map((n) => n.novel_id);
  const chapters = [];
  for (const id of novels.slice(0, 10)) {
    const list = http.get(`${API}/novels/${id}/chapters`).json("chapters") || [];
    for (const c of list) if (c.status === "published" && c.price_coins === 0) chapters.push({ novel_id: id, chapter_id: c.chapter_id });
  }
  // ตอนร่างของนักเขียนสำหรับ auto-save
  const mine = http.get(`${API}/novels/search?mine=true&page=1`, { headers: { Authorization: `Bearer ${writer}` } }).json("novels");
  const writerNovel = mine.find((n) => n.title === "บันทึกที่ไม่มีวันหาย") || mine[0];
  const draft = (http.get(`${API}/novels/${writerNovel.novel_id}/chapters`, { headers: { Authorization: `Bearer ${writer}` } }).json("chapters") || [])[0];
  if (!chapters.length || !draft) throw new Error("ไม่มีข้อมูลให้ทดสอบ — seed ก่อน (ดูหัวไฟล์)");
  return { readers, writer, novels, chapters, writerNovel: writerNovel.novel_id, draft: draft.chapter_id };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function (data) {
  const roll = Math.random();
  const ip = `10.${__VU % 250}.${Math.floor(__VU / 250)}.${(__ITER % 200) + 1}`;

  if (roll < 0.6) {
    const h = { headers: { "X-Forwarded-For": ip } };
    group("guest reader", () => {
      const s = http.get(`${API}/novels/search?q=${encodeURIComponent(pick(["รัก", "แฟนตาซี", "เมือง", ""]))}&page=1`, h);
      tSearch.add(s.timings.duration);
      check(s, { "search 200": (r) => r.status === 200 });
      const c = pick(data.chapters);
      check(http.get(`${API}/novels/${c.novel_id}`, h), { "novel 200": (r) => r.status === 200 || r.status === 403 });
      const ch = http.get(`${API}/chapters/${c.chapter_id}`, h);
      tChapter.add(ch.timings.duration);
      check(ch, { "chapter 200": (r) => r.status === 200 || r.status === 403 });
      check(http.get(`${API}/chapters/${c.chapter_id}/comments`, h), { "comments 200": (r) => r.status === 200 || r.status === 403 });
    });
  } else if (roll < 0.9) {
    const auth = { headers: { Authorization: `Bearer ${pick(data.readers)}` } };
    group("signed-in reader", () => {
      const r = http.get(`${API}/recommendations?limit=10`, auth);
      tRecs.add(r.timings.duration);
      check(r, { "recommendations 200": (x) => x.status === 200 });
      const c = pick(data.chapters);
      const ch = http.get(`${API}/chapters/${c.chapter_id}`, auth);
      tChapter.add(ch.timings.duration);
      check(ch, { "chapter 200": (x) => x.status === 200 || x.status === 403 });
      check(http.get(`${API}/notifications?pageSize=20`, auth), { "notifications 200": (x) => x.status === 200 });
    });
  } else {
    const auth = { headers: { Authorization: `Bearer ${data.writer}`, "Content-Type": "application/json" } };
    group("writer", () => {
      const a = http.patch(
        `${API}/chapters/${data.draft}/autosave`,
        JSON.stringify({ content_snapshot: `<p>load test ${__VU}-${__ITER} ${"ก".repeat(2000)}</p>` }),
        auth
      );
      tAutosave.add(a.timings.duration);
      check(a, { "autosave 200": (x) => x.status === 200 });
      check(http.get(`${API}/me/stats/novels/${data.writerNovel}?days=30`, auth), { "stats 200": (x) => x.status === 200 });
    });
  }
  sleep(1 + Math.random() * 2); // เวลาคิด/อ่านของผู้ใช้จริง
}
