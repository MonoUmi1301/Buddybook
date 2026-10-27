import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyResetToken,
  signTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
  tokenPayloadFor,
} from "@/lib/jwt";
import { ApiError } from "@/utils/ApiError";
import { isEmailConfigured, sendOAuthSignInHintEmail, sendOtpEmail, sendPasswordResetEmail } from "@/lib/email";
import { generateTotpSecret, buildTotpUri, generateTotpQrCodeDataUrl, verifyTotpCode } from "@/lib/totp";
import { env } from "@/config/env";
import type { OAuthProfile } from "@/lib/oauthProfile";
import { saveVerifiedBirthDate } from "@/lib/contentRating";
import { normalizeEmail } from "@/lib/normalizeEmail";
import { EMAIL_DOMAIN_ERROR, isAllowedEmailDomain } from "@/lib/emailDomains";

// เพิ่มภายหลัง (audit fix — ความปลอดภัยรหัสผ่าน) — เดิม 10 rounds ยังปลอดภัยอยู่ (ขั้นต่ำที่ OWASP
// แนะนำ) แต่ 12 เป็นค่าที่แนะนำกันทั่วไปมากกว่าสำหรับปี 2026 (เผื่อ headroom กับฮาร์ดแวร์ที่เร็วขึ้น)
// ไม่กระทบ hash เดิมที่มีอยู่แล้วในฐานข้อมูล — bcrypt เก็บ cost factor ไว้ใน hash string เอง
// user เก่าจะยัง login ได้ปกติด้วย cost เดิม (10) จนกว่าจะเปลี่ยนรหัสผ่านครั้งถัดไปถึงจะได้ cost ใหม่
// ปรับได้ด้วย BCRYPT_ROUNDS (เทสต์ใช้ 4 — production ต้อง ≥10, ดู config/env.ts)
const SALT_ROUNDS = env.BCRYPT_ROUNDS;

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
export async function requestRegistrationOtp({ username, email: rawEmail, password }: RegisterInput) {
  const email = normalizeEmail(rawEmail);
  if (!isAllowedEmailDomain(email)) throw ApiError.badRequest(EMAIL_DOMAIN_ERROR);
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
export async function verifyRegistrationOtp({ email: rawEmail, otp }: VerifyOtpInput) {
  const email = normalizeEmail(rawEmail);
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

  // สมัครใหม่เป็น REAL เสมอ — ตั้งตรงนี้ ไม่อ่านจาก request (registerSchema ไม่มีช่อง account_type ให้ส่งมา)
  const user = await prisma.user.create({
    data: { username: pending.username, email: pending.email, password_hash: pending.password_hash, account_type: "REAL" },
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
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

  if (!user || !user.password_hash) {
    // ข้อความเดียวกันไม่ว่า email จะมีอยู่จริงหรือไม่ (กัน user enumeration)
    throw ApiError.unauthorized("Invalid credentials");
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  // บัญชี DEMO (ข้อมูลตัวอย่าง) ล็อกอินไม่ได้ — ตอบเหมือนรหัสผิดทุกประการ ไม่บอกว่าบัญชีนี้เป็น DEMO
  if (!passwordMatches || user.account_type === "DEMO") {
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
  if (user.account_type === "DEMO") throw ApiError.unauthorized("Invalid credentials");
  if (user.is_suspended) {
    throw ApiError.forbidden("This account has been suspended");
  }
  if (!verifyTotpCode(user.totp_secret, code)) {
    throw ApiError.unauthorized("รหัสจากแอป Authenticator ไม่ถูกต้อง");
  }

  const tokenPayload = tokenPayloadFor(user);
  return {
    access_token: signAccessToken(tokenPayload),
    refresh_token: signRefreshToken(tokenPayload),
    user: { user_id: user.user_id, username: user.username, role: user.role },
  };
}

/** Reference implementation — POST /auth/2fa/setup (requireAuth) — สร้าง secret ใหม่ + QR code
 *  ให้สแกน ยังไม่บันทึกลง User จนกว่าจะยืนยันรหัสจากแอปถูกต้องก่อน (ดู confirmTwoFactorSetup) */
export async function setupTwoFactor(user_id: string) {
  const user = await prisma.user.findUnique({ where: { user_id }, select: { email: true, username: true, totp_enabled: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.totp_enabled) throw ApiError.conflict("เปิดใช้ 2FA อยู่แล้ว");

  const secret = generateTotpSecret();
  const otpauthUri = buildTotpUri(user.email ?? user.username, secret);
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
async function generateUniqueUsername(
  base: string,
  opts: { unicode?: boolean; forceSuffix?: boolean } = {}
): Promise<string> {
  // unicode: ชื่อแสดงจาก provider (เช่นชื่อไทยใน LINE) — เก็บตัวอักษร/สระ/วรรณยุกต์ทุกภาษา ช่องว่างเป็น _
  const cleaned =
    (opts.unicode
      ? base.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{M}\p{N}_.]/gu, "")
      : base.replace(/[^a-zA-Z0-9_]/g, "")
    ).slice(0, 40);
  const safe = [...cleaned].length >= 3 ? cleaned : "reader";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 && !opts.forceSuffix ? safe : `${safe}${crypto.randomInt(10000)}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { user_id: true } });
    if (!existing) return candidate;
  }
  throw ApiError.conflict("Could not generate a unique username");
}

const oauthProviderLabel: Record<OAuthProfile["provider"], string> = {
  google: "Google",
  facebook: "Facebook",
  line: "LINE",
};

/** Reference implementation — login/register ผ่าน OAuth (Google/LINE/Facebook, POST /auth/oauth/:provider/callback)
 *  ผูกบัญชีด้วย (oauth_provider, oauth_id) เป็นหลัก — LINE หาจากคอลัมน์ line_user_id แทน ถ้ายังไม่เคยมี แต่ email
 *  ตรงกับบัญชีเดิม จะผูกเข้ากับบัญชีเดิมก็ต่อเมื่อ (audit fix — account takeover):
 *   - provider ยืนยันอีเมลแล้ว (email_verified) — ไม่งั้นใครตั้งอีเมลของเหยื่อในบัญชี provider ก็เข้าบัญชีเหยื่อได้
 *   - Google/Facebook: บัญชีเดิมยังไม่ผูกกับ provider อื่น — users มีช่อง oauth_provider/oauth_id ชุดเดียว เขียนทับแล้ว
 *     provider เดิมจะหลุด (ล็อกอินวิธีเดิมไม่ได้อีก) จึงปฏิเสธแทน ให้ล็อกอินด้วยวิธีเดิม
 *   - LINE: เขียนแค่ line_user_id ไม่แตะ oauth_provider เดิม ผูกได้ถ้าบัญชีเดิมยังไม่ผูก LINE อื่นไว้ (ไม่สร้างบัญชีใหม่)
 *  LINE ไม่ส่งอีเมลมา → สร้างบัญชี email = null (ไม่มีอีเมลปลอม) token มี email_required ให้เว็บพาไป /complete-profile
 *  บัญชีที่เปิด 2FA ไว้ต้องผ่านรหัสจากแอปก่อนเสมอ เหมือนล็อกอินด้วยรหัสผ่าน (คืน challenge_token แทน token จริง
 *  แล้วยืนยันต่อที่ POST /auth/login/verify-2fa) */
export async function loginOrRegisterWithOAuth(profile: OAuthProfile) {
  const email = profile.email ? normalizeEmail(profile.email) : null;
  const isLine = profile.provider === "line";
  let user = isLine
    ? await prisma.user.findUnique({ where: { line_user_id: profile.sub } })
    : await prisma.user.findUnique({
        where: { oauth_provider_oauth_id: { oauth_provider: profile.provider, oauth_id: profile.sub } },
      });

  if (!user) {
    const existingByEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (existingByEmail) {
      // บัญชี DEMO ห้ามถูกผูก provider เพิ่ม — ตอบเหมือนการเช็ค DEMO ด้านล่าง
      if (existingByEmail.account_type === "DEMO") throw ApiError.unauthorized("Invalid credentials");
      if (!profile.email_verified) {
        throw ApiError.conflict(
          `อีเมลนี้มีบัญชีอยู่แล้ว แต่ ${oauthProviderLabel[profile.provider]} ไม่ได้ยืนยันอีเมลนี้ กรุณาเข้าสู่ระบบด้วยวิธีเดิม`
        );
      }
      if (isLine) {
        if (existingByEmail.line_user_id) {
          throw ApiError.conflict("อีเมลนี้ผูกกับบัญชี LINE อื่นอยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม");
        }
        user = await prisma.user.update({
          where: { user_id: existingByEmail.user_id },
          data: { line_user_id: profile.sub },
        });
      } else {
        if (existingByEmail.oauth_provider) {
          throw ApiError.conflict(
            `อีเมลนี้ผูกกับการเข้าสู่ระบบด้วย ${oauthProviderLabel[existingByEmail.oauth_provider]} อยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม`
          );
        }
        user = await prisma.user.update({
          where: { user_id: existingByEmail.user_id },
          data: { oauth_provider: profile.provider, oauth_id: profile.sub },
        });
      }
    } else {
      // ทุก provider (Google / Facebook / LINE) ตั้ง username จากชื่อที่แสดงในบัญชีนั้นก่อน เหมือนกันทั้งหมด —
      // ใช้ prefix ของอีเมลก็ต่อเมื่อ provider ไม่ส่งชื่อมา (ค่า default "Facebook User" / "LINE User" ไม่นับ)
      const displayName = profile.name?.trim() ?? "";
      const hasRealName = displayName.length > 0 && !/^(Facebook|LINE|Google) User$/i.test(displayName);
      const emailPrefix = email && !email.endsWith(".buddybook.local") ? email.split("@")[0] : null;
      user = await createOAuthUser(hasRealName || !emailPrefix ? { base: displayName, unicode: true } : { base: emailPrefix }, {
        email,
        oauth_provider: profile.provider,
        oauth_id: profile.sub,
        line_user_id: isLine ? profile.sub : null,
        avatar_url: profile.picture,
        account_type: "REAL",
      });
    }
  } else if (!user.email && email && profile.email_verified && user.account_type === "REAL") {
    // บัญชีที่ยังไม่มีอีเมล (สมัครตอนไม่อนุญาตอีเมล / อีเมลปลอมเดิมที่ล้างแล้ว) แต่รอบนี้ LINE ส่งอีเมลมา → เติมให้เลย
    // ถ้าอีเมลนี้ไม่มีบัญชีอื่นใช้อยู่ (ถ้ามี ผู้ใช้ต้องไปกรอกอีเมลอื่นเองที่ /complete-profile — ไม่เขียนทับ)
    const taken = await prisma.user.findUnique({ where: { email }, select: { user_id: true } });
    if (!taken) user = await prisma.user.update({ where: { user_id: user.user_id }, data: { email } });
  }

  // บัญชี DEMO (seed ใช้ oauth_id ปลอม) — ปฏิเสธก่อนแตะข้อมูลใด ๆ ของบัญชี ทั้งกรณีเจอจาก oauth_id และกรณีอีเมลตรง
  if (user.account_type === "DEMO") {
    throw ApiError.unauthorized("Invalid credentials");
  }

  if (user.is_suspended) {
    throw ApiError.forbidden("This account has been suspended");
  }

  // gap 3.4 — provider ยืนยันวันเกิดมาให้ (Google People API) → ตั้งสถานะอายุจากแหล่งที่เชื่อถือได้
  // ไม่ทับผล e-KYC (บัตร + สแกนใบหน้า) ซึ่งน่าเชื่อถือกว่าวันเกิดในบัญชี Google
  if (profile.birthdate && user.age_verification_source !== "kyc") {
    await saveVerifiedBirthDate(user.user_id, profile.birthdate, "google");
  }

  if (user.totp_enabled) {
    return { requires_2fa: true as const, challenge_token: signTwoFactorChallengeToken(user.user_id) };
  }

  const tokenPayload = tokenPayloadFor(user);

  return {
    requires_2fa: false as const,
    access_token: signAccessToken(tokenPayload),
    refresh_token: signRefreshToken(tokenPayload),
    user: { user_id: user.user_id, username: user.username, role: user.role },
    needs_email: !user.email,
  };
}

/** สร้างบัญชี OAuth ใหม่ — generateUniqueUsername เช็คก่อนแล้วค่อยสร้าง ระหว่างนั้นอีกคนที่ชื่อ LINE/Google
 *  ซ้ำกันอาจได้ username เดียวกันไปก่อน (ล็อกอินพร้อมกัน) → ชน unique แล้วล็อกอินพังทั้งที่ไม่ใช่ความผิดผู้ใช้
 *  จึงลองใหม่ด้วย suffix ตัวเลขอีกไม่กี่รอบ ส่วนการชนที่ช่องอื่น (อีเมล/LINE id) โยนต่อตามปกติ */
async function createOAuthUser(
  name: { base: string; unicode?: boolean },
  data: Omit<Prisma.UserCreateInput, "username">
) {
  for (let attempt = 0; ; attempt++) {
    const username = await generateUniqueUsername(name.base, { unicode: name.unicode, forceSuffix: attempt > 0 });
    try {
      return await prisma.user.create({ data: { ...data, username } });
    } catch (err) {
      const target = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" ? err.meta?.target : null;
      const usernameClash = Array.isArray(target) ? target.includes("username") : String(target ?? "").includes("username");
      if (!usernameClash || attempt >= 4) throw err;
    }
  }
}

/** POST /auth/complete-profile/request-otp (requireAuthAllowMissingEmail) — บัญชีที่ยังไม่มีอีเมล (LINE ไม่ส่งมา)
 *  กรอกอีเมล → เช็คว่าไม่ซ้ำกับบัญชีอื่น (ซ้ำ = 409 ห้ามเขียนทับ) แล้วส่ง OTP ยังไม่เขียนอีเมลลง users จนกว่า OTP ถูก */
export async function requestCompleteProfileOtp(user_id: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { user_id }, select: { email: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.email) throw ApiError.badRequest("บัญชีนี้มีอีเมลแล้ว");

  const taken = await prisma.user.findUnique({ where: { email }, select: { user_id: true } });
  if (taken) throw ApiError.conflict("อีเมลนี้มีบัญชีอยู่แล้ว");

  // รวมโดเมนอีเมลปลอมของระบบ (seed / บัญชีที่ถูกลบ) ด้วย — ไม่อยู่ในรายชื่อผู้ให้บริการจริง
  if (!isAllowedEmailDomain(email)) throw ApiError.badRequest(EMAIL_DOMAIN_ERROR);
  // TODO: ถ้าเครื่องนี้ยังไม่ตั้งค่า Resend/Gmail จะยืนยันอีเมลไม่ได้ — ตั้ง RESEND_API_KEY หรือ GMAIL_* ใน apps/api/.env
  if (!isEmailConfigured()) {
    throw ApiError.serviceUnavailable("ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  }

  const existing = await prisma.pendingEmailVerification.findUnique({ where: { user_id } });
  if (existing && existing.created_at.getTime() > Date.now() - OTP_RESEND_COOLDOWN_MS) {
    throw ApiError.tooManyRequests("กรุณารอสักครู่ก่อนขอรหัสใหม่อีกครั้ง");
  }

  const code = generateOtpCode();
  const otp_hash = await bcrypt.hash(code, SALT_ROUNDS);
  const expires_at = new Date(Date.now() + OTP_TTL_MS);
  await prisma.pendingEmailVerification.upsert({
    where: { user_id },
    create: { user_id, email, otp_hash, expires_at },
    update: { email, otp_hash, expires_at, attempts: 0, created_at: new Date() },
  });

  await sendOtpEmail(email, code);
  return { email, expires_in_seconds: OTP_TTL_MS / 1000 };
}

/** POST /auth/complete-profile/verify-otp — OTP ถูก → เขียนอีเมลลงบัญชี (เฉพาะตอนที่ยังเป็น null) แล้วออก token ใหม่
 *  ที่ไม่มี email_required ให้เว็บตั้ง cookie ทับ */
export async function verifyCompleteProfileOtp(user_id: string, otp: string) {
  const pending = await prisma.pendingEmailVerification.findUnique({ where: { user_id } });
  if (!pending) throw ApiError.badRequest("ไม่พบคำขอยืนยันอีเมล กรุณาขอรหัสใหม่");
  if (pending.expires_at.getTime() < Date.now()) {
    await prisma.pendingEmailVerification.delete({ where: { user_id } }).catch(() => {});
    throw ApiError.badRequest("รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่");
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.badRequest("กรอกรหัสผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่");
  }
  if (!(await bcrypt.compare(otp, pending.otp_hash))) {
    await prisma.pendingEmailVerification.update({ where: { user_id }, data: { attempts: { increment: 1 } } });
    throw ApiError.unauthorized("รหัสไม่ถูกต้อง");
  }

  // อีเมลอาจถูกบัญชีอื่นใช้ไประหว่างรอ OTP — unique ชน = 409 ไม่เขียนทับ
  // where email: null = ไม่ทับอีเมลที่บัญชีนี้อาจได้มาแล้วจากอีกแท็บ
  let count: number;
  try {
    ({ count } = await prisma.user.updateMany({
      where: { user_id, email: null },
      data: { email: pending.email, updated_at: new Date() },
    }));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await prisma.pendingEmailVerification.delete({ where: { user_id } }).catch(() => {});
      throw ApiError.conflict("อีเมลนี้มีบัญชีอยู่แล้ว");
    }
    throw err;
  }
  await prisma.pendingEmailVerification.delete({ where: { user_id } }).catch(() => {});
  if (count === 0) throw ApiError.badRequest("บัญชีนี้มีอีเมลแล้ว");

  const user = await prisma.user.findUniqueOrThrow({ where: { user_id } });
  const tokenPayload = tokenPayloadFor(user);
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
export async function requestPasswordReset(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { user_id: true, password_hash: true, oauth_provider: true, account_type: true },
  });
  // response หน้าตาเดียวกันเสมอ (ไม่ throw) ไม่ว่าจะมีบัญชีหรือไม่ — กัน user enumeration
  // บัญชี DEMO รีเซ็ตรหัสผ่านไม่ได้ — ทำเหมือนไม่มีบัญชี (ไม่ส่งอีเมล)
  if (!user || user.account_type === "DEMO") return;
  if (!user.password_hash) {
    // บัญชี OAuth ล้วน (ผลทดสอบ #6) — ส่งอีเมลบอกช่องทางเข้าสู่ระบบแทน ไปที่อีเมลเจ้าของบัญชีเท่านั้น
    // ข้ามอีเมลปลอมที่ระบบสร้างให้ (Facebook ไม่ส่งอีเมลมา → facebook_xxx@facebook.buddybook.local)
    if (user.oauth_provider && isEmailConfigured() && !email.endsWith(".buddybook.local")) {
      // ไม่ await — ส่งเบื้องหลัง ให้เวลาตอบกลับใกล้เคียงกับอีเมลที่ไม่มีบัญชี (กันเดาบัญชีจากเวลาตอบ)
      void sendOAuthSignInHintEmail(email, user.oauth_provider, `${env.APP_URL}/login`).catch((err) =>
        console.error("[auth] OAuth sign-in hint email failed:", err instanceof Error ? err.message : err)
      );
    }
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

  // ลิงก์ที่ออกก่อนบัญชีถูกติดป้าย DEMO ก็ใช้ไม่ได้ — updateMany กรอง account_type ในคำสั่งเดียว
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const { count } = await prisma.user.updateMany({
    where: { user_id, account_type: "REAL" },
    data: { password_hash, updated_at: new Date() },
  });
  if (count === 0) throw ApiError.unauthorized("Invalid or expired reset link");
}
