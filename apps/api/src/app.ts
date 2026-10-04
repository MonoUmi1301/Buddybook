import "@/lib/zodThai"; // ข้อความ validation ภาษาไทยทั้ง API — ต้อง import ก่อน schema ใด ๆ ถูกใช้
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { env } from "@/config/env";
import apiRoutes from "@/routes";
import { asyncHandler } from "@/utils/asyncHandler";
import { stripeWebhook } from "@/modules/wallet/wallet.controller";
import { notFoundHandler } from "@/middleware/notFound.middleware";
import { errorHandler } from "@/middleware/error.middleware";
import { prisma } from "@/lib/prisma";
import { withNeo4jSession } from "@/lib/neo4j";
import { buildOpenApiSpec, SWAGGER_HTML } from "@/lib/openapi";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

// เพิ่มภายหลัง (audit fix — Stripe) — ต้อง mount ก่อน express.json() ด้านล่างเสมอ และใช้
// express.raw() เฉพาะ route นี้เท่านั้น เพราะ stripe.webhooks.constructEvent ต้องการ raw body
// buffer ไปคำนวณลายเซ็นเทียบกับ Stripe-Signature header — ถ้า express.json() แปลงเป็น object
// ไปก่อนแล้ว จะคำนวณลายเซ็นไม่ตรงกับที่ Stripe เซ็นมาให้เลย ต่อให้เนื้อหาหน้าตาเหมือนกันทุกตัวอักษร
// ไม่ผ่าน requireAuth เหมือน route อื่นเพราะ Stripe เรียกตรงจาก server ของเขา ไม่มี JWT ผู้ใช้ —
// ยืนยันตัวตนด้วยลายเซ็นแทน (ดู stripeWebhook ใน wallet.controller.ts)
app.post("/api/v1/webhooks/stripe", express.raw({ type: "application/json" }), asyncHandler(stripeWebhook));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "buddybook-api", env: env.NODE_ENV });
});

// gap 4.6 — readiness สำหรับระบบ monitor uptime (KPI-5): ตอบ 200 เฉพาะเมื่อคุยกับ Postgres ได้จริง
// (/health ตอบ ok แม้ฐานข้อมูลล่ม — ใช้เป็น liveness ของ process อย่างเดียว) Neo4j เป็น derived store
// ล่มได้โดยระบบหลักยังใช้งานได้ จึงรายงานไว้ดูเฉย ๆ ไม่ทำให้ readiness fail
app.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    let database = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }
    let graph = "ok";
    try {
      await withNeo4jSession((s) => s.run("RETURN 1", {}, { timeout: 1000 }));
    } catch {
      graph = "down";
    }
    res.status(database === "ok" ? 200 : 503).json({
      status: database === "ok" ? "ready" : "unavailable",
      database,
      graph,
      latency_ms: Date.now() - started,
    });
  })
);

// gap 4.5 — OpenAPI spec (สร้างจาก router จริง) + Swagger UI
app.get("/api/v1/openapi.json", (_req, res) => {
  res.status(200).json(buildOpenApiSpec(app));
});
app.get("/api/v1/docs", (_req, res) => {
  // helmet ตั้ง CSP script-src 'self' — หน้านี้หน้าเดียวอนุญาต swagger-ui จาก unpkg
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data:"
  );
  res.type("html").send(SWAGGER_HTML);
});

app.use("/api/v1", apiRoutes);

// zod validation error → 400 (มาก่อน error.middleware.ts ตัวรวม)
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }
  next(err);
});

// audit fix — body-parser (express.json limit) โยน error ที่ไม่ใช่ ApiError/ZodError/Prisma error
// เลย หลุดไปตกที่ errorHandler ทั่วไปกลายเป็น 500 "Internal server error" ที่เข้าใจผิดได้ว่าเซิร์ฟเวอร์
// พัง ทั้งที่จริงคือ payload เกิน 2mb (เช่น วางรูปแบบ base64 ลงในตอนนิยายตรง ๆ ผ่าน paste ใน Quill
// แทนที่จะอัปโหลดขึ้น Cloudinary) — ตอบ 413 ที่สื่อความหมายจริงแทน
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large (max 2MB) — please upload images via /uploads/sign instead of embedding them directly" });
  }
  next(err);
});

app.use(notFoundHandler);
app.use(errorHandler);
