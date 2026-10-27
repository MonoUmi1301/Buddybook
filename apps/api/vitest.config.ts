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
    // ตั้งก่อน dotenv (dotenv ไม่ทับค่าที่มีอยู่แล้ว) — .env ของเครื่อง dev มักเปิด SCHEDULER_ENABLED=true
    // ซึ่งจะชนะค่า default "ปิดตอน NODE_ENV=test" และทำให้งานเบื้องหลังวิ่งใส่ฐานข้อมูลระหว่างเทสต์
    // BCRYPT_ROUNDS=4 — bcryptjs cost 12 ช้าจนเทสต์สมัครสมาชิก/OTP เกิน 30 วิบน Windows
    env: { NODE_ENV: "test", SCHEDULER_ENABLED: "false", BCRYPT_ROUNDS: "4" },
    // เทสต์ integration ใช้ฐานข้อมูลจริงตาม DATABASE_URL ใน .env (สร้าง/ลบผู้ใช้ทดสอบเอง) —
    // รันทีละไฟล์กันสองไฟล์แย่งกระเป๋าเงินผู้ใช้ชุดเดียวกัน
    fileParallelism: false,
    testTimeout: 30_000,
    // npm run test:coverage — รายงานความครอบคลุมของโค้ดประกอบผลทดสอบ (Proposal 3.5.1 Unit/Integration testing)
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts", "src/types/**"],
      // lcov ให้ SonarQube อ่าน (sonar.javascript.lcov.reportPaths)
      reporter: ["text-summary", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
    },
    hookTimeout: 60_000,
  },
});
