import type { Request, Response } from "express";
import { z } from "zod";
import {
  requestRegistrationOtp,
  verifyRegistrationOtp,
  loginUser,
  verifyLoginTwoFactor,
  setupTwoFactor,
  confirmTwoFactorSetup,
  disableTwoFactor,
  loginOrRegisterWithOAuth,
  requestPasswordReset,
  resetPassword,
} from "@/modules/auth/auth.service";
import { verifyRefreshToken, signAccessToken } from "@/lib/jwt";
import { buildGoogleAuthUrl, createOAuthState, verifyOAuthState, exchangeGoogleCode } from "@/lib/googleOAuth";
import { buildLineAuthUrl, exchangeLineCode } from "@/lib/lineOAuth";
import { buildFacebookAuthUrl, exchangeFacebookCode } from "@/lib/facebookOAuth";
import type { OAuthProfile } from "@/lib/oauthProfile";
import { ApiError } from "@/utils/ApiError";
import { passwordSchema } from "@/lib/passwordPolicy";

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: passwordSchema,
});

export async function requestRegisterOtp(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);
  const result = await requestRegistrationOtp(body);
  res.status(200).json(result);
}

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export async function verifyRegisterOtp(req: Request, res: Response) {
  const body = verifyOtpSchema.parse(req.body);
  const result = await verifyRegistrationOtp(body);
  res.status(201).json(result);
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  const result = await loginUser(body);
  res.status(200).json(result);
}

const verifyLoginTwoFactorSchema = z.object({
  challenge_token: z.string().min(1),
  code: z.string().length(6),
});

export async function verifyLogin2fa(req: Request, res: Response) {
  const body = verifyLoginTwoFactorSchema.parse(req.body);
  const result = await verifyLoginTwoFactor(body);
  res.status(200).json(result);
}

/** POST /auth/2fa/setup (requireAuth) */
export async function setup2fa(req: Request, res: Response) {
  const result = await setupTwoFactor(req.user!.user_id);
  res.status(200).json(result);
}

const confirm2faSchema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

/** POST /auth/2fa/confirm (requireAuth) */
export async function confirm2fa(req: Request, res: Response) {
  const body = confirm2faSchema.parse(req.body);
  const result = await confirmTwoFactorSetup(req.user!.user_id, body);
  res.status(200).json(result);
}

const disable2faSchema = z.object({
  password: z.string().min(1),
});

/** POST /auth/2fa/disable (requireAuth) */
export async function disable2fa(req: Request, res: Response) {
  const { password } = disable2faSchema.parse(req.body);
  await disableTwoFactor(req.user!.user_id, password);
  res.status(204).send();
}

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export async function refresh(req: Request, res: Response) {
  const { refresh_token } = refreshSchema.parse(req.body);

  try {
    const payload = verifyRefreshToken(refresh_token);
    const access_token = signAccessToken({ user_id: payload.user_id, role: payload.role });
    res.status(200).json({ access_token });
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }
}

export async function logout(_req: Request, res: Response) {
  // Stateless JWT — ฝั่ง client ทิ้ง token เอง; ถ้าต้องการ revoke จริง
  // ให้เพิ่ม refresh-token denylist table แล้วเช็คตรงนี้
  res.status(204).send();
}

const forgotPasswordSchema = z.object({ email: z.string().email() });

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  await requestPasswordReset(email);
  // ตอบหน้าตาเดียวกันเสมอไม่ว่าอีเมลจะมีอยู่จริงหรือไม่ (กัน user enumeration)
  res.status(200).json({ message: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว" });
}

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: passwordSchema,
});

export async function resetPasswordHandler(req: Request, res: Response) {
  const { token, new_password } = resetPasswordSchema.parse(req.body);
  await resetPassword(token, new_password);
  res.status(204).send();
}

const oauthProviderSchema = z.object({ provider: z.enum(["google", "facebook", "line"]) });

const buildAuthUrlByProvider: Partial<Record<"google" | "facebook" | "line", (state: string) => string>> = {
  google: buildGoogleAuthUrl,
  line: buildLineAuthUrl,
  facebook: buildFacebookAuthUrl,
};

const exchangeCodeByProvider: Partial<
  Record<"google" | "facebook" | "line", (code: string) => Promise<OAuthProfile>>
> = {
  google: exchangeGoogleCode,
  line: exchangeLineCode,
  facebook: exchangeFacebookCode,
};

/** GET /auth/oauth/:provider — คืน URL ให้ Next.js route handler สั่ง redirect ต่อ
 *  (ไม่ redirect ตรงจาก Express เพราะ Next.js เป็นชั้นเดียวที่ browser คุยด้วยตรง ๆ) */
export async function oauthStart(req: Request, res: Response) {
  const { provider } = oauthProviderSchema.parse(req.params);
  const buildAuthUrl = buildAuthUrlByProvider[provider];
  if (!buildAuthUrl) {
    throw ApiError.badRequest(`${provider} login is not implemented yet`);
  }

  const state = createOAuthState();
  res.status(200).json({ redirect_url: buildAuthUrl(state), state });
}

const oauthCallbackBodySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

/** POST /auth/oauth/:provider/callback — เรียกจาก Next.js route handler หลัง provider redirect
 *  code กลับมาที่ /api/v1/auth/oauth/:provider/callback (ดู REDIRECT_URI ใน googleOAuth.ts/lineOAuth.ts) */
export async function oauthCallback(req: Request, res: Response) {
  const { provider } = oauthProviderSchema.parse(req.params);
  const { code, state } = oauthCallbackBodySchema.parse(req.body);

  const exchangeCode = exchangeCodeByProvider[provider];
  if (!exchangeCode) {
    throw ApiError.badRequest(`${provider} login is not implemented yet`);
  }
  if (!verifyOAuthState(state)) {
    throw ApiError.unauthorized("Invalid OAuth state — possible CSRF attempt");
  }

  const profile = await exchangeCode(code);
  const result = await loginOrRegisterWithOAuth(profile);
  res.status(200).json(result);
}
