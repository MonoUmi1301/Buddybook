import crypto from "node:crypto";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import type { OAuthProfile } from "@/lib/oauthProfile";

/** เช่นเดียวกับ Cloudinary/SlipOK — ฟีเจอร์ Google login ทั้งหมด gate ตัวเองด้วยอันนี้
 *  ไม่บังคับให้ตั้งค่าตอน boot เพราะยังไม่มีทุกโปรเจกต์ที่ต้องใช้ */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

const REDIRECT_URI = () => `${env.APP_URL}/api/v1/auth/oauth/google/callback`;

/** อายุของ state — ต้องตรงกับ maxAge ของ cookie bb_oauth_state ฝั่ง apps/web */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

function signState(payload: string) {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
}

/** state = "<nonce>.<issuedAtMs>.<HMAC(JWT_SECRET)>" — ลายเซ็นกันปลอม, issuedAt ทำให้หมดอายุได้
 *  ส่วนการผูกกับเบราว์เซอร์ที่เริ่ม flow ทำฝั่ง apps/web: เก็บ state เดียวกันไว้ใน httpOnly cookie ตอนเริ่ม
 *  แล้วเทียบกับ ?state= ตอน callback (กัน login CSRF — เอา state ที่ขอมาเองไปให้เหยื่อใช้ไม่ได้) */
export function createOAuthState(now = Date.now()): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${nonce}.${now}`;
  return `${payload}.${signState(payload)}`;
}

/** false ทุกกรณีที่ไม่ผ่าน (รูปแบบผิด ความยาวผิด ลายเซ็นผิด หมดอายุ) — ไม่ throw ให้ controller ตอบ 401 เอง */
export function verifyOAuthState(state: string, now = Date.now()): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, issuedAtRaw, signature] = parts;
  if (!/^[0-9a-f]{32}$/.test(nonce) || !/^\d{1,15}$/.test(issuedAtRaw)) return false;

  const expected = Buffer.from(signState(`${nonce}.${issuedAtRaw}`), "utf8");
  const actual = Buffer.from(signature, "utf8");
  // timingSafeEqual throw RangeError ถ้าความยาวไม่เท่ากัน (เดิมกลายเป็น 500) — เช็คก่อนเสมอ
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;

  const issuedAt = Number(issuedAtRaw);
  return issuedAt <= now + CLOCK_SKEW_MS && now - issuedAt <= OAUTH_STATE_TTL_MS;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  email_verified: boolean;
}

/** แลก authorization code เป็น access_token ของ Google แล้วเรียก userinfo endpoint จริง
 *  (ไม่ decode id_token เองเพื่อเลี่ยงต้องจัดการ JWKS verification เพิ่ม) */
export async function exchangeGoogleCode(code: string): Promise<OAuthProfile> {
  if (!isGoogleOAuthConfigured()) {
    throw ApiError.badRequest(
      "Google OAuth is not configured — set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in apps/api/.env"
    );
  }

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI(),
        grant_type: "authorization_code",
      }),
    });
  } catch {
    throw ApiError.badRequest("Could not reach Google — ตรวจสอบการเชื่อมต่อเครือข่าย");
  }

  const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw ApiError.unauthorized("Google OAuth code exchange failed");
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = (await profileRes.json().catch(() => null)) as GoogleUserInfo | null;
  if (!profileRes.ok || !profile?.sub || !profile.email) {
    throw ApiError.unauthorized("Could not fetch Google profile");
  }

  return {
    provider: "google",
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    // userinfo คืน email_verified มาเสมอ — เชื่อเฉพาะ true ตรง ๆ เท่านั้น
    email_verified: profile.email_verified === true,
  };
}
