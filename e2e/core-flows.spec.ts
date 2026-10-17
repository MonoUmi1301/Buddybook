import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

/**
 * ฟีเจอร์แกนของงานวิจัยแบบ end-to-end (ต่อจาก autosave-fault.spec.ts ที่ทดสอบเน็ตหลุด/ปิดแท็บ)
 *
 *  1. นักเขียน: สร้างนิยาย → เขียนตอน → auto-save หลายรอบ → ประวัติเวอร์ชัน → กู้คืนเวอร์ชันเก่า
 *  2. ถังขยะ: ลบนิยาย → ผู้อ่านเข้าไม่ได้ / ขึ้นในถังขยะ → กู้คืน → ลบอีกครั้ง → ลบถาวร
 *  3. ผู้อ่าน: อ่านตอน → คอมเมนต์ + รีวิว → NLP worker ให้ sentiment → ขึ้นในสถิตินักเขียน
 *  4. ตอนติดเหรียญ: ผู้อ่านปลดล็อกผ่านหน้าเว็บ → นักเขียนได้รายได้ (หัก fee) → ขอถอน → แอดมินจ่าย
 *  5. ซัพพอร์ต: ผู้ใช้ส่ง ticket → แอดมินตอบ → ผู้ใช้ได้แจ้งเตือน
 *  6. อายุ: ผู้ใช้ต่ำกว่า 18 เปิดนิยาย/ตอน 18+ ไม่ได้ (ทั้ง API และหน้าเว็บ) ผู้ใหญ่เปิดได้
 *  7. Responsive: หน้าหลักที่ 390 (มือถือ) / 820 (iPad) ไม่มี scroll แนวนอนทั้งหน้า
 *
 * ต้องมี api (:4000) + web (:3000) รันอยู่ — ข้อมูลตั้งต้นสร้างเองจาก prisma/seed-e2e-core.ts ทุกครั้งที่รัน
 * NLP worker (WangchanBERTa) ไม่ต้องรัน: เทสต์ทำหน้าที่ worker เองผ่าน internal API สัญญาเดียวกัน
 * (pending-queue → sentiment-callback) เพื่อทดสอบเส้นทางข้อมูล ส่วนความแม่นของโมเดลวัดแยกใน apps/nlp-worker/eval
 */
const API_DIR = path.resolve(__dirname, "../apps/api");
const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? "";

type Seed = {
  password: string;
  genre_tag_id: number | null;
  writer: { user_id: string; email: string };
  reader: { user_id: string; email: string };
  minor: { user_id: string; email: string };
  admin: { user_id: string; email: string };
};
type Role = "writer" | "reader" | "minor" | "admin";

let seed: Seed;
const tokens = {} as Record<Role, { access: string; refresh: string }>;
const shared: {
  novel_id?: string;
  chapter_id?: string;
  paid_chapter_id?: string;
  mature_novel_id?: string;
  mature_chapter_id?: string;
} = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ playwright }) => {
  const out = execFileSync("npx", ["tsx", "prisma/seed-e2e-core.ts"], { cwd: API_DIR, encoding: "utf8" });
  seed = JSON.parse(out.trim().split("\n").pop()!);
  const req = await playwright.request.newContext();
  for (const role of ["writer", "reader", "minor", "admin"] as Role[]) {
    const res = await req.post(`${API}/auth/login`, { data: { email: seed[role].email, password: seed.password } });
    expect(res.ok(), `login ${role}`).toBeTruthy();
    const json = await res.json();
    tokens[role] = { access: json.access_token, refresh: json.refresh_token };
  }
  await req.dispose();
});

/** เรียก API ตรงในนามผู้ใช้ — คืน [status, json] */
async function api(request: APIRequestContext, role: Role | null, method: string, p: string, data?: unknown) {
  const res = await request.fetch(`${API}${p}`, {
    method,
    headers: role ? { authorization: `Bearer ${tokens[role].access}` } : {},
    data,
  });
  const json = await res.json().catch(() => null);
  return [res.status(), json] as const;
}

/** เปิดหน้าเว็บในนามผู้ใช้ — ใส่ cookie เดียวกับที่ระบบตั้งตอนล็อกอิน */
async function loginAs(context: BrowserContext, role: Role) {
  const url = new URL(test.info().project.use.baseURL!);
  const base = { domain: url.hostname, path: "/" };
  await context.addCookies([
    { name: "bb_access_token", value: tokens[role].access, ...base, httpOnly: true },
    { name: "bb_refresh_token", value: tokens[role].refresh, ...base, httpOnly: true },
    { name: "bb_has_interests", value: "1", ...base },
  ]);
}

async function pageAs(browser: import("@playwright/test").Browser, role: Role) {
  const context = await browser.newContext();
  await loginAs(context, role);
  return { context, page: await context.newPage() };
}

test("1. writer: create novel, write chapter, autosave versions, restore an older version", async ({ request, browser }) => {
  const [s1, novel] = await api(request, "writer", "POST", "/novels", {
    title: "นิยายทดสอบแกนหลัก",
    synopsis: "ทดสอบ end-to-end",
    legal_status: "original",
    tag_ids: [],
    ...(seed.genre_tag_id ? { primary_tag_id: seed.genre_tag_id } : {}),
  });
  expect(s1).toBe(201);
  shared.novel_id = novel.novel_id;

  const [s2, chapter] = await api(request, "writer", "POST", `/novels/${novel.novel_id}/chapters`, {
    chapter_number: 1,
    title: "ตอนแรก",
    content: "<p>ร่างแรก</p>",
    status: "draft",
  });
  expect(s2).toBe(201);
  shared.chapter_id = chapter.chapter_id;

  // auto-save สองรอบ = สองเวอร์ชัน (ล็อกแถวตอนแล้วเรียงเลขเวอร์ชัน)
  const [, v1] = await api(request, "writer", "PATCH", `/chapters/${chapter.chapter_id}/autosave`, {
    content_snapshot: "<p>ฉบับที่หนึ่ง เนื้อเรื่องเดิม</p>",
  });
  const [, v2] = await api(request, "writer", "PATCH", `/chapters/${chapter.chapter_id}/autosave`, {
    content_snapshot: "<p>ฉบับที่สอง เขียนทับไปแล้ว</p>",
  });
  expect(v2.version_number).toBe(v1.version_number + 1);

  const [s3, list] = await api(request, "writer", "GET", `/chapters/${chapter.chapter_id}/versions`);
  expect(s3).toBe(200);
  expect(list.versions.map((v: { version_id: string }) => v.version_id)).toEqual(
    expect.arrayContaining([v1.version_id, v2.version_id])
  );

  // คนอื่นดูประวัติเวอร์ชันของตอนที่ไม่ใช่ของตัวเองไม่ได้
  const [s4] = await api(request, "reader", "GET", `/chapters/${chapter.chapter_id}/versions`);
  expect([403, 404]).toContain(s4);

  const [s5] = await api(request, "writer", "POST", `/chapters/${chapter.chapter_id}/versions/${v1.version_id}/restore`);
  expect(s5).toBe(200);

  // หน้า editor ต้องโหลดเนื้อหาฉบับที่กู้คืน
  const { context, page } = await pageAs(browser, "writer");
  await page.goto(`/write/${novel.novel_id}/chapters/${chapter.chapter_id}`);
  await expect(page.locator(".ql-editor")).toContainText("ฉบับที่หนึ่ง เนื้อเรื่องเดิม");
  await context.close();

  // เผยแพร่นิยาย + ตอน ให้ผู้อ่านใช้ต่อในข้อ 3
  expect((await api(request, "writer", "PATCH", `/chapters/${chapter.chapter_id}`, { status: "published" }))[0]).toBe(200);
  expect((await api(request, "writer", "PATCH", `/novels/${novel.novel_id}`, { visibility: "published" }))[0]).toBe(200);
});

test("2. trash: delete novel, hidden from readers, restore, delete again, delete permanently", async ({ request, browser }) => {
  const [, novel] = await api(request, "writer", "POST", "/novels", {
    title: "นิยายที่จะถูกลบ",
    legal_status: "original",
    tag_ids: [],
    ...(seed.genre_tag_id ? { primary_tag_id: seed.genre_tag_id } : {}),
  });
  await api(request, "writer", "PATCH", `/novels/${novel.novel_id}`, { visibility: "published" });
  expect((await api(request, "reader", "GET", `/novels/${novel.novel_id}`))[0]).toBe(200);

  const [s1, del] = await api(request, "writer", "DELETE", `/novels/${novel.novel_id}`);
  expect(s1).toBe(200);
  expect(new Date(del.auto_delete_at).getTime() - new Date(del.deleted_at).getTime()).toBe(30 * 24 * 3600 * 1000);
  expect((await api(request, "reader", "GET", `/novels/${novel.novel_id}`))[0]).toBe(404);

  const [, trash] = await api(request, "writer", "GET", "/novels/trash");
  expect(trash.novels.map((n: { novel_id: string }) => n.novel_id)).toContain(novel.novel_id);

  // หน้าเว็บถังขยะของนักเขียน
  const { context, page } = await pageAs(browser, "writer");
  await page.goto("/write/trash");
  await expect(page.getByText("นิยายที่จะถูกลบ")).toBeVisible();
  await context.close();

  // คนอื่นกู้คืน/ลบถาวรนิยายของเราไม่ได้
  expect([403, 404]).toContain((await api(request, "reader", "POST", `/novels/${novel.novel_id}/restore`))[0]);
  expect([403, 404]).toContain((await api(request, "reader", "DELETE", `/novels/${novel.novel_id}/permanent`))[0]);

  const [s2, restored] = await api(request, "writer", "POST", `/novels/${novel.novel_id}/restore`);
  expect(s2).toBe(200);
  // กู้คืนแล้วกลับเป็น visibility เดิมก่อนลบ — ผู้อ่านเห็นได้อีกครั้ง
  expect(restored.visibility).toBe("published");
  expect((await api(request, "reader", "GET", `/novels/${novel.novel_id}`))[0]).toBe(200);
  const [, trashAfter] = await api(request, "writer", "GET", "/novels/trash");
  expect(trashAfter.novels.map((n: { novel_id: string }) => n.novel_id)).not.toContain(novel.novel_id);

  await api(request, "writer", "DELETE", `/novels/${novel.novel_id}`);
  expect([200, 204]).toContain((await api(request, "writer", "DELETE", `/novels/${novel.novel_id}/permanent`))[0]);
  expect((await api(request, "writer", "GET", `/novels/${novel.novel_id}`))[0]).toBe(404);
  const [, trashFinal] = await api(request, "writer", "GET", "/novels/trash");
  expect(trashFinal.novels.map((n: { novel_id: string }) => n.novel_id)).not.toContain(novel.novel_id);
});

test("3. reader: read chapter, comment + review, sentiment computed, shows in writer stats", async ({ request, browser }) => {
  const novel_id = shared.novel_id!;
  const chapter_id = shared.chapter_id!;

  const { context, page } = await pageAs(browser, "reader");
  await page.goto(`/novels/${novel_id}/chapters/${chapter_id}`);
  await expect(page.getByText("ฉบับที่หนึ่ง เนื้อเรื่องเดิม")).toBeVisible();
  await context.close();

  const [s1, comment] = await api(request, "reader", "POST", `/chapters/${chapter_id}/comments`, {
    content: "สนุกมาก ชอบตัวเอกสุด ๆ รอตอนต่อไปนะคะ",
  });
  expect(s1).toBe(201);
  const [s2, review] = await api(request, "reader", "POST", `/novels/${novel_id}/reviews`, {
    rating: 5,
    comment_text: "เขียนดีมาก อ่านเพลินทั้งเรื่อง",
  });
  expect(s2).toBe(201);
  const review_id = review.review_id ?? review.id;

  // ทำหน้าที่ NLP worker: ดึงคิว → ส่งผลกลับ (ต้องใช้ internal token)
  expect((await api(request, null, "GET", "/internal/nlp/pending-queue"))[0]).toBe(401);
  const internal = { "x-internal-token": INTERNAL_TOKEN };
  const queueRes = await request.get(`${API}/internal/nlp/pending-queue?limit=100`, { headers: internal });
  expect(queueRes.status()).toBe(200);
  const queue = (await queueRes.json()).items as { target_type: string; target_id: string }[];
  expect(queue).toEqual(expect.arrayContaining([expect.objectContaining({ target_type: "comment", target_id: comment.comment_id })]));
  expect(queue).toEqual(expect.arrayContaining([expect.objectContaining({ target_type: "review", target_id: review_id })]));

  for (const [target_type, target_id] of [["comment", comment.comment_id], ["review", review_id]] as const) {
    const cb = await request.post(`${API}/internal/nlp/sentiment-callback`, {
      headers: internal,
      data: { target_type, target_id, sentiment_label: "pos", sentiment_score: 0.97, sentiment_polarity: 0.95 },
    });
    expect(cb.status(), `callback ${target_type}`).toBeLessThan(300);
  }

  // วิเคราะห์แล้วต้องหลุดจากคิว
  const queue2 = (await (await request.get(`${API}/internal/nlp/pending-queue?limit=100`, { headers: internal })).json()).items as {
    target_id: string;
  }[];
  expect(queue2.map((q) => q.target_id)).not.toContain(comment.comment_id);

  const [s3, stats] = await api(request, "writer", "GET", `/me/stats/novels/${novel_id}`);
  expect(s3).toBe(200);
  expect(stats.sentiment.counts.pos).toBeGreaterThanOrEqual(2);
  expect(stats.sentiment.avg_polarity).toBeGreaterThan(0);
  // ผู้อ่านดูสถิติของนิยายที่ไม่ใช่ของตัวเองไม่ได้
  expect([403, 404]).toContain((await api(request, "reader", "GET", `/me/stats/novels/${novel_id}`))[0]);

  const w = await pageAs(browser, "writer");
  await w.page.goto("/write/stats");
  await expect(w.page.getByText("นิยายทดสอบแกนหลัก").first()).toBeVisible();
  await w.context.close();
});

test("4. paid chapter: reader unlocks in the UI, writer earns (minus fee), withdraws, admin pays", async ({ request, browser }) => {
  const novel_id = shared.novel_id!;
  const PRICE = 600;
  const [s1, paid] = await api(request, "writer", "POST", `/novels/${novel_id}/chapters`, {
    chapter_number: 2,
    title: "ตอนพิเศษติดเหรียญ",
    content: "<p>เนื้อหาลับเฉพาะคนที่ปลดล็อก</p>",
    status: "published",
    price_coins: PRICE,
  });
  expect(s1).toBe(201);
  shared.paid_chapter_id = paid.chapter_id;

  // ยังไม่ซื้อ: API ต้องไม่ส่งเนื้อหาเต็มมา
  const [, locked] = await api(request, "reader", "GET", `/chapters/${paid.chapter_id}`);
  expect(JSON.stringify(locked)).not.toContain("เนื้อหาลับเฉพาะคนที่ปลดล็อก");

  // คนที่เหรียญไม่พอซื้อไม่ได้ และไม่ถูกหักเงิน
  const [sMinor] = await api(request, "minor", "POST", `/chapters/${paid.chapter_id}/purchase`);
  expect(sMinor).toBe(422);

  const { context, page } = await pageAs(browser, "reader");
  await page.goto(`/novels/${novel_id}/chapters/${paid.chapter_id}`);
  await expect(page.getByText("ตอนนี้เป็นตอนติดเหรียญ")).toBeVisible();
  await page.getByRole("button", { name: /เพื่อปลดล็อก/ }).click();
  await page.getByRole("button", { name: /ยืนยัน ใช้/ }).click();
  await expect(page.getByText("เนื้อหาลับเฉพาะคนที่ปลดล็อก")).toBeVisible();
  await context.close();

  // ซื้อซ้ำไม่หักเงินซ้ำ
  const [sAgain, again] = await api(request, "reader", "POST", `/chapters/${paid.chapter_id}/purchase`);
  expect(sAgain).toBe(200);
  expect(again.already_owned).toBe(true);
  expect(again.balance_after).toBe(1000 - PRICE);

  const [, summary] = await api(request, "writer", "GET", "/wallet/withdrawals");
  const fee = Math.floor((PRICE * 10) / 100);
  expect(summary.total_earned).toBe(PRICE - fee);
  expect(summary.withdrawable_coins).toBe(PRICE - fee);

  // ถอนเกินยอดไม่ได้ / ต่ำกว่าขั้นต่ำไม่ได้
  const payout = { payout_method: "promptpay", account_name: "นักเขียน ทดสอบ", account_number: "0812345678" };
  expect((await api(request, "writer", "POST", "/wallet/withdrawals", { ...payout, amount_coins: PRICE }))[0]).toBe(422);
  expect((await api(request, "writer", "POST", "/wallet/withdrawals", { ...payout, amount_coins: 100 }))[0]).toBe(422);

  const [s2, wd] = await api(request, "writer", "POST", "/wallet/withdrawals", { ...payout, amount_coins: PRICE - fee });
  expect(s2).toBe(201);
  expect(wd.status).toBe("pending");
  // คำขอซ้อนระหว่างรอไม่ได้
  expect((await api(request, "writer", "POST", "/wallet/withdrawals", { ...payout, amount_coins: 500 }))[0]).toBe(409);

  // ผู้ใช้ทั่วไปเข้า endpoint แอดมินไม่ได้
  expect((await api(request, "writer", "GET", "/admin/withdrawals"))[0]).toBe(403);
  const [, pending] = await api(request, "admin", "GET", "/admin/withdrawals?status=pending");
  const list = (pending.withdrawals ?? pending) as { withdrawal_id: string }[];
  expect(list.map((w) => w.withdrawal_id)).toContain(wd.withdrawal_id);
  const [s3, done] = await api(request, "admin", "PATCH", `/admin/withdrawals/${wd.withdrawal_id}`, { action: "paid", note: "โอนแล้ว (e2e)" });
  expect(s3).toBe(200);
  expect(done.status).toBe("paid");

  const [, after] = await api(request, "writer", "GET", "/wallet/withdrawals");
  expect(after.withdrawable_coins).toBe(0);
  expect(after.withdrawals[0].status).toBe("paid");

  // นิยายที่มีคนซื้อตอนแล้วลบไม่ได้ (ผู้ซื้อต้องยังอ่านได้) — ระบบปฏิเสธตั้งแต่ย้ายลงถังขยะ
  expect((await api(request, "writer", "DELETE", `/novels/${novel_id}`))[0]).toBe(409);
  expect((await api(request, "reader", "GET", `/chapters/${paid.chapter_id}`))[1].locked).toBe(false);
});

test("5. support: user sends a ticket, admin replies, user is notified", async ({ request, browser }) => {
  const [s1, ticket] = await api(request, "reader", "POST", "/support/tickets", {
    category: "payment",
    subject: "ซื้อตอนแล้วยังอ่านไม่ได้",
    body: "กดปลดล็อกตอนพิเศษแล้วหน้าเว็บค้าง รบกวนช่วยตรวจสอบด้วยค่ะ",
  });
  expect(s1).toBe(201);
  const ticket_id = ticket.ticket_id;

  // ผู้ใช้อื่นอ่าน ticket ของคนอื่นไม่ได้
  expect([403, 404]).toContain((await api(request, "writer", "GET", `/support/tickets/${ticket_id}`))[0]);

  const [, adminList] = await api(request, "admin", "GET", "/admin/support/tickets");
  const tickets = (adminList.tickets ?? adminList) as { ticket_id: string }[];
  expect(tickets.map((t) => t.ticket_id)).toContain(ticket_id);

  const [, before] = await api(request, "reader", "GET", "/notifications");
  const countBefore = (before.notifications ?? before.items ?? []).length;

  const [s2] = await api(request, "admin", "POST", `/support/tickets/${ticket_id}/messages`, {
    body: "ตรวจสอบแล้ว ตอนถูกปลดล็อกเรียบร้อย ลองรีเฟรชหน้าอีกครั้งนะคะ",
  });
  expect(s2).toBe(201);

  const [, notif] = await api(request, "reader", "GET", "/notifications");
  const items = (notif.notifications ?? notif.items ?? []) as { reference_id?: string; type?: string }[];
  expect(items.length).toBeGreaterThan(countBefore);

  const { context, page } = await pageAs(browser, "reader");
  await page.goto(`/support/${ticket_id}`);
  await expect(page.getByText("ตรวจสอบแล้ว ตอนถูกปลดล็อกเรียบร้อย")).toBeVisible();
  await context.close();
});

test("6. age gate: under-18 cannot open 18+ novels or chapters, adults can", async ({ request, browser }) => {
  const [, novel] = await api(request, "writer", "POST", "/novels", {
    title: "นิยายสำหรับผู้ใหญ่ (ทดสอบ)",
    legal_status: "original",
    tag_ids: [],
    content_rating: "mature",
    ...(seed.genre_tag_id ? { primary_tag_id: seed.genre_tag_id } : {}),
  });
  const [, chapter] = await api(request, "writer", "POST", `/novels/${novel.novel_id}/chapters`, {
    chapter_number: 1,
    title: "ตอน 18+",
    content: "<p>เนื้อหาเฉพาะผู้ใหญ่</p>",
    status: "published",
  });
  await api(request, "writer", "PATCH", `/novels/${novel.novel_id}`, { visibility: "published" });
  shared.mature_novel_id = novel.novel_id;
  shared.mature_chapter_id = chapter.chapter_id;

  const [sN, bodyN] = await api(request, "minor", "GET", `/novels/${novel.novel_id}`);
  expect(sN).toBe(403);
  expect(bodyN.details?.code).toBe("AGE_VERIFICATION_REQUIRED");
  const [sC] = await api(request, "minor", "GET", `/chapters/${chapter.chapter_id}`);
  expect(sC).toBe(403);
  expect((await api(request, null, "GET", `/chapters/${chapter.chapter_id}`))[0]).toBe(403);
  expect((await api(request, "reader", "GET", `/novels/${novel.novel_id}`))[0]).toBe(200);
  expect((await api(request, "reader", "GET", `/chapters/${chapter.chapter_id}`))[0]).toBe(200);

  // ค้นหาแล้วต้องไม่เห็นนิยาย 18+ ถ้ายังไม่ยืนยันอายุ
  const [, search] = await api(request, "minor", "GET", `/novels/search?q=${encodeURIComponent("นิยายสำหรับผู้ใหญ่")}`);
  expect(JSON.stringify(search)).not.toContain(novel.novel_id);

  // ผู้ใช้กรอกวันเกิดที่อายุไม่ถึง 18 → ยังไม่ผ่าน
  const teenBirth = new Date();
  teenBirth.setUTCFullYear(teenBirth.getUTCFullYear() - 15);
  const [, verify] = await api(request, "minor", "PATCH", "/users/me/age-verification", {
    birth_date: teenBirth.toISOString().slice(0, 10),
  });
  expect(verify.age_verified).toBe(false);

  const { context, page } = await pageAs(browser, "minor");
  await page.goto(`/novels/${novel.novel_id}`);
  await expect(page.getByText("เนื้อหาสำหรับผู้ใหญ่")).toBeVisible();
  await page.goto(`/novels/${novel.novel_id}/chapters/${chapter.chapter_id}`);
  await expect(page.getByText("เนื้อหาเฉพาะผู้ใหญ่")).toHaveCount(0);
  await context.close();
});

test("7. responsive: no page-level horizontal scroll at 390 (phone) and 820 (iPad)", async ({ browser }) => {
  const pages = [
    "/",
    "/search",
    `/novels/${shared.novel_id}`,
    `/novels/${shared.novel_id}/chapters/${shared.chapter_id}`,
    "/wallet",
    "/write",
    `/write/${shared.novel_id}/chapters/${shared.chapter_id}`,
    "/support",
    "/notifications",
  ];
  const problems: string[] = [];
  for (const width of [390, 820]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1180 }, isMobile: width === 390 });
    await loginAs(context, "reader");
    // หน้าของนักเขียนต้องใช้บัญชีนักเขียน
    const writerContext = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1180 }, isMobile: width === 390 });
    await loginAs(writerContext, "writer");
    for (const p of pages) {
      const page: Page = await (p.startsWith("/write") ? writerContext : context).newPage();
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      // editor (Quill) โหลดแบบ dynamic — รอให้ขึ้นก่อนวัด/ถ่ายภาพ
      if (p.startsWith("/write/") && p.includes("/chapters/")) await page.locator(".ql-editor").waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${width}px ${p}: กว้างเกินจอ ${overflow}px`);
      await page.screenshot({ path: test.info().outputPath(`w${width}${p.replace(/[^a-z0-9]+/gi, "_")}.png`), fullPage: false });
      await page.close();
    }
    await context.close();
    await writerContext.close();
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
