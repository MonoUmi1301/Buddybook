import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["test/**/*.test.ts"],
    // โหลด .env ก่อนทุกไฟล์ — เทสต์ที่สร้าง PrismaClient เอง (ไม่ผ่าน config/env.ts) ก็ได้ DATABASE_URL ด้วย
    setupFiles: ["dotenv/config"],
    // เทสต์ integration ใช้ฐานข้อมูลจริงตาม DATABASE_URL ใน .env (สร้าง/ลบผู้ใช้ทดสอบเอง) —
    // รันทีละไฟล์กันสองไฟล์แย่งกระเป๋าเงินผู้ใช้ชุดเดียวกัน
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
