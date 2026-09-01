import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import type { OAuthProfile } from "@/lib/oauthProfile";

/** เช่นเดียวกับ Google/LINE — ฟีเจอร์ Facebook login ทั้งหมด gate ตัวเองด้วยอันนี้ */
export function isFacebookOAuthConfigured(): boolean {
  return Boolean(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET);
}

const GRAPH_VERSION = "v19.0";
const REDIRECT_URI = () => `${env.APP_URL}/api/v1/auth/oauth/facebook/callback`;

export function buildFacebookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_CLIENT_ID,
    redirect_uri: REDIRECT_URI(),
    state,
    scope: "email,public_profile",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

interface FacebookUserInfo {
  id: string;
  name: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

/** แลก code เป็น access_token ผ่าน Graph API ตรง ๆ (GET แทน POST — เป็นพฤติกรรมของ Facebook เอง
 *  ต่างจาก Google/LINE ที่ใช้ POST) แล้วเรียก /me ต่อเพื่อดึงโปรไฟล์ — email อาจไม่มีถ้าบัญชี Facebook
 *  ของผู้ใช้ไม่ได้ยืนยันอีเมลไว้ จึง fallback เป็น placeholder เหมือน lineOAuth.ts */
export async function exchangeFacebookCode(code: string): Promise<OAuthProfile> {
  if (!isFacebookOAuthConfigured()) {
    throw ApiError.badRequest(
      "Facebook OAuth is not configured — set FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET in apps/api/.env"
    );
  }

  const tokenParams = new URLSearchParams({
    client_id: env.FACEBOOK_CLIENT_ID,
    client_secret: env.FACEBOOK_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI(),
    code,
  });

  let tokenRes: Response;
  try {
    tokenRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams}`);
  } catch {
    throw ApiError.badRequest("Could not reach Facebook — ตรวจสอบการเชื่อมต่อเครือข่าย");
  }

  const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokenRes.ok || !tokenJson?.access_token) {
    throw ApiError.unauthorized("Facebook OAuth code exchange failed");
  }

  const profileParams = new URLSearchParams({
    fields: "id,name,email,picture",
    access_token: tokenJson.access_token,
  });
  const profileRes = await fetch(`https://graph.facebook.com/me?${profileParams}`);
  const profile = (await profileRes.json().catch(() => null)) as FacebookUserInfo | null;
  if (!profileRes.ok || !profile?.id) {
    throw ApiError.unauthorized("Could not fetch Facebook profile");
  }

  return {
    provider: "facebook",
    sub: profile.id,
    email: profile.email ?? `facebook_${profile.id}@facebook.buddybook.local`,
    name: profile.name ?? "Facebook User",
    picture: profile.picture?.data?.url ?? null,
  };
}
