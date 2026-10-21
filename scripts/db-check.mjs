#!/usr/bin/env node
/**
 * ตรวจว่าแอปกำลังใช้ฐานข้อมูลไหน และ Postgres ทุกตัวในเครื่องมีข้อมูลอะไรอยู่ — ใช้ตอน "ข้อมูลหาย" / "ต้องสมัครใหม่"
 *   npm run db:check
 * อ่าน DATABASE_URL จาก apps/api/.env (และจาก environment ถ้าตั้งทับไว้) แล้วไล่ลองทุกพอร์ตที่ Postgres มักใช้
 * ด้วยชื่อผู้ใช้/รหัสผ่านเดียวกัน แสดงทุกฐานข้อมูลบนแต่ละเครื่องที่มีตาราง users — พิมพ์แค่จำนวน ไม่พิมพ์อีเมล/รหัสผ่าน
 * อ่านอย่างเดียว ไม่แก้ข้อมูลใด ๆ
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
const appUrl = new URL(base);
const withDb = (port, db) => {
  const u = new URL(base);
  u.port = String(port);
  u.pathname = `/${db}`;
  return u.toString();
};

const ports = [...new Set([appUrl.port || "5432", "5432", "5433", "5434", "5525", "5526"])];
for (const port of ports) {
  const admin = new PrismaClient({ datasourceUrl: withDb(port, "postgres"), log: [] });
  let dbs;
  let version = "";
  try {
    dbs = (await admin.$queryRaw`SELECT datname::text AS datname FROM pg_database WHERE NOT datistemplate ORDER BY datname`).map((r) => r.datname);
    version = (await admin.$queryRaw`SELECT current_setting('server_version') AS v`)[0].v;
  } catch (err) {
    const msg = String(err.message ?? err);
    if (/authentication|password/i.test(msg)) console.log(`พอร์ต ${port}: มี Postgres แต่รหัสผ่านใน .env ใช้กับตัวนี้ไม่ได้`);
    if (process.env.DEBUG_DB_CHECK) console.log(port, msg);
    await admin.$disconnect();
    continue;
  }
  await admin.$disconnect();
  console.log(`พอร์ต ${port}: PostgreSQL ${version} — ฐานข้อมูล: ${dbs.join(", ")}`);
  for (const db of dbs) {
    const prisma = new PrismaClient({ datasourceUrl: withDb(port, db), log: [] });
    try {
      const [row] = await prisma.$queryRaw`
        SELECT count(*)::int AS users,
               count(*) FILTER (WHERE email NOT LIKE '%.buddybook.local')::int AS real_users,
               max(created_at) FILTER (WHERE email NOT LIKE '%.buddybook.local') AS latest,
               min(created_at) AS first,
               (SELECT count(*)::int FROM novels) AS novels
          FROM users`;
      const inUse = String(port) === (appUrl.port || "5432") && `/${db}` === appUrl.pathname ? "  ← แอปใช้อันนี้" : "";
      console.log(`  ${db}${inUse}`);
      console.log(`    ผู้ใช้ ${row.users} (บัญชีจริง ${row.real_users}) · นิยาย ${row.novels}`);
      console.log(`    ผู้ใช้คนแรกสร้าง ${row.first?.toISOString() ?? "-"} · บัญชีจริงล่าสุด ${row.latest?.toISOString() ?? "-"}`);
    } catch {
      // ฐานข้อมูลนี้ไม่มีตาราง users ของ BuddyBook — ข้าม
    } finally {
      await prisma.$disconnect();
    }
  }
  console.log("");
}
