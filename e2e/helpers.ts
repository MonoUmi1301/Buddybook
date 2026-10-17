import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import dotenv from "dotenv";

export const API_DIR = path.resolve(__dirname, "../apps/api");

/** ค่าจาก apps/api/.env (เช่น INTERNAL_SERVICE_TOKEN, DATABASE_URL) — ค่าใน environment จริงมาก่อนเสมอ */
export const apiEnv: Record<string, string> = {
  ...dotenv.config({ path: path.join(API_DIR, ".env"), processEnv: {} }).parsed,
  ...(process.env as Record<string, string>),
};

/** รันสคริปต์ TypeScript ใน apps/api ด้วย tsx แล้วคืน JSON บรรทัดสุดท้าย
 *  เรียก node + tsx/cli ตรง ๆ ไม่ผ่าน `npx` — บน Windows `npx` เป็น .cmd ซึ่ง execFileSync เรียกเองไม่ได้ (ENOENT) */
export function runApiScript<T>(script: string, args: string[] = []): T {
  const tsxCli = createRequire(path.join(API_DIR, "package.json")).resolve("tsx/cli");
  const out = execFileSync(process.execPath, [tsxCli, script, ...args], { cwd: API_DIR, encoding: "utf8", env: apiEnv });
  return JSON.parse(out.trim().split("\n").pop()!) as T;
}
