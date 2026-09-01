import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import type { OAuthProfile } from "@/lib/oauthProfile";

/** เช่นเดียวกับ Google/Cloudinary/SlipOK — ฟีเจอร์ LINE login ทั้งหมด gate ตัวเองด้วยอันนี้ */
export function isLineOAuthConfigured(): boolean {
  return Boolean(env.LINE_CLIENT_ID && env.LINE_CLIENT_SECRET);
}

const REDIRECT_URI = () => `${env.APP_URL}/api/v1/auth/oauth/line/callback`;

export function buildLineAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINE_CLIENT_ID,
    redirect_uri: REDIRECT_URI(),
    state,
    scope: "profile openid email",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/** แลก code เป็น id_token แล้ว verify + decode ผ่าน LINE เอง (POST /oauth2/v2.1/verify) แทนการ
 *  handle JWKS/JWT verification เอง — LINE คืนค่า claims ที่ verify แล้วตรง ๆ ง่ายกว่า Google มาก
 *  หมายเหตุ: LINE ให้ email มาก็ต่อเมื่อ channel เปิดสิทธิ์ email scope ไว้ใน LINE Developers Console
 *  (Console home > channel > OpenID Connect > Email address permission) — ถ้ายังไม่เปิดหรือผู้ใช้
 *  ปฏิเสธ email จะไม่มีค่า จึงต้อง fallback เป็น placeholder ที่ unique แทน (ดู oauthProfile.ts) */
export async function exchangeLineCode(code: string): Promise<OAuthProfile> {
  if (!isLineOAuthConfigured()) {
    throw ApiError.badRequest(
      "LINE OAuth is not configured — set LINE_CLIENT_ID/LINE_CLIENT_SECRET in apps/api/.env"
    );
  }

  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI(),
        client_id: env.LINE_CLIENT_ID,
        client_secret: env.LINE_CLIENT_SECRET,
      }),
    });
  } catch {
    throw ApiError.badRequest("Could not reach LINE — ตรวจสอบการเชื่อมต่อเครือข่าย");
  }

  const tokenJson = (await tokenRes.json().catch(() => null)) as { id_token?: string } | null;
  if (!tokenRes.ok || !tokenJson?.id_token) {
    throw ApiError.unauthorized("LINE OAuth code exchange failed");
  }

  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: tokenJson.id_token, client_id: env.LINE_CLIENT_ID }),
  });
  const claims = (await verifyRes.json().catch(() => null)) as {
    sub?: string;
    name?: string;
    picture?: string;
    email?: string;
  } | null;
  if (!verifyRes.ok || !claims?.sub) {
    throw ApiError.unauthorized("Could not verify LINE id_token");
  }

  return {
    provider: "line",
    sub: claims.sub,
    email: claims.email ?? `line_${claims.sub}@line.buddybook.local`,
    name: claims.name ?? "LINE User",
    picture: claims.picture ?? null,
  };
}
