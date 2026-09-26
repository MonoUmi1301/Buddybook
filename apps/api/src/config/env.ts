import "dotenv/config";
import { z } from "zod";

/**
 * ตรวจสอบ environment variables ตอนบูตแอป — ถ้าขาดตัวที่จำเป็น
 * ให้แอป crash ทันทีตอน start แทนที่จะพังกลางทางตอน runtime
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  INTERNAL_SERVICE_TOKEN: z.string().default(""),
  NEO4J_URI: z.string().min(1, "NEO4J_URI is required"),
  NEO4J_USER: z.string().min(1, "NEO4J_USER is required"),
  NEO4J_PASSWORD: z.string().min(1, "NEO4J_PASSWORD is required"),
  NEO4J_DATABASE: z.string().optional(),
  // ไม่บังคับตอน boot (ต่างจาก NEO4J_*) — ฟีเจอร์อัปโหลดที่ต้องใช้ค่านี้ gate ตัวเองด้วย
  // isCloudinaryConfigured() แทน (ดู lib/cloudinary.ts) เพื่อไม่ให้ dev ทั้งระบบพังถ้ายังไม่ได้ตั้งค่า
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  // เช่นเดียวกับ Cloudinary — ไม่บังคับตอน boot, gate ด้วย isSlipOkConfigured() แทน
  // (ดู lib/slipok.ts) เพราะผู้ใช้ยังไม่ได้สมัคร SlipOK ตอนที่เขียนโค้ดนี้
  SLIPOK_API_KEY: z.string().default(""),
  SLIPOK_BRANCH_ID: z.string().default(""),
  // เลขบัญชี/PromptPay ปลายทางจริงของระบบ — ใช้ตรวจว่าสลิปโอนเข้าบัญชีนี้จริง (กันสลิปสวมสิทธิ์
  // จากบัญชีอื่น) ปล่อยว่างได้ถ้ายังไม่มีบัญชีจริง (จะข้ามการเช็คนี้ไปก่อน)
  PAYMENT_RECEIVING_ACCOUNT: z.string().default(""),
  // OAuth — เช่นเดียวกับ Cloudinary/SlipOK ไม่บังคับตอน boot, gate ด้วย isXOAuthConfigured()
  // แทน (ดู lib/googleOAuth.ts, lib/lineOAuth.ts)
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  LINE_CLIENT_ID: z.string().default(""),
  LINE_CLIENT_SECRET: z.string().default(""),
  FACEBOOK_CLIENT_ID: z.string().default(""),
  FACEBOOK_CLIENT_SECRET: z.string().default(""),
  // base URL ของหน้าเว็บ (Next.js) ใช้ประกอบ redirect_uri ตอนขอ token จาก OAuth provider —
  // ต้องตรงกับค่าที่ลงทะเบียนไว้ใน Google Cloud Console เป๊ะ ๆ ตอน deploy จริงเปลี่ยนเป็นโดเมนจริง
  APP_URL: z.string().default("http://localhost:3000"),
  // เช่นเดียวกับ Cloudinary/SlipOK — ไม่บังคับตอน boot, gate ด้วย isEmailConfigured() แทน
  // (ดู lib/email.ts) ใช้ส่ง OTP ยืนยันตัวตนตอนสมัคร + ลิงก์ลืมรหัสผ่าน
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("BuddyBook <onboarding@resend.dev>"),
  // Gmail SMTP — ทางเลือกที่ใช้ส่งอีเมลจริงได้ทันทีโดยไม่ต้อง verify โดเมนเหมือน Resend (ดู lib/email.ts
  // ลองอันนี้ก่อนเสมอถ้าตั้งค่าไว้ ค่อย fallback ไป Resend)
  GMAIL_USER: z.string().default(""),
  GMAIL_APP_PASSWORD: z.string().default(""),
  // Stripe (เติม coin — แทน SlipOK/อัปโหลดสลิปเดิม) — เช่นเดียวกับตัวอื่น ไม่บังคับตอน boot,
  // gate ด้วย isStripeConfigured() แทน (ดู lib/stripe.ts)
  STRIPE_SECRET_KEY: z.string().default(""),
  // ได้ค่านี้จาก `stripe listen` (dev) หรือ Dashboard > Developers > Webhooks (prod) — ใช้ยืนยันว่า
  // webhook ที่ยิงเข้ามาจริงมาจาก Stripe ไม่ใช่ปลอม (constructEvent ใน lib/stripe.ts)
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  // Gift donations — ค่าธรรมเนียมแพลตฟอร์ม (%) หักจากของขวัญก่อนเข้ากระเป๋านักเขียน (ปัดเศษลงให้ฝั่ง
  // นักเขียนได้มากกว่า) ไม่หักจาก "Custom coins" เพื่อให้โดเนท coin แบบเดิมได้เต็มจำนวนเหมือนก่อนมีระบบนี้
  GIFT_PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  // เพดานยอดรวมต่อการส่งหนึ่งครั้ง (coin) — กันกดพลาดใส่จำนวนผิด
  GIFT_MAX_COINS_PER_SEND: z.coerce.number().int().positive().default(100000),
  // จำนวนครั้งที่ส่งของขวัญ/โดเนทได้ต่อผู้ใช้ต่อนาที (in-memory ต่อ process — ดู middleware/rateLimit.middleware.ts)
  GIFT_SEND_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  // เพิ่มภายหลัง (scheduler) — งานเบื้องหลังที่รันใน process ของ api เอง (ดู lib/scheduler.ts)
  // ปิดได้ด้วย SCHEDULER_ENABLED=false ถ้าจะใช้ cron ภายนอกยิง /internal/* แทน (ปิดเองอัตโนมัติตอน NODE_ENV=test)
  SCHEDULER_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  SCHEDULE_PUBLISH_INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  SCHEDULE_TRASH_PURGE_INTERVAL_SEC: z.coerce.number().int().positive().default(3600),
  SCHEDULE_RECOMMENDATION_SYNC_INTERVAL_SEC: z.coerce.number().int().positive().default(6 * 3600),
  // เพิ่มภายหลัง (auth hardening) — จำนวนครั้งต่อ IP ต่อ 15 นาทีของ endpoint login/register/OTP/ลืมรหัส
  AUTH_RATE_LIMIT_PER_15MIN: z.coerce.number().int().positive().default(20),
  // เพิ่มภายหลัง (ถอนเงินนักเขียน) — ขั้นต่ำ coin ต่อการขอถอน 1 ครั้ง และอัตรา coin → บาท
  WITHDRAWAL_MIN_COINS: z.coerce.number().int().positive().default(500),
  COIN_TO_THB_RATE: z.coerce.number().positive().default(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — ดู apps/api/.env.example");
}

export const env = parsed.data;
