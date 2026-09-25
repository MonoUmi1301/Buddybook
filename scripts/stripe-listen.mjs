#!/usr/bin/env node
/**
 * ส่ง webhook ของ Stripe (test mode) เข้า API บนเครื่อง — coin เติมผ่าน webhook เท่านั้น ถ้าไม่รันตัวนี้
 * ตอน dev บน localhost จ่ายเงินสำเร็จแล้ว coin จะไม่เข้า
 *
 *   npm run stripe:listen
 *
 * - ใช้ STRIPE_SECRET_KEY จาก apps/api/.env (ไม่ต้อง `stripe login`)
 * - เอา signing secret ของ `stripe listen` ไปใส่ STRIPE_WEBHOOK_SECRET ใน apps/api/.env ให้เองถ้ายังไม่ตรง
 *   (ค่านี้คงที่ต่อบัญชี+เครื่อง) — ถ้าเปลี่ยน ต้อง restart api หนึ่งครั้ง (สคริปต์จะบอก)
 * - ต้องมี Stripe CLI: https://docs.stripe.com/stripe-cli
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "apps/api/.env");
const FORWARD_TO = process.env.STRIPE_FORWARD_TO ?? "localhost:4000/api/v1/webhooks/stripe";
const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
];

const localBin = path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "stripe.exe" : "stripe");
const stripeBin = existsSync(localBin) ? localBin : "stripe";

const envText = readFileSync(envPath, "utf8");
const readVar = (name) => envText.match(new RegExp(`^${name}=["']?([^"'\\r\\n]*)["']?`, "m"))?.[1] ?? "";
const apiKey = readVar("STRIPE_SECRET_KEY");
if (!apiKey.startsWith("sk_test_")) {
  console.error("✖ ต้องมี STRIPE_SECRET_KEY แบบ sk_test_ ใน apps/api/.env (ห้ามใช้กับ live key)");
  process.exit(1);
}

const printed = spawnSync(stripeBin, ["listen", "--api-key", apiKey, "--print-secret"], { encoding: "utf8" });
const secret = printed.stdout?.trim();
if (printed.status !== 0 || !secret?.startsWith("whsec_")) {
  console.error("✖ อ่าน webhook signing secret จาก Stripe CLI ไม่ได้:", printed.error?.message ?? printed.stderr);
  process.exit(1);
}

if (readVar("STRIPE_WEBHOOK_SECRET") !== secret) {
  const line = `STRIPE_WEBHOOK_SECRET="${secret}"`;
  const next = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(envText)
    ? envText.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line)
    : `${envText.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, next);
  console.log("✔ อัปเดต STRIPE_WEBHOOK_SECRET ใน apps/api/.env แล้ว — restart api หนึ่งครั้ง:");
  console.log("    Docker: docker compose --profile app up -d api   |   Node: หยุด/รัน npm run dev:api ใหม่\n");
}

console.log(`▶ forward ${EVENTS.length} events → ${FORWARD_TO} (Ctrl+C เพื่อหยุด)`);
const child = spawn(stripeBin, ["listen", "--api-key", apiKey, "--forward-to", FORWARD_TO, "--events", EVENTS.join(",")], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
