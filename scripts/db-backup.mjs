#!/usr/bin/env node
/**
 * สำรองฐานข้อมูลที่แอปใช้อยู่ด้วย pg_dump — npm run db:backup
 *
 * - อ่าน DATABASE_URL จาก environment ก่อน ถ้าไม่มีใช้ apps/api/.env
 * - หา pg_dump จาก PATH ก่อน แล้วค่อยไล่หาในโฟลเดอร์ติดตั้ง PostgreSQL บน Windows (C: / D:)
 *   เลือกรุ่นใหม่สุดเสมอ (pg_dump รุ่นเก่ากว่าเซิร์ฟเวอร์ใช้ไม่ได้)
 * - เขียนไฟล์ backups/buddybook-YYYYMMDD-HHMMSS.dump (รูปแบบ custom ของ pg_restore) เก็บไว้ 20 ไฟล์ล่าสุด
 * - ถูกเรียกอัตโนมัติก่อน `npm run prisma:migrate` (prisma migrate dev อาจล้างฐานข้อมูลทั้งหมด)
 *
 * กู้คืน (ล้างของในฐานข้อมูลปลายทางแล้วใส่ของจากไฟล์):
 *   pg_restore --clean --if-exists --no-owner -d "<DATABASE_URL ไม่มี ?schema=...>" backups/<ไฟล์>.dump
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEEP = 20;

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const m = readFileSync(path.join(root, "apps", "api", ".env"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function findPgDump() {
  const exe = process.platform === "win32" ? "pg_dump.exe" : "pg_dump";
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["pg_dump"], { encoding: "utf8" });
  const candidates = which.status === 0 ? which.stdout.split(/\r?\n/).filter(Boolean) : [];
  if (process.platform === "win32") {
    for (const drive of ["C:", "D:"]) {
      for (const base of ["Program Files\\PostgreSQL", "ProgramData\\PostgreSQL"]) {
        const dir = path.join(`${drive}\\`, base);
        if (!existsSync(dir)) continue;
        for (const v of readdirSync(dir)) {
          const p = path.join(dir, v, "bin", exe);
          if (existsSync(p)) candidates.push(p);
        }
      }
    }
  }
  const version = (p) => Number(spawnSync(p, ["--version"], { encoding: "utf8" }).stdout.match(/(\d+)(?:\.\d+)?/)?.[1] ?? 0);
  return candidates.sort((a, b) => version(b) - version(a))[0] ?? null;
}

const url = databaseUrl();
if (!url) {
  console.error("ไม่พบ DATABASE_URL (apps/api/.env) — สำรองไม่ได้");
  process.exit(1);
}
const pgDump = findPgDump();
if (!pgDump) {
  console.error("ไม่พบ pg_dump — ติดตั้ง PostgreSQL client หรือเพิ่มโฟลเดอร์ bin ของ PostgreSQL ใน PATH");
  process.exit(1);
}

const u = new URL(url);
const dir = path.join(root, "backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const file = path.join(dir, `${decodeURIComponent(u.pathname.slice(1)) || "db"}-${stamp}.dump`);

const res = spawnSync(
  pgDump,
  ["-Fc", "-h", u.hostname, "-p", u.port || "5432", "-U", decodeURIComponent(u.username), "-f", file, decodeURIComponent(u.pathname.slice(1))],
  { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, PGPASSWORD: decodeURIComponent(u.password) } }
);
if (res.status !== 0) {
  console.error(`สำรองไม่สำเร็จ (pg_dump exit ${res.status ?? res.signal})`);
  process.exit(1);
}
console.log(`สำรองแล้ว: ${path.relative(root, file)} (${(statSync(file).size / 1024).toFixed(0)} KB)`);

// เก็บไว้แค่ KEEP ไฟล์ล่าสุด
const dumps = readdirSync(dir).filter((f) => f.endsWith(".dump")).sort();
for (const old of dumps.slice(0, Math.max(0, dumps.length - KEEP))) unlinkSync(path.join(dir, old));
