#!/usr/bin/env node
/**
 * ตั้งค่าฐานข้อมูลครบชุดในคำสั่งเดียว (ใช้ได้ทั้งใน container และบนเครื่อง):
 *   1. prisma migrate deploy (รวม CHECK constraints — migration 20260930100000_manual_check_constraints)
 *   2. prisma/seed.ts           (แท็ก/หมวดหมู่ — upsert รันซ้ำได้)
 *   3. prisma/seed-mock-novels.ts (ข้อมูล mock — ลบชุดเดิมแล้วสร้างใหม่ทุกครั้ง)
 *   4. prisma/seed-demo-library.ts (ผู้ใช้เดโม My Library — demo_reader@demo.buddybook.local / demo1234)
 *   5. sync กราฟ Neo4j จาก Postgres ผ่าน POST /api/v1/internal/recommendations/sync
 *      (ข้ามได้ถ้า api ยังไม่รัน — เรียก endpoint เดิมทีหลังได้)
 *
 * ใช้ DATABASE_URL จาก environment ก่อน (compose ตั้งให้ใน container / node --env-file บนเครื่อง)
 * ถ้าไม่มีจึงตกไปใช้ apps/api/.env ตามพฤติกรรมปกติของ Prisma
 *
 * เรียก CLI ผ่าน process.execPath ตรง ๆ ไม่ผ่าน shell — กันปัญหา ComSpec/PATH บน Windows
 *
 *   --skip-mock   ไม่รัน seed-mock-novels.ts และ seed-demo-library.ts (เดโมใช้นิยาย mock)
 *   --skip-graph  ไม่ sync Neo4j
 *   --only-graph  ทำแค่ขั้น sync Neo4j (หลังเปิด api แล้ว)
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(apiDir);

const require = createRequire(path.join(apiDir, "package.json"));
const prismaCli = require.resolve("prisma/build/index.js");
const tsxCli = require.resolve("tsx/cli");

const args = new Set(process.argv.slice(2));

function run(label, cliPath, cliArgs) {
  console.log(`\n${label}`);
  const result = spawnSync(process.execPath, [cliPath, ...cliArgs], { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    console.error(`\n${label} ล้มเหลว (exit ${result.status ?? result.signal}) — หยุดที่ขั้นนี้`);
    process.exit(result.status ?? 1);
  }
}

async function syncGraph() {
  console.log("\n5/5 sync กราฟ Neo4j จาก Postgres");
  const token = process.env.INTERNAL_SERVICE_TOKEN ?? (await readTokenFromDotenv());
  const base = process.env.SETUP_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  if (!token) {
    console.warn("  ข้าม: ไม่พบ INTERNAL_SERVICE_TOKEN");
    return;
  }
  try {
    const res = await fetch(`${base}/api/v1/internal/recommendations/sync`, {
      method: "POST",
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.text();
    if (!res.ok) {
      console.warn(`  sync ไม่สำเร็จ (HTTP ${res.status}): ${body.slice(0, 200)}`);
      return;
    }
    console.log(`  ${body}`);
  } catch {
    console.warn(`  ข้าม: ติดต่อ api ที่ ${base} ไม่ได้ (ยังไม่รัน?) — เปิด api แล้วรันขั้นนี้ใหม่ด้วย --only-graph`);
  }
}

async function readTokenFromDotenv() {
  try {
    const dotenv = require("dotenv");
    return dotenv.config({ path: path.join(apiDir, ".env"), processEnv: {} }).parsed?.INTERNAL_SERVICE_TOKEN;
  } catch {
    return undefined;
  }
}

if (args.has("--only-graph")) {
  await syncGraph();
  process.exit(0);
}

const target = (process.env.DATABASE_URL ?? "(apps/api/.env)").replace(/\/\/[^@]*@/, "//***@");
console.log(`BuddyBook DB setup → ${target}`);

run("1/5 prisma migrate deploy", prismaCli, ["migrate", "deploy"]);
run("2/5 seed.ts (แท็ก/หมวดหมู่)", tsxCli, ["prisma/seed.ts"]);
if (args.has("--skip-mock")) console.log("\n3-4/5 ข้าม seed-mock-novels.ts + seed-demo-library.ts (--skip-mock)");
else {
  run("3/5 seed-mock-novels.ts (ข้อมูล mock)", tsxCli, ["prisma/seed-mock-novels.ts"]);
  run("4/5 seed-demo-library.ts (ผู้ใช้เดโม My Library)", tsxCli, ["prisma/seed-demo-library.ts"]);
}
if (args.has("--skip-graph")) console.log("\n5/5 ข้าม sync Neo4j (--skip-graph)");
else await syncGraph();

console.log("\nตั้งค่าฐานข้อมูลเสร็จ");
