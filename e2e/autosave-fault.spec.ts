import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * KPI-3 — Fault-tolerance ของ Auto-save (Proposal 3.4.4 / 3.5.1 Scenario-based testing)
 * จำลอง: (1) เน็ตหลุดระหว่างพิมพ์ แล้วปิดแท็บทันที  (2) ปิดแท็บก่อนครบรอบ auto-save 30 วิ
 * ผ่านเมื่อเปิดหน้าเดิมอีกครั้งแล้วได้เนื้อหาที่พิมพ์ครบ 100% (กู้จากเครื่อง หรือถึงเซิร์ฟเวอร์แล้ว)
 */
const WRITER = { email: "e2e_writer@e2e.buddybook.local", password: "e2e12345" };
const API_DIR = path.resolve(__dirname, "../apps/api");

let ids: { novel_id: string; chapter_id: string };

test.beforeEach(() => {
  // seed ใหม่ทุกเทสต์ — ตอนเริ่มจากเนื้อหาเดิมเสมอ
  const out = execFileSync("npx", ["tsx", "prisma/seed-e2e.ts"], { cwd: API_DIR, encoding: "utf8" });
  ids = JSON.parse(out.trim().split("\n").pop()!);
});

async function login(context: BrowserContext) {
  const res = await context.request.post("/api/v1/auth/login", { data: WRITER });
  expect(res.ok()).toBeTruthy();
  // ผู้ใช้ e2e ตั้งความสนใจไว้แล้ว — ข้าม redirect ไป onboarding ด้วย cookie เดียวกับที่ระบบตั้งให้
  const url = new URL(test.info().project.use.baseURL!);
  await context.addCookies([{ name: "bb_has_interests", value: "1", domain: url.hostname, path: "/" }]);
}

const editorUrl = () => `/write/${ids.novel_id}/chapters/${ids.chapter_id}`;

async function typeInEditor(page: Page, text: string) {
  const editor = page.locator(".ql-editor");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(text);
}

test("offline then tab closed: nothing typed is lost", async ({ browser }) => {
  const context = await browser.newContext();
  await login(context);
  const page = await context.newPage();
  await page.goto(editorUrl());
  await expect(page.locator(".ql-editor")).toContainText("ย่อหน้าแรกที่บันทึกไว้แล้ว");

  await context.setOffline(true);
  const typed = " ข้อความที่พิมพ์ตอนเน็ตหลุด";
  await typeInEditor(page, typed);
  await expect(page.getByText("ออฟไลน์ — บันทึกไว้ในเครื่องแล้ว")).toBeVisible();

  // ปิดแท็บทันที (ยังออฟไลน์ เซิร์ฟเวอร์ไม่มีทางได้รับ)
  await page.close({ runBeforeUnload: false });
  await context.setOffline(false);

  const reopened = await context.newPage();
  await reopened.goto(editorUrl());
  await expect(reopened.getByText("พบงานที่ยังไม่ได้บันทึกขึ้นเซิร์ฟเวอร์ในเครื่องนี้")).toBeVisible();
  await reopened.getByRole("button", { name: "กู้คืนฉบับในเครื่อง" }).click();
  await expect(reopened.locator(".ql-editor")).toContainText(`ย่อหน้าแรกที่บันทึกไว้แล้ว${typed}`);
  await context.close();
});

test("tab closed before the 30s autosave: the keepalive flush reaches the server", async ({ browser }) => {
  const context = await browser.newContext();
  await login(context);
  const page = await context.newPage();
  await page.goto(editorUrl());
  await expect(page.locator(".ql-editor")).toContainText("ย่อหน้าแรกที่บันทึกไว้แล้ว");

  const typed = " พิมพ์แล้วปิดทันที";
  await typeInEditor(page, typed);
  // editor เตือน "ยังมีงานไม่ได้บันทึก" ตอนปิด — ผู้ใช้กดยืนยันออก (Playwright กดยกเลิกให้ถ้าไม่จัดการ)
  page.on("dialog", (d) => void d.accept());
  // request keepalive ออกตอนแท็บกำลังปิด — Playwright มองไม่เห็น request ของ page ที่ปิดแล้ว
  // จึงตรวจผลที่ปลายทางแทน (สิ่งที่ KPI-3 ต้องการจริง ๆ คือเซิร์ฟเวอร์ได้เนื้อหาครบ)
  await page.close({ runBeforeUnload: true });

  // ฝั่งเซิร์ฟเวอร์ต้องได้เนื้อหาแล้ว — เปิดด้วย context ใหม่ (ไม่มีร่างในเครื่อง) ต้องเห็นข้อความครบ
  const fresh = await browser.newContext();
  await login(fresh);
  const check = await fresh.newPage();
  await expect
    .poll(async () => {
      await check.goto(editorUrl());
      return check.locator(".ql-editor").innerText();
    }, { timeout: 15_000 })
    .toContain(typed.trim());
  await fresh.close();
  await context.close();
});
