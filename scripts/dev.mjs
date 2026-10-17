#!/usr/bin/env node
/**
 * เปิดทุกอย่างที่ต้องใช้ตอน dev ในคำสั่งเดียว:  npm run dev
 *   api    — apps/api  (พอร์ต 4000, ใช้ Neo4j ตาม apps/api/.env)
 *   web    — apps/web  (พอร์ต 3000)
 *   stripe — ส่ง webhook ของ Stripe test mode เข้า api (ไม่มี coin เข้าถ้าไม่รันตัวนี้)
 * ปิดทั้งหมดด้วย Ctrl+C ครั้งเดียว — ถ้า stripe ล่ม (เช่นยังไม่ได้ติดตั้ง Stripe CLI) api/web ยังรันต่อ
 * ไม่เอา stripe:  npm run dev -- --no-stripe
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const withStripe = !process.argv.includes("--no-stripe");

const tasks = [
  { name: "api", color: 36, cmd: "npm run dev --workspace=apps/api", required: true },
  { name: "web", color: 35, cmd: "npm run dev --workspace=apps/web", required: true },
  ...(withStripe ? [{ name: "stripe", color: 33, cmd: "node scripts/stripe-listen.mjs", required: false }] : []),
];

// เช็คก่อนว่าพอร์ตว่าง — ถ้า api/web ตัวเก่า (หรือ container ของ docker:up) ค้างอยู่ จะได้รู้ทันที
// แทนที่จะเห็น EADDRINUSE ยาว ๆ แล้วเผลอทดสอบกับเซิร์ฟเวอร์ตัวเก่า
function portInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", (e) => resolve(e.code === "EADDRINUSE"));
    srv.once("listening", () => srv.close(() => resolve(false)));
    srv.listen(port);
  });
}
const busy = [];
for (const port of [4000, 3000]) if (await portInUse(port)) busy.push(port);
if (busy.length) {
  console.error(`\nพอร์ต ${busy.join(", ")} มีโปรแกรมอื่นใช้อยู่ (น่าจะเป็น api/web ตัวเก่าที่ยังไม่ได้ปิด)`);
  console.error("  - ถ้าเคยรัน docker:up ไว้:  npm run docker:down");
  if (process.platform === "win32") {
    console.error(`  - หา process ที่ใช้พอร์ต:   netstat -ano | findstr :${busy[0]}`);
    console.error("    แล้วปิดด้วย:             taskkill /PID <เลขท้ายบรรทัด> /F");
  } else {
    console.error(`  - หา process ที่ใช้พอร์ต:   lsof -i :${busy[0]}`);
  }
  console.error("ปิดแล้วรัน npm run dev ใหม่อีกครั้ง\n");
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function prefixLines(name, color, chunk, write) {
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) write(tag + line + "\n");
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}

for (const t of tasks) {
  const child = spawn(t.cmd, { cwd: root, shell: true, env: { ...process.env, FORCE_COLOR: "1" } });
  children.push(child);
  child.stdout.on("data", (d) => prefixLines(t.name, t.color, d, (s) => process.stdout.write(s)));
  child.stderr.on("data", (d) => prefixLines(t.name, t.color, d, (s) => process.stderr.write(s)));
  child.on("exit", (code) => {
    if (shuttingDown) return;
    if (t.required) {
      console.error(`\n[${t.name}] หยุดทำงาน (exit ${code}) — ปิดทั้งหมด`);
      shutdown(code ?? 1);
    } else {
      console.error(`\n[${t.name}] หยุดทำงาน (exit ${code}) — api/web ยังรันต่อ แต่เติม coin จะไม่เข้าจนกว่าจะรัน npm run stripe:listen`);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
