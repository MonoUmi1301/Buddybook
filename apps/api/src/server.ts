import { app } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { ensureNeo4jIndexes, neo4jDriver } from "@/lib/neo4j";

// เพิ่มภายหลัง (perf) — index ของกราฟ (ดู lib/neo4j.ts) ไม่รอ ไม่ทำให้ api ล่มถ้า Neo4j ยังไม่พร้อม
ensureNeo4jIndexes().catch((err) => {
  // eslint-disable-next-line no-console
  console.warn("Neo4j index setup skipped:", err instanceof Error ? err.message : err);
});

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BuddyBook API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    await neo4jDriver.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
