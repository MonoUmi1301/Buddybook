/**
 * ภาพประกอบหน้าคู่มือ (/guide, /guide/coin) — ถ่ายจากเว็บจริงแล้ววาดวง + เลขลำดับ + ลูกศรลงไปในภาพเลย
 * ต้องมี api (:4000) + web (:3000) รันอยู่ และ seed ด้วย apps/api/prisma/seed-e2e.ts แล้ว (ล็อกอินเป็น e2e_writer)
 *
 *   node node_modules/tsx/dist/cli.mjs e2e/guide-screenshots.ts            # ถ่ายทุกภาพ
 *   node node_modules/tsx/dist/cli.mjs e2e/guide-screenshots.ts coin,gift  # ถ่ายเฉพาะภาพที่ชื่อมีคำเหล่านี้
 *
 * ภาพออกที่ apps/web/public/guide/*.png — UI เปลี่ยนเมื่อไรก็รันใหม่ได้เลย
 */
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Locator, type Page } from "@playwright/test";

const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const OUT = path.resolve(__dirname, "../apps/web/public/guide");
// ขนาดภาพแต่ละไฟล์ — หน้าเว็บอ่านไปใส่ width/height ของ <Image> (components/guide/Guide.tsx)
const MANIFEST = path.resolve(__dirname, "../apps/web/src/lib/guideShots.json");
const sizes: Record<string, { width: number; height: number }> = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf8"))
  : {};
const LOGIN = { email: "e2e_writer@e2e.buddybook.local", password: "e2e12345" };

// นิยายตัวอย่างที่เปิดสาธารณะในฐานข้อมูล dev — เปลี่ยนได้ด้วย env ถ้าฐานข้อมูลต่างกัน
const NOVEL = process.env.GUIDE_NOVEL_ID ?? "7c4b82e4-1f8a-4b12-8134-8bcd0de94020";
const CHAPTER = process.env.GUIDE_CHAPTER_ID ?? "03506f83-5ef8-4a7d-a381-b6a190f4d8f4";
const PAID_NOVEL = process.env.GUIDE_PAID_NOVEL_ID ?? "2f865954-5dee-4914-b479-18574f6abd2a";
const PAID_CHAPTER = process.env.GUIDE_PAID_CHAPTER_ID ?? "3d6fc06d-ed92-4531-96e9-d57198778cc3";
// นิยาย + ตอนร่างของ e2e_writer (seed-e2e.ts)
const WRITER_NOVEL = process.env.GUIDE_WRITER_NOVEL_ID ?? "106fc102-cde3-4dbf-9e0a-b7a0abdcb0cc";
const WRITER_CHAPTER = process.env.GUIDE_WRITER_CHAPTER_ID ?? "60d10d57-0918-4ca3-bbaf-ec4af93a6802";

const ORANGE = "#ef7d32";

type Side = "top" | "bottom" | "left" | "right";
interface Mark {
  target: Locator;
  n?: number;
  /** ลูกศรชี้เข้าหาวงจากด้านนี้ */
  arrow?: Side;
  /** ตำแหน่งเลข — ปุ่มไอคอนที่ชิดกัน (Navbar) วางเลขไว้ใต้ปุ่มไม่ให้ทับวงข้าง ๆ */
  badge?: "corner" | "below";
  /** ระยะวงห่างจากขอบปุ่ม (ค่าเริ่มต้น 6px) */
  pad?: number;
}

/** วาดวง/เลข/ลูกศรทับหน้าเว็บ (absolute ตามพิกัดหน้า ไม่ใช่ viewport) */
async function annotate(page: Page, marks: Mark[]) {
  const boxes = [];
  for (const m of marks) {
    await m.target.scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => undefined);
    const b = await m.target.boundingBox({ timeout: 10_000 }).catch(() => null);
    if (!b) throw new Error(`mark ${m.n ?? "-"} not found: ${m.target}`);
    const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
    boxes.push({ x: b.x + scroll.x, y: b.y + scroll.y, w: b.width, h: b.height, n: m.n, arrow: m.arrow, badge: m.badge ?? "corner", pad: m.pad ?? 6 });
  }
  await page.evaluate(
    ({ boxes, color }) => {
      for (const b of boxes) {
        const pad = b.pad;
        const ring = document.createElement("div");
        ring.dataset.guideMark = "";
        Object.assign(ring.style, {
          position: "absolute",
          left: `${b.x - pad}px`,
          top: `${b.y - pad}px`,
          width: `${b.w + pad * 2}px`,
          height: `${b.h + pad * 2}px`,
          border: `3px solid ${color}`,
          borderRadius: "14px",
          boxShadow: `0 0 0 5px ${color}33`,
          zIndex: "2147483646",
          pointerEvents: "none",
        });
        if (b.n !== undefined) {
          const badge = document.createElement("div");
          badge.textContent = String(b.n);
          const below = b.badge === "below";
          Object.assign(badge.style, {
            position: "absolute",
            left: below ? `calc(50% - 14px)` : "-16px",
            top: below ? `calc(100% + 6px)` : "-16px",
            width: "28px",
            height: "28px",
            borderRadius: "999px",
            background: color,
            color: "#fff",
            font: "700 15px/28px system-ui, sans-serif",
            textAlign: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,.25)",
          });
          ring.appendChild(badge);
        }
        if (b.arrow) {
          const len = 64;
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", String(len));
          svg.setAttribute("height", "28");
          svg.setAttribute("viewBox", `0 0 ${len} 28`);
          svg.innerHTML = `<line x1="2" y1="14" x2="${len - 14}" y2="14" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="M${len - 18} 3 L${len - 2} 14 L${len - 18} 25 Z" fill="${color}"/>`;
          const rot = { left: 0, right: 180, top: 90, bottom: -90 }[b.arrow as "left"];
          const cx = { left: -len / 2 - 10, right: b.w + pad * 2 + len / 2 + 10, top: (b.w + pad * 2) / 2, bottom: (b.w + pad * 2) / 2 }[b.arrow as "left"];
          const cy = { left: (b.h + pad * 2) / 2, right: (b.h + pad * 2) / 2, top: -len / 2 - 10, bottom: b.h + pad * 2 + len / 2 + 10 }[b.arrow as "left"];
          Object.assign(svg.style, {
            position: "absolute",
            left: `${cx - len / 2 - 3}px`,
            top: `${cy - 14 - 3}px`,
            transform: `rotate(${rot}deg)`,
            overflow: "visible",
          });
          ring.appendChild(svg);
        }
        document.body.appendChild(ring);
      }
    },
    { boxes, color: ORANGE }
  );
}

async function clearMarks(page: Page) {
  await page.evaluate(() => document.querySelectorAll("[data-guide-mark]").forEach((e) => e.remove()));
}

interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** ถ่ายเฉพาะกรอบรอบ ๆ locator (ขยายขอบออกไป margin) ในพิกัดหน้า */
async function around(page: Page, target: Locator, margin = { x: 40, top: 40, bottom: 40 }): Promise<Clip> {
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  const s = await page.evaluate(() => ({ x: scrollX, y: scrollY, w: document.documentElement.clientWidth }));
  const x = Math.max(0, b.x + s.x - margin.x);
  const y = Math.max(0, b.y + s.y - margin.top);
  return { x, y, width: Math.min(s.w - x, b.width + margin.x * 2), height: b.height + margin.top + margin.bottom };
}

async function shoot(page: Page, name: string, clip?: Clip) {
  // ภาพที่ fixed (Navbar, ปุ่มลอย) ต้องถ่ายแบบ viewport — ภาพยาวใช้ fullPage + clip พิกัดหน้า
  const file = path.join(OUT, `${name}.png`);
  if (clip) {
    const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY, h: innerHeight }));
    const inView = clip.y >= scroll.y && clip.y + clip.height <= scroll.y + scroll.h;
    await page.screenshot({
      path: file,
      clip: inView ? { ...clip, x: clip.x - scroll.x, y: clip.y - scroll.y } : clip,
      fullPage: !inView,
    });
  } else {
    await page.screenshot({ path: file });
  }
  const vp = page.viewportSize()!;
  sizes[name] = clip ? { width: Math.round(clip.width), height: Math.round(clip.height) } : { width: vp.width, height: vp.height };
  await clearMarks(page);
  console.log("saved", path.relative(process.cwd(), file));
}

async function go(page: Page, url: string) {
  await page.goto(WEB + url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  // ปุ่มแชทลอย / dev overlay ของ Next ไม่เกี่ยวกับเนื้อหาคู่มือ
  await page.addStyleTag({
    content: `nextjs-portal{display:none!important} [aria-label="เปิดคำถามที่พบบ่อย"]{display:none!important} *{caret-color:transparent!important}`,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}

const shots: Record<string, (page: Page) => Promise<void>> = {
  // ---------- คู่มือการใช้งาน ----------
  async "navbar"(page) {
    await go(page, "/");
    const icon = { badge: "below", pad: 3 } as const;
    await annotate(page, [
      { target: page.getByRole("button", { name: "นิยาย", exact: true }).first(), n: 1, ...icon },
      { target: page.getByRole("link", { name: "สร้างผลงาน" }).first(), n: 2, ...icon },
      { target: page.getByRole("link", { name: "ค้นหา" }).first(), n: 3, ...icon },
      { target: page.getByRole("link", { name: "ชั้นหนังสือ" }).first(), n: 4, ...icon },
      { target: page.getByRole("button", { name: "การแจ้งเตือน" }).first(), n: 5, ...icon },
      { target: page.locator('button[aria-haspopup="menu"]').last(), n: 6, ...icon },
    ]);
    // ตัดเฉพาะแถบเมนูบน — ซ้าย (โลโก้ + โหมด) กับขวา (ไอคอน) ภาพเดียว สูงพอให้เห็นเลขใต้ปุ่ม
    await shoot(page, "navbar", { x: 0, y: 0, width: 1280, height: 104 });
  },

  async "search"(page) {
    await go(page, "/search");
    const input = page.getByPlaceholder(/ค้นหานิยาย/);
    await input.fill("รัก");
    await annotate(page, [
      { target: input, n: 1 },
      { target: page.getByRole("button", { name: "ค้นหาแบบละเอียด" }), n: 2 },
    ]);
    await shoot(page, "search", { x: 0, y: 64, width: 1280, height: 560 });
  },

  async "novel-detail"(page) {
    await go(page, `/novels/${NOVEL}`);
    await annotate(page, [
      { target: page.getByRole("link", { name: /เริ่มอ่าน|อ่านต่อ/ }).first(), n: 1 },
      { target: page.getByRole("button", { name: /เข้าชั้น|ในชั้น/ }).first(), n: 2 },
      { target: page.getByRole("button", { name: "ส่งของขวัญ" }).first(), n: 3 },
      { target: page.getByRole("button", { name: /ถูกใจ/ }).first(), n: 4 },
      { target: page.getByRole("tab", { name: /สารบัญ/ }).or(page.getByRole("button", { name: /สารบัญ/ })).first(), n: 5 },
    ]);
    await shoot(page, "novel-detail", { x: 0, y: 64, width: 1280, height: 440 });
  },

  async "reader-settings"(page) {
    await go(page, `/novels/${NOVEL}/chapters/${CHAPTER}`);
    const btn = page.getByRole("button", { name: "ตั้งค่าการอ่าน" });
    await btn.click();
    await page.waitForTimeout(500);
    await annotate(page, [{ target: btn, n: 1, arrow: "left" }]);
    await shoot(page, "reader-settings");
  },

  async "comment"(page) {
    await go(page, `/novels/${NOVEL}/chapters/${CHAPTER}`);
    const box = page.getByPlaceholder("เขียนคอมเมนต์ที่นี่");
    await box.fill("สนุกมาก รอตอนต่อไปนะคะ");
    await annotate(page, [
      { target: box, n: 1 },
      { target: page.getByRole("button", { name: "เลือกสติกเกอร์" }), n: 2 },
      { target: page.getByRole("button", { name: "ส่งคอมเมนต์" }), n: 3 },
    ]);
    const section = page.getByRole("heading", { name: /^คอมเมนต์/ }).locator("xpath=..");
    await shoot(page, "comment", await around(page, section, { x: 40, top: 30, bottom: 30 }));
  },

  async "library"(page) {
    await go(page, "/library");
    await page.waitForTimeout(3000); // ชั้นอะคริลิกมีแอนิเมชันตอนโหลด
    await annotate(page, [
      { target: page.getByRole("heading", { name: "อ่านต่อ", exact: true }), n: 1 },
      { target: page.getByRole("heading", { name: "คอลเลคชัน", exact: true }), n: 2 },
    ]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot(page, "library", { x: 0, y: 64, width: 1280, height: 1000 });
  },

  async "notifications"(page) {
    await go(page, "/");
    const bell = page.getByRole("button", { name: "การแจ้งเตือน" }).first();
    await bell.click();
    await page.waitForTimeout(800);
    await annotate(page, [{ target: bell, n: 1 }]);
    await shoot(page, "notifications", { x: 560, y: 0, width: 720, height: 420 });
  },

  async "gift"(page) {
    await go(page, `/novels/${NOVEL}`);
    await page.getByRole("button", { name: "ส่งของขวัญ" }).first().click();
    await page.waitForTimeout(1500);
    await page.getByRole("dialog").first().locator("button[aria-pressed]").first().click();
    await page.locator("#gift-message").fill("ขอบคุณที่เขียนเรื่องสนุก ๆ ให้อ่านนะคะ");
    const dialog = page.getByRole("dialog").first();
    await annotate(page, [
      { target: dialog.locator("button[aria-pressed]").first(), n: 1 },
      { target: dialog.locator("#gift-message"), n: 2 },
      { target: dialog.getByRole("button", { name: "ส่งของขวัญ" }), n: 3 },
    ]);
    await shoot(page, "gift");
  },

  async "write-dashboard"(page) {
    await go(page, "/write");
    await annotate(page, [
      { target: page.getByRole("link", { name: "สร้างนิยายใหม่" }), n: 1 },
      { target: page.getByRole("link", { name: /เขียนตอนใหม่/ }).first(), n: 2 },
      { target: page.getByRole("main").getByRole("link", { name: "สถิติ", exact: true }).first(), n: 3 },
      { target: page.getByRole("link", { name: "กล่องจดหมาย" }), n: 4 },
    ]);
    await shoot(page, "write-dashboard", { x: 0, y: 64, width: 1280, height: 560 });
  },

  async "write-new"(page) {
    await go(page, "/write/new");
    await annotate(page, [
      { target: page.getByRole("button", { name: "งานเขียนต้นฉบับ" }), n: 1 },
      { target: page.getByRole("button", { name: "แบ่งหลายตอน" }), n: 2 },
      { target: page.getByRole("button", { name: "ถัดไป" }), n: 3 },
    ]);
    await shoot(page, "write-new", { x: 240, y: 64, width: 800, height: 420 });
  },

  // ตอนร่างของบัญชี e2e — เปิดหน้าต่างเลือกการเผยแพร่แล้วถ่าย ไม่ได้กดยืนยัน (ตอนยังเป็นร่างเหมือนเดิม)
  async "editor"(page) {
    // ปุ่มบันทึกร่าง/จบงานอยู่ชิดขอบล่างของจอ 800px — ขยายจอให้วงรอบปุ่มไม่โดนตัด
    await page.setViewportSize({ width: 1280, height: 860 });
    await go(page, `/write/${WRITER_NOVEL}/chapters/${WRITER_CHAPTER}`);
    await annotate(page, [
      { target: page.getByText("ชื่อตอน", { exact: true }).locator("xpath=following::input[1]"), n: 1 },
      { target: page.locator(".ql-toolbar, [role=toolbar]").first(), n: 2 },
      { target: page.getByText(/ตอนติดเหรียญ/).first(), n: 3 },
      { target: page.getByRole("button", { name: "บันทึกร่าง" }), n: 4 },
      { target: page.getByRole("button", { name: "จบงาน" }), n: 5 },
    ]);
    await shoot(page, "editor");
    await page.setViewportSize({ width: 1280, height: 800 });
  },

  async "publish-choice"(page) {
    await go(page, `/write/${WRITER_NOVEL}/chapters/${WRITER_CHAPTER}`);
    await page.getByRole("button", { name: "จบงาน" }).click();
    await page.waitForTimeout(1000);
    // วงรอบทั้งกล่องตัวเลือก (รวมคำอธิบายใต้ชื่อ) ไม่ใช่แค่ข้อความ
    const option = (label: string) => page.getByText(label, { exact: true }).locator("xpath=ancestor::label[1]");
    await annotate(page, [
      { target: option("เผยแพร่ทันที"), n: 1 },
      { target: option("ตั้งเวลาเผยแพร่"), n: 2 },
      { target: option("เก็บไว้ก่อน"), n: 3 },
    ]);
    await shoot(page, "publish-choice");
    await page.keyboard.press("Escape");
  },

  // ---------- วิธีเติม coin ----------
  async "coin-menu"(page) {
    await go(page, "/");
    await page.locator('button[aria-haspopup="menu"]').last().click();
    await page.waitForTimeout(600);
    await annotate(page, [{ target: page.getByRole("menuitem", { name: "เติม coin" }), n: 1, arrow: "left" }]);
    await shoot(page, "coin-menu", { x: 760, y: 0, width: 520, height: 620 });
  },

  async "coin-wallet"(page) {
    await go(page, "/wallet");
    await annotate(page, [
      { target: page.getByText("coin ของฉัน").locator(".."), n: 1 },
      { target: page.getByRole("button", { name: "99 บาท" }), n: 2, arrow: "right" },
    ]);
    await shoot(page, "coin-wallet", { x: 0, y: 64, width: 1280, height: 600 });
  },

  async "coin-checkout"(page) {
    await go(page, "/wallet");
    await page.getByRole("button", { name: "99 บาท" }).click();
    // Stripe Embedded Checkout โหลดใน iframe ใช้เวลาสักพัก
    const stripe = page.frameLocator("iframe").first();
    await stripe.getByText("PromptPay", { exact: true }).first().waitFor({ timeout: 90_000 });
    await page.waitForTimeout(2000);
    await annotate(page, [
      { target: stripe.locator("input[type=email], input[name=email]").first(), n: 1 },
      { target: stripe.getByText("PromptPay", { exact: true }).first(), n: 2 },
      { target: stripe.getByText("บัตร", { exact: true }).first(), n: 3 },
      { target: stripe.locator("button[type=submit]").first(), n: 4 },
    ]);
    const modal = page.getByRole("heading", { name: /เติม 100 coin/ }).locator("xpath=ancestor::div[contains(@class,'rounded-card')][1]");
    await shoot(page, "coin-checkout", await around(page, modal, { x: 24, top: 24, bottom: 24 }));
  },

  async "coin-history"(page) {
    await go(page, "/wallet");
    const heading = page.getByRole("heading", { name: "ประวัติการซื้อ" });
    await annotate(page, [
      { target: heading, n: 1 },
      { target: page.getByText("ทั้งหมด", { exact: true }).first().locator(".."), n: 2 },
    ]);
    const hb = await around(page, heading, { x: 0, top: 50, bottom: 0 });
    await shoot(page, "coin-history", { x: 160, y: hb.y, width: 960, height: 230 });
  },

  async "coin-unlock"(page) {
    await go(page, `/novels/${PAID_NOVEL}/chapters/${PAID_CHAPTER}`);
    const cta = page.getByRole("link", { name: "ไปเติมคอยน์" }).or(page.getByRole("button", { name: /เพื่อปลดล็อก/ })).first();
    await annotate(page, [{ target: cta, n: 1 }]);
    await shoot(page, "coin-unlock", await around(page, cta, { x: 320, top: 260, bottom: 60 }));
  },
};

(async () => {
  mkdirSync(OUT, { recursive: true });
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  const tokens = (await res.json()) as { access_token: string; refresh_token: string };
  if (!res.ok) throw new Error(`login failed — seed ด้วย prisma/seed-e2e.ts ก่อน (${res.status})`);

  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
  );
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: "th-TH" });
  const host = new URL(WEB).hostname;
  await context.addCookies([
    { name: "bb_access_token", value: tokens.access_token, domain: host, path: "/", httpOnly: true },
    { name: "bb_refresh_token", value: tokens.refresh_token, domain: host, path: "/", httpOnly: true },
    { name: "bb_has_interests", value: "1", domain: host, path: "/" },
  ]);
  const page = await context.newPage();

  const filter = process.argv[2];
  let failed = 0;
  for (const [name, run] of Object.entries(shots)) {
    if (filter && !filter.split(",").some((f) => name.includes(f))) continue;
    try {
      await run(page);
    } catch (err) {
      failed++;
      console.error(`FAILED ${name}:`, (err as Error).message.split("\n")[0]);
    }
  }
  await browser.close();
  writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(sizes).sort()), null, 2) + "\n");
  if (failed) process.exit(1);
})();
