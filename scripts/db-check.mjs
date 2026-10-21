#!/usr/bin/env node
/**
 * ตรวจว่าแอปกำลังใช้ฐานข้อมูลไหน และแต่ละที่มีข้อมูลอะไรอยู่ — ใช้ตอน "ข้อมูลหาย" / "ต้องสมัครใหม่"
 *   npm run db:check
 * อ่าน DATABASE_URL จาก apps/api/.env (และจาก environment ถ้าตั้งทับไว้) แล้วลองทั้งพอร์ต 5432 (Postgres ในเครื่อง)
 * และ 5525 (Postgres ใน Docker) ด้วยชื่อผู้ใช้/รหัสผ่านเดียวกัน — พิมพ์แค่จำนวน ไม่พิมพ์อีเมลหรือรหัสผ่าน
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const require = createRequire(path.join(apiDir, "package.json"));
const { PrismaClient } = require("@prisma/client");

const fromFile = (() => {
  try {
    const m = readFileSync(path.join(apiDir, ".env"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
})();
const fromEnv = process.env.DATABASE_URL ?? null;
const mask = (u) => u.replace(/\/\/([^:]+):[^@]*@/, "//$1:***@");

console.log(`apps/api/.env      : ${fromFile ? mask(fromFile) : "(ไม่พบ)"}`);
console.log(`ตัวแปร DATABASE_URL : ${fromEnv ? mask(fromEnv) : "(ไม่ได้ตั้ง — ใช้ค่าจาก .env)"}`);
if (fromEnv && fromFile && fromEnv !== fromFile) console.log("  คำเตือน: ตั้งทับไว้ใน environment — api/seed จะใช้ค่านี้แทน .env");
console.log("");

const base = fromEnv ?? fromFile;
if (!base) process.exit(1);
const candidates = new Set([base]);
for (const port of ["5432", "5525"]) candidates.add(base.replace(/:(\d+)\//, `:${port}/`));

for (const url of candidates) {
  const prisma = new PrismaClient({ datasourceUrl: url, log: [] });
  const label = url === base ? `${mask(url)}  ← แอปใช้อันนี้` : mask(url);
  try {
    const real = { email: { not: { endsWith: ".buddybook.local" } } };
    const [users, realUsers, published, realNovels, latest] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: real }),
      prisma.novel.count({ where: { visibility: "published", deleted_at: null } }),
      prisma.novel.count({ where: { author: real } }),
      prisma.user.findFirst({ where: real, orderBy: { created_at: "desc" }, select: { created_at: true } }),
    ]);
    console.log(label);
    console.log(`  ผู้ใช้ทั้งหมด ${users} (บัญชีจริง ${realUsers}, ล่าสุดสมัคร ${latest?.created_at.toISOString() ?? "-"})`);
    console.log(`  นิยายเผยแพร่ ${published} (นิยายของบัญชีจริง ${realNovels})`);
  } catch (err) {
    console.log(`${label}\n  เชื่อมต่อไม่ได้: ${String(err.message ?? err).split("\n").filter(Boolean).pop()}`);
  } finally {
    await prisma.$disconnect();
  }
  console.log("");
}
