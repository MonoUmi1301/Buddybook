import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAuth } from "@/middleware/auth.middleware";
import * as authController from "@/modules/auth/auth.controller";

const router = Router();

// --- Implemented (reference pattern — ดู auth.service.ts) ---
// เพิ่มภายหลัง (audit fix) — สมัครสมาชิกแยกเป็น 2 ขั้น ต้องยืนยันอีเมลด้วย OTP ก่อนถึงจะสร้างบัญชีจริง
router.post("/register/request-otp", asyncHandler(authController.requestRegisterOtp));
router.post("/register/verify-otp", asyncHandler(authController.verifyRegisterOtp));
router.post("/login", asyncHandler(authController.login));
// เพิ่มภายหลัง (audit fix — 2FA) — ขั้นที่สองของล็อกอินตอนเปิด 2FA ไว้ (รหัสผ่านถูกแล้วแต่ต้อง
// กรอกรหัสจากแอป Authenticator ต่อ) และ endpoint จัดการเปิด/ปิด 2FA เอง (ต้องล็อกอินอยู่ก่อน)
router.post("/login/verify-2fa", asyncHandler(authController.verifyLogin2fa));
router.post("/2fa/setup", requireAuth, asyncHandler(authController.setup2fa));
router.post("/2fa/confirm", requireAuth, asyncHandler(authController.confirm2fa));
router.post("/2fa/disable", requireAuth, asyncHandler(authController.disable2fa));
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/logout", asyncHandler(authController.logout));
router.post("/password/forgot", asyncHandler(authController.forgotPassword));
router.post("/password/reset", asyncHandler(authController.resetPasswordHandler));

// --- OAuth — Google/LINE/Facebook ทำงานจริงครบทั้ง 3 ราย (ดู lib/googleOAuth.ts, lib/lineOAuth.ts,
// lib/facebookOAuth.ts) แต่ละตัว gate ตัวเองด้วย isXOAuthConfigured() — ถ้ายังไม่ตั้งค่า env จะ
// ตอบ 400 ไม่ใช่ crash ตอน boot (เหมือน Cloudinary/SlipOK) ไม่ใช่ endpoint ที่ยังไม่ implement ---
router.get("/oauth/:provider", asyncHandler(authController.oauthStart));
router.post("/oauth/:provider/callback", asyncHandler(authController.oauthCallback));

export default router;
