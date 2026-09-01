import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { env } from "@/config/env";
import apiRoutes from "@/routes";
import { notFoundHandler } from "@/middleware/notFound.middleware";
import { errorHandler } from "@/middleware/error.middleware";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "buddybook-api", env: env.NODE_ENV });
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
