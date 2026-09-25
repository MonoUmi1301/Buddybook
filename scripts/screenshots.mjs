#!/usr/bin/env node
/**
 * ถ่ายภาพหน้าจอ Home + My Library หลายความกว้าง แล้วตรวจ:
 *   - ไม่มี horizontal scroll ของทั้งหน้า (scrollWidth > clientWidth)
 *   - console error / hydration warning
 *
 *   node scripts/screenshots.mjs [baseUrl] [outDir]
 *   (ต้อง `npx playwright install chromium` ก่อนหนึ่งครั้ง และ seed ผู้ใช้เดโมแล้ว — ดู prisma/seed-demo-library.ts)
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = process.argv[3] ?? "screenshots";
const LOGIN = { email: "demo_reader@demo.buddybook.local", password: "demo1234" };

/** [ชื่อ, กว้าง, สูง, จอสัมผัส, ถ่ายภาพเก็บไว้] */
const VIEWPORTS = [
  ["1920", 1920, 1080, false, false],
  ["1440", 1440, 900, false, true],
  ["1280", 1280, 800, false, false],
  ["tablet-landscape", 1180, 820, true, false],
  ["1024", 1024, 768, false, true],
  ["820", 820, 1180, true, true],
  ["768", 768, 1024, true, false],
  ["390", 390, 844, true, true],
  ["375", 375, 812, true, false],
  ["360", 360, 780, true, false],
];
const PAGES = [
  ["home", "/"],
  ["library", "/library"],
  ["library-spines", "/library?view=spines"],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const problems = [];

async function run({ dark }) {
  for (const [name, width, height, touch, keep] of VIEWPORTS) {
    if (dark && name !== "1440" && name !== "390") continue;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch && width < 1024,
      deviceScaleFactor: 1,
      reducedMotion: "reduce", // ภาพนิ่ง ไม่ติดจังหวะ animation/autoplay
    });
    if (dark) await context.addInitScript(() => localStorage.setItem("bb_theme", "dark"));

    const res = await context.request.post(`${BASE}/api/v1/auth/login`, { data: LOGIN });
    if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);

    for (const [pageName, url] of PAGES) {
      if (pageName === "library-spines" && !keep) continue;
      const page = await context.newPage();
      const logs = [];
      page.on("console", (msg) => {
        const text = msg.text();
        if (msg.type() === "error" || /hydrat|did not match/i.test(text)) logs.push(`[${msg.type()}] ${text.slice(0, 300)}`);
      });
      page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

      await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 180_000 });
      await page.waitForTimeout(800);

      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        if (el.scrollWidth <= el.clientWidth) return null;
        // หา element ที่ล้นขวา เพื่อบอกต้นเหตุ
        const offenders = [...document.querySelectorAll("body *")]
          .filter((n) => n.getBoundingClientRect().right > el.clientWidth + 1)
          .filter((n) => !n.closest("[class*='overflow-x-auto'],[class*='overflow-hidden'],[aria-roledescription='carousel']"))
          .slice(0, 5)
          .map((n) => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 80)}`);
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, offenders };
      });

      const tag = `${pageName}@${name}${dark ? "-dark" : ""}`;
      if (overflow) problems.push(`${tag}: horizontal overflow ${JSON.stringify(overflow)}`);
      for (const l of logs) problems.push(`${tag}: ${l}`);
      if (keep || dark) await page.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: true });
      console.log(`${overflow ? "✗" : "✓"} ${tag}${logs.length ? ` (${logs.length} console issues)` : ""}`);
      await page.close();
    }
    await context.close();
  }
}

await run({ dark: false });
await run({ dark: true });
await browser.close();

console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join("\n")}` : "\nno overflow / console problems");
process.exit(problems.length ? 1 : 0);
