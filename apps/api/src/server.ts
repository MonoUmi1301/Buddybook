import { app } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { ensureNeo4jIndexes, logNeo4jStartupStatus, neo4jDriver } from "@/lib/neo4j";
import { isSchedulerEnabled, startScheduler } from "@/lib/scheduler";

// เพิ่มภายหลัง (perf) — index ของกราฟ (ดู lib/neo4j.ts) ไม่รอ ไม่ทำให้ api ล่มถ้า Neo4j ยังไม่พร้อม
ensureNeo4jIndexes().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn("Neo4j index setup skipped:", err instanceof Error ? err.message : err);
});
// บอกใน log ตอนเริ่มว่าต่อ Neo4j ตัวไหน (Aura หรือ container) ต่อได้ไหม และกราฟมีข้อมูลหรือยัง — ไม่รอ ไม่ทำให้ api ล่ม
void logNeo4jStartupStatus();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BuddyBook API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

// เพิ่มภายหลัง (scheduler) — เผยแพร่ตอนที่ตั้งเวลาไว้ / ล้างถังขยะเกิน 30 วัน / sync กราฟ Neo4j
const stopScheduler = isSchedulerEnabled() ? startScheduler() : () => {};

async function closeConnections() {
  await prisma.$disconnect();
  await neo4jDriver.close();
}

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down gracefully...`);
  stopScheduler();
  // callback ของ server.close ไม่รอ promise — ถ้าปิด connection พังก็ยังต้องออกจาก process
  server.close(() => {
    void closeConnections().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
