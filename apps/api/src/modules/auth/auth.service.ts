import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyResetToken,
  signTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
} from "@/lib/jwt";
import { ApiError } from "@/utils/ApiError";
import { isEmailConfigured, sendOtpEmail, sendPasswordResetEmail } from "@/lib/email";
import { generateTotpSecret, buildTotpUri, generateTotpQrCodeDataUrl, verifyTotpCode } from "@/lib/totp";
import { env } from "@/config/env";
import type { OAuthProfile } from "@/lib/oauthProfile";

// เพิ่มภายหลัง (audit fix — ความปลอดภัยรหัสผ่าน) — เดิม 10 rounds ยังปลอดภัยอยู่ (ขั้นต่ำที่ OWASP
// แนะนำ) แต่ 12 เป็นค่าที่แนะนำกันทั่วไปมากกว่าสำหรับปี 2026 (เผื่อ headroom กับฮาร์ดแวร์ที่เร็วขึ้น)
// ไม่กระทบ hash เดิมที่มีอยู่แล้วในฐานข้อมูล — bcrypt เก็บ cost factor ไว้ใน hash string เอง
// user เก่าจะยัง login ได้ปกติด้วย cost เดิม (10) จนกว่าจะเปลี่ยนรหัสผ่านครั้งถัดไปถึงจะได้ cost ใหม่
const SALT_ROUNDS = 12;

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

// เพิ่มภายหลัง (audit fix — ยืนยันอีเมลด้วย OTP) — ตั้งใจแยกเป็น 2 ขั้น (ขอ OTP → กรอกยืนยัน)
// แทนที่ registerUser เดิมที่สร้างบัญชีทันที ดูคอมเมนต์เต็มที่ model PendingRegistration
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Reference implementation — POST /auth/register/request-otp
 *  ยังไม่สร้างแถว User ใด ๆ — แค่เก็บข้อมูลสมัครไว้ชั่วคราวใน PendingRegistration แล้วส่ง OTP
 *  ไปอีเมล รอ verifyRegistrationOtp ยืนยันถูกต้องก่อนถึงจะสร้างบัญชีจริง */
export async function requestRegistrationOtp({ username, email, password }: RegisterInput) {
  if (!isEmailConfigured()) {
    throw ApiError.badRequest("ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { user_id: true },
  });
  if (existingUser) {
    throw ApiError.conflict("Username or email already in use");
  }

  // กันสองอีเมลแย่ง username เดียวกันตอนที่ต่างฝ่ายต่างยังไม่ยืนยัน OTP เสร็จ
  const existingPendingUsername = await prisma.pendingRegistration.findFirst({
    where: { username, email: { not: email } },
    select: { pending_id: true },
  });
  if (existingPendingUsername) {
    throw ApiError.conflict("Username or email already in use");
  }

  const existingPending = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (existingPending && existingPending.created_at.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS) {
    throw ApiError.tooManyRequests("กรุณารอสักครู่ก่อนขอรหัสใหม่อีกครั้ง");
  }

  const code = generateOtpCode();
  const [otp_hash, password_hash] = await Promise.all([
    bcrypt.hash(code, SALT_ROUNDS),
    bcrypt.hash(password, SALT_ROUNDS),
  ]);
  const expires_at = new Date(Date.now() + OTP_TTL_MS);

  await prisma.pendingRegistration.upsert({
    where: { email },
    create: { username, email, password_hash, otp_hash, expires_at },
    update: { username, password_hash, otp_hash, attempts: 0, expires_at, created_at: new Date() },
  });

  try {
    await sendOtpEmail(email, code);
  } catch {
    // ตั้งใจไม่ throw raw error (500) ออกไป — ให้ frontend เห็นข้อความที่เข้าใจได้ชัดเจนแทน
    // PendingRegistration ที่สร้างไว้แล้วยังอยู่ (ไม่ลบทิ้ง) เผื่อกด "ส่งรหัสอีกครั้ง" ได้หลังคูลดาวน์
    throw ApiError.badRequest("ส่งอีเมลไม่สำเร็จ กรุณาตรวจสอบว่าอีเมลถูกต้อง หรือลองใหม่อีกครั้งภายหลัง");
  }

  return { email };
}

interface VerifyOtpInput {
  email: string;
  otp: string;
}

/** Reference implementation — POST /auth/register/verify-otp
 *  กรอก OTP ถูกต้อง → สร้างบัญชีจริงจากข้อมูลที่เก็บไว้ + ลบ PendingRegistration ทิ้ง แล้ว
 *  ออก token ให้เลย (auto-login) เพราะยืนยันทั้งอีเมลและรหัสผ่านมาแล้วครบตามเงื่อนไข login ปกติ */
export async function verifyRegistrationOtp({ email, otp }: VerifyOtpInput) {
  const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
  if (!pending) {
    throw ApiError.badRequest("ไม่พบคำขอสมัครสมาชิกสำหรับอีเมลนี้ กรุณาสมัครใหม่");
  }
  if (pending.expires_at.getTime() < Date.now()) {
    await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
    throw ApiError.badRequest("รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่");
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest("กรอกรหัสผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่");
  }

  const matches = await bcrypt.compare(otp, pending.otp_hash);
  if (!matches) {
    await prisma.pendingRegistration.update({ where: { email }, data: { attempts: { increment: 1 } } });
    throw ApiError.unauthorized("รหัสไม่ถูกต้อง");
  }

  // เช็ค uniqueness ซ้ำอีกรอบก่อนสร้างจริง เผื่อมีคนอื่นสมัครชื่อ/อีเมลนี้สำเร็จไปแล้วระหว่างที่รอ OTP
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: pending.email }, { username: pending.username }] },
    select: { user_id: true },
  });
  if (existingUser) {
    await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
    throw ApiError.conflict("Username or email already in use");
  }

  const user = await prisma.user.create({
    data: { username: pending.username, email: pending.email, password_hash: pending.password_hash },
  });
  await prisma.pendingRegistration.delete({ where: { email } });

  const tokenPayload = { user_id: user.user_id, role: user.role };
  return {
    access_token: signAccessToken(tokenPayload),
    refresh_token: signRefreshToken(tokenPayload),
    user: { user_id: user.user_id, username: user.username, role: user.role },
  };
}

interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password_hash) {
    // ข้อความเดียวกันไม่ว่า email จะมีอยู่จริงหรือไม่ (กัน user enumeration)
    throw ApiError.unauthorized("Invalid credentials");
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw ApiError.unauthorized("Invalid credentials");
  }

  if (user.is_suspended) {
    throw ApiError.forbidden("This account has been suspended");
  }

  // เพิ่มภายหลัง (audit fix — 2FA) — รหัสผ่านถูกแล้ว แต่ถ้าเปิด 2FA ไว้ ยังไม่ออก access/refresh
  // token จริงตอนนี้ ออก challenge token อายุสั้นแทน ให้ frontend ไปเก็บรหัสผ่านที่ 2 (จากแอป
  // Authenticator) ต่อที่ POST /auth/login/verify-2fa ก่อนถึงจะได้ token จริง
  if (user.totp_enabled) {
    return { requires_2fa: true as const, challenge_token: signTwoFactorChallengeToken(user.user_id) };
  }

  const tokenPayload = { user_id: user.user_id, role: user.role };

  return {
    requires_2fa: false as const,
    access_token: signAccessToken(tokenPayload),
    refresh_token: signRefreshToken(tokenPayload),
    user: { user_id: user.user_id, username: user.username, role: user.role },
  };
}

interface VerifyLoginTwoFactorInput {
  challenge_token: string;
  code: string;
}

/** Reference implementation — POST /auth/login/verify-2fa (ขั้นที่สองของล็อกอินตอนเปิด 2FA ไว้) */
export async function verifyLoginTwoFactor({ challenge_token, code }: VerifyLoginTwoFactorInput) {
  let user_id: string;
  try {
    user_id = verifyTwoFactorChallengeToken(challenge_token);
  } catch {
    throw ApiError.unauthorized("เซสชันหมดอายุ กรุณาล็อกอินใหม่อีกครั้ง");
  }

  const user = await prisma.user.findUnique({ where: { user_id } });
  if (!user || !user.totp_enabled || !user.totp_secret) {
    throw ApiError.unauthorized("บัญชีนี้ไม่ได้เปิดใช้ 2FA");
  }
  if (user.is_suspended) {
    throw ApiError.forbidden("This account has been suspended");
  }
  if (!verifyTotpCode(user.totp_secret, code)) {
    throw ApiError.unauthorized("รหัสจากแอป Authenticator ไม่ถูกต้อง");
  }

  const tokenPayload = { user_id: user.user_id, role: user.role };
  return {
    access_token: signAccessToken(tokenPayload),
    refresh_token: signRefreshToken(tokenPayload),
    user: { user_id: user.user_id, username: user.username, role: user.role },
  };
}

/** Reference implementation — POST /auth/2fa/setup (requireAuth) — สร้าง secret ใหม่ + QR code
 *  ให้สแกน ยังไม่บันทึกลง User จนกว่าจะยืนยันรหัสจากแอปถูกต้องก่อน (ดู confirmTwoFactorSetup) */
export async function setupTwoFactor(user_id: string) {
  const user = await prisma.user.findUnique({ where: { user_id }, select: { email: true, totp_enabled: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.totp_enabled) throw ApiError.conflict("เปิดใช้ 2FA อยู่แล้ว");

  const secret = generateTotpSecret();
  const otpauthUri = buildTotpUri(user.email, secret);
  const qr_code_data_url = await generateTotpQrCodeDataUrl(otpauthUri);

  return { secret, qr_code_data_url };
}

interface ConfirmTwoFactorInput {
  secret: string;
  code: string;
}

/** Reference implementation — POST /auth/2fa/confirm (requireAuth) — ยืนยันว่าสแกน/เพิ่ม secret
 *  ลงแอปถูกต้องจริง (กรอกรหัสจากแอปที่คำนวณจาก secret เดียวกันได้ตรงกัน) ก่อนเปิดใช้งาน 2FA จริง */
export async function confirmTwoFactorSetup(user_id: string, { secret, code }: ConfirmTwoFactorInput) {
  if (!verifyTotpCode(secret, code)) {
    throw ApiError.unauthorized("รหัสจากแอป Authenticator ไม่ถูกต้อง");
  }
  await prisma.user.update({ where: { user_id }, data: { totp_secret: secret, totp_enabled: true } });
  return { totp_enabled: true };
}

/** Reference implementation — POST /auth/2fa/disable (requireAuth) — ต้องกรอกรหัสผ่านซ้ำก่อนปิด
 *  2FA เสมอ (กันกรณี session ถูกขโมยแล้วสั่งปิด 2FA แทนเจ้าของโดยไม่รู้รหัสผ่านจริง) */
export async function disableTwoFactor(user_id: string, password: string) {
  const user = await prisma.user.findUnique({ where: { user_id }, select: { password_hash: true } });
  if (!user || !user.password_hash) throw ApiError.badRequest("บัญชีนี้ไม่มีรหัสผ่านให้ยืนยัน");

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) throw ApiError.unauthorized("รหัสผ่านไม่ถูกต้อง");

  await prisma.user.update({ where: { user_id }, data: { totp_secret: null, totp_enabled: false } });
}

/** สร้าง username ที่ไม่ชนกับใคร จาก email prefix ของ Google — ลองชื่อตรง ๆ ก่อน แล้วค่อยเติม
 *  เลขท้ายถ้าชนซ้ำ (username มี unique constraint) จำกัดจำนวนรอบกันลูปไม่รู้จบ */
async function generateUniqueUsername(base: string): Promise<string> {
  const cleaned = base.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40) || "user";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? cleaned : `${cleaned}${Math.floor(Math.random() * 10000)}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { user_id: true } });
    if (!existing) return candidate;
  }
  throw ApiError.conflict("Could not generate a unique username");
}

/** Reference implementation — login/register ผ่าน OAuth (Google/LINE, GET /auth/oauth/:provider/callback)
 *  ผูกบัญชีด้วย (oauth_provider, oauth_id) เป็นหลัก — ถ้ายังไม่เคยมี แต่ email ตรงกับบัญชี
 *  password เดิมที่มีอยู่แล้ว ให้ผูก oauth เข้ากับบัญชีเดิมแทนสร้างใหม่ซ้ำ (กัน 2 บัญชีคนละรหัส
 *  ผ่านอีเมลเดียวกัน) */
export async function loginOrRegisterWithOAuth(profile: OAuthProfile) {
  let user = await prisma.user.findUnique({
    where: { oauth_provider_oauth_id: { oauth_provider: profile.provider, oauth_id: profile.sub } },
  });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { user_id: existingByEmail.user_id },
        data: { oauth_provider: profile.provider, oauth_id: profile.sub },
      });
    } else {
      const username = await generateUniqueUsername(profile.email.split("@")[0]);
      user = await prisma.user.create({
        data: {
          username,
          email: profile.email,
          oauth_provider: profile.provider,
          oauth_id: profile.sub,
          avatar_url: profile.picture,
        },
      });
    }
  }

  if (user.is_suspended) {
    throw ApiError.forbidden("This account has been suspended");
  }

  const tokenPayload = { user_id: user.user_id, role: user.role };

  return {
    access_token: signAccessToken(tokenPayload),
    refresh_token: signRefreshToken(tokenPayload),
    user: { user_id: user.user_id, username: user.username, role: user.role },
  };
}

/** Reference implementation — POST /auth/password/forgot
 *  เพิ่มภายหลัง (audit fix) — ตอนนี้มี Resend แล้ว ส่งลิงก์ตั้งรหัสผ่านใหม่ไปอีเมลจริง แทนที่การคืน
 *  reset_link ตรง ๆ ใน response แบบเดิม (ซึ่งเท่ากับเปิดเผยว่าอีเมลนี้มีบัญชีอยู่จริงหรือไม่ — ตอนนี้ปิด
 *  ช่องโหว่นั้นแล้วเพราะคืน response หน้าตาเดียวกันเสมอไม่ว่าอีเมลจะมีอยู่จริงหรือไม่)
 *  token เซ็นด้วย JWT_REFRESH_SECRET แยกจาก access token หมดอายุ 30 นาที (ดู signResetToken) */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { user_id: true, password_hash: true } });
  if (!user || !user.password_hash) {
    // ไม่มีบัญชี หรือเป็นบัญชี OAuth ล้วน (ไม่มีรหัสผ่านให้ reset) — ทำเหมือนสำเร็จเสมอ ไม่ throw
    // และไม่ส่งอีเมล เพื่อลด user enumeration
    return;
  }

  const token = signResetToken(user.user_id);
  const resetLink = `${env.APP_URL}/reset-password?token=${token}`;

  if (isEmailConfigured()) {
    await sendPasswordResetEmail(email, resetLink);
  }
}

export async function resetPassword(token: string, newPassword: string) {
  let user_id: string;
  try {
    user_id = verifyResetToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired reset link");
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { user_id }, data: { password_hash, updated_at: new Date() } });
}
