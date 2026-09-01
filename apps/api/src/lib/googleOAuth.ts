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

/** เซ็น state ด้วย HMAC(JWT_SECRET) แทนการเก็บ session ฝั่ง server (สถาปัตยกรรมนี้ stateless
 *  ล้วน ใช้ JWT อย่างเดียว ไม่มี session store) — ป้องกัน CSRF โดยเช็คลายเซ็นตอน callback
 *  แทนที่จะเทียบกับค่าที่จำไว้ */
export function createOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", env.JWT_SECRET).update(nonce).digest("hex");
  return `${nonce}.${signature}`;
}

export function verifyOAuthState(state: string): boolean {
  const [nonce, signature] = state.split(".");
  if (!nonce || !signature) return false;
  const expected = crypto.createHmac("sha256", env.JWT_SECRET).update(nonce).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
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

  return { provider: "google", sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture };
}
