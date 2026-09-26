import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAuth } from "@/middleware/auth.middleware";
import { bodyField, rateLimitByKey, rateLimitPerUser } from "@/middleware/rateLimit.middleware";
import { env } from "@/config/env";
import * as authController from "@/modules/auth/auth.controller";

const router = Router();

// เพิ่มภายหลัง (auth hardening) — จำกัดจำนวนครั้งต่อบัญชีเป้าหมายต่อ 15 นาที (ดู rateLimitByKey)
// กันเดารหัสผ่าน / เดา OTP / ยิงอีเมล OTP-ลืมรหัสผ่านใส่อีเมลเดียวซ้ำ ๆ
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const authLimit = (bucket: string, field: string) =>
  rateLimitByKey({
    bucket,
    max: () => env.AUTH_RATE_LIMIT_PER_15MIN,
    windowMs: AUTH_WINDOW_MS,
    key: bodyField(field),
    message: "พยายามหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่",
  });
// ยืนยัน/ปิด 2FA ต้องกรอกรหัส 6 หลัก — จำกัดต่อผู้ใช้กันเดารหัสด้วย session ที่ขโมยมา
const twoFactorLimit = rateLimitPerUser({ bucket: "auth-2fa-manage", max: () => env.AUTH_RATE_LIMIT_PER_15MIN, windowMs: AUTH_WINDOW_MS });

// --- Implemented (reference pattern — ดู auth.service.ts) ---
// เพิ่มภายหลัง (audit fix) — สมัครสมาชิกแยกเป็น 2 ขั้น ต้องยืนยันอีเมลด้วย OTP ก่อนถึงจะสร้างบัญชีจริง
router.post("/register/request-otp", authLimit("auth-register-otp", "email"), asyncHandler(authController.requestRegisterOtp));
router.post("/register/verify-otp", authLimit("auth-verify-otp", "email"), asyncHandler(authController.verifyRegisterOtp));
router.post("/login", authLimit("auth-login", "email"), asyncHandler(authController.login));
// เพิ่มภายหลัง (audit fix — 2FA) — ขั้นที่สองของล็อกอินตอนเปิด 2FA ไว้ (รหัสผ่านถูกแล้วแต่ต้อง
// กรอกรหัสจากแอป Authenticator ต่อ) และ endpoint จัดการเปิด/ปิด 2FA เอง (ต้องล็อกอินอยู่ก่อน)
router.post("/login/verify-2fa", authLimit("auth-verify-2fa", "challenge_token"), asyncHandler(authController.verifyLogin2fa));
router.post("/2fa/setup", requireAuth, asyncHandler(authController.setup2fa));
router.post("/2fa/confirm", requireAuth, twoFactorLimit, asyncHandler(authController.confirm2fa));
router.post("/2fa/disable", requireAuth, twoFactorLimit, asyncHandler(authController.disable2fa));
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));
router.post("/password/forgot", authLimit("auth-forgot", "email"), asyncHandler(authController.forgotPassword));
router.post("/password/reset", authLimit("auth-reset", "token"), asyncHandler(authController.resetPasswordHandler));

// --- OAuth — Google/LINE/Facebook ทำงานจริงครบทั้ง 3 ราย (ดู lib/googleOAuth.ts, lib/lineOAuth.ts,
// lib/facebookOAuth.ts) แต่ละตัว gate ตัวเองด้วย isXOAuthConfigured() — ถ้ายังไม่ตั้งค่า env จะ
// ตอบ 400 ไม่ใช่ crash ตอน boot (เหมือน Cloudinary/SlipOK) ไม่ใช่ endpoint ที่ยังไม่ implement ---
router.get("/oauth/:provider", asyncHandler(authController.oauthStart));
router.post("/oauth/:provider/callback", asyncHandler(authController.oauthCallback));

export default router;
