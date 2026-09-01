"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FacebookIcon, LineIcon, GoogleIcon } from "@/components/ui/SocialIcon";
import { PasswordRequirementsHint } from "@/components/auth/PasswordRequirementsHint";
import { formatApiError } from "@/lib/formatApiError";

interface AuthFormProps {
  mode: "login" | "register";
}

const OTP_RESEND_COOLDOWN_SEC = 60;

/**
 * การ์ดฟอร์ม Login/Register — ดู wf_login.png
 * ต่อกับ /api/v1/auth/login และ /api/v1/auth/register จริง (เป็น endpoint เดียวที่
 * apps/api มี service implementation จริงแล้ว — ดู auth.service.ts) endpoint อื่น ๆ
 * ในโปรเจกต์ยังเป็น notImplemented stub ฝั่ง Express จึงยังต่อจริงไม่ได้
 *
 * หมายเหตุ: field ต่างจาก wireframe เล็กน้อย (login ใช้ email ไม่ใช่ username) เพราะ
 * ต้องตรงกับ contract จริงของ auth.controller.ts (loginSchema = {email, password})
 *
 * เพิ่มภายหลัง (audit fix — ยืนยันอีเมลด้วย OTP) — โหมด register ตอนนี้แยกเป็น 2 ขั้น:
 * "form" (กรอกข้อมูลสมัคร → ขอ OTP) แล้วค่อย "otp" (กรอกรหัส 6 หลักที่ส่งไปอีเมล → สร้างบัญชีจริง
 * + auto-login) โหมด login ไม่เปลี่ยนแปลง ยังเป็นฟอร์มขั้นตอนเดียวเหมือนเดิม
 */
export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === "login";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // เพิ่มภายหลัง (audit fix — ความปลอดภัยรหัสผ่าน) — ต้อง track เป็น state (ไม่ใช่แค่ FormData ตอน
  // submit เหมือนเดิม) เพื่อโชว์ PasswordRequirementsHint แบบสด ๆ ตอนพิมพ์ (เฉพาะโหมด register)
  const [password, setPassword] = useState("");

  const [step, setStep] = useState<"form" | "otp" | "2fa">("form");
  // เพิ่มภายหลัง (audit fix — 2FA) — ตอนล็อกอิน ถ้าบัญชีเปิด 2FA ไว้ backend จะตอบ challenge_token
  // แทน token จริง ต้องเก็บไว้ส่งต่อพร้อมรหัส 6 หลักจากแอป Authenticator ที่ /login/verify-2fa
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verifying2fa, setVerifying2fa] = useState(false);
  // เก็บข้อมูลสมัครทั้งชุดไว้ (ไม่ใช่แค่อีเมล) เพื่อให้ "ส่งรหัสอีกครั้ง" เรียก request-otp ซ้ำด้วย
  // ข้อมูลจริงชุดเดิมได้ — ไม่งั้นจะไม่รู้ username/password เดิมตอนกดขอรหัสใหม่
  const [pendingRegisterBody, setPendingRegisterBody] = useState<{
    username: string;
    email: string;
    password: string;
  } | null>(null);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const path = isLogin ? "/api/v1/auth/login" : "/api/v1/auth/register";
    const email = formData.get("email") as string;
    const registerBody = { username: formData.get("username") as string, email, password };
    const body = isLogin ? { email, password } : registerBody;

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(formatApiError(json, "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"));
        return;
      }

      if (isLogin) {
        if (json && typeof json === "object" && (json as { requires_2fa?: boolean }).requires_2fa) {
          setChallengeToken((json as { challenge_token: string }).challenge_token);
          setStep("2fa");
          return;
        }
        router.push("/");
        router.refresh();
      } else {
        setPendingRegisterBody(registerBody);
        setStep("otp");
        setCooldown(OTP_RESEND_COOLDOWN_SEC);
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingRegisterBody) return;
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/v1/auth/register/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingRegisterBody.email, otp }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(formatApiError(json, "ยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setVerifying(false);
    }
  }

  async function handleVerifyTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setVerifying2fa(true);
    try {
      const res = await fetch("/api/v1/auth/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challengeToken, code: twoFactorCode }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(formatApiError(json, "รหัสไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง"));
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setVerifying2fa(false);
    }
  }

  async function handleResendOtp() {
    if (!pendingRegisterBody || cooldown > 0) return;
    setError(null);
    setResending(true);
    try {
      // ใช้ endpoint เดียวกับตอนขอครั้งแรก ด้วยข้อมูลชุดเดิมที่เก็บไว้ — backend upsert ให้เอง
      // (รหัส OTP เก่าถูกแทนที่ด้วยรหัสใหม่ อายุนับใหม่)
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingRegisterBody),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "ส่งรหัสอีกครั้งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        return;
      }
      setCooldown(OTP_RESEND_COOLDOWN_SEC);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo variant="light" className="text-h3" />
      </div>

      {isLogin && step === "2fa" ? (
        <form className="space-y-3" onSubmit={handleVerifyTwoFactor}>
          <p className="text-center text-sm text-neutral-600">
            กรอกรหัส 6 หลักจากแอป Authenticator ของคุณ
          </p>
          <Input
            name="twoFactorCode"
            placeholder="รหัส 6 หลัก"
            inputMode="numeric"
            maxLength={6}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            variant="tan"
            fullWidth
            size="lg"
            loading={verifying2fa}
            disabled={twoFactorCode.length !== 6}
          >
            ยืนยัน
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setChallengeToken(null);
                setTwoFactorCode("");
                setError(null);
              }}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
            >
              กลับไปเข้าสู่ระบบใหม่
            </button>
          </div>
        </form>
      ) : !isLogin && step === "otp" ? (
        <form className="space-y-3" onSubmit={handleVerifyOtp}>
          <p className="text-center text-sm text-neutral-600">
            เราส่งรหัสยืนยัน 6 หลักไปที่{" "}
            <span className="font-medium text-neutral-900">{pendingRegisterBody?.email}</span> แล้ว
          </p>
          <Input
            name="otp"
            placeholder="รหัส 6 หลัก"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" variant="tan" fullWidth size="lg" loading={verifying} disabled={otp.length !== 6}>
            ยืนยัน
          </Button>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setOtp("");
                setError(null);
              }}
              className="font-medium hover:text-neutral-700"
            >
              กลับไปแก้ไขข้อมูล
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || resending}
              className="font-medium text-primary-500 hover:text-primary-600 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              {cooldown > 0 ? `ส่งรหัสอีกครั้ง (${cooldown}s)` : "ส่งรหัสอีกครั้ง"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="space-y-3">
            <Button
              type="button"
              variant="facebook"
              fullWidth
              size="lg"
              className="relative"
              onClick={() => {
                window.location.href = "/api/v1/auth/oauth/facebook";
              }}
            >
              <FacebookIcon className="absolute left-5 h-5 w-5" />
              {isLogin ? "เข้าสู่ระบบด้วย Facebook" : "สมัครสมาชิกด้วย Facebook"}
            </Button>
            <Button
              type="button"
              variant="line"
              fullWidth
              size="lg"
              className="relative"
              onClick={() => {
                window.location.href = "/api/v1/auth/oauth/line";
              }}
            >
              <LineIcon className="absolute left-5 h-5 w-5" />
              {isLogin ? "เข้าสู่ระบบด้วย Line" : "สมัครสมาชิกด้วย Line"}
            </Button>
            <Button
              type="button"
              variant="google"
              fullWidth
              size="lg"
              className="relative"
              onClick={() => {
                window.location.href = "/api/v1/auth/oauth/google";
              }}
            >
              <GoogleIcon className="absolute left-5 h-5 w-5" />
              {isLogin ? "เข้าสู่ระบบด้วย Google" : "สมัครสมาชิกด้วย Google"}
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs font-semibold text-neutral-500">
              {isLogin ? "หรือ เข้าสู่ระบบด้วยบัญชีผู้ใช้" : "หรือ สร้างบัญชีผู้ใช้"}
            </span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {!isLogin && (
              <Input name="username" placeholder="Username" autoComplete="username" minLength={3} required />
            )}
            <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
            <div>
              <Input
                name="password"
                type="password"
                placeholder="Password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={isLogin ? undefined : 8}
                required
              />
              {!isLogin && <PasswordRequirementsHint password={password} />}
              {isLogin && (
                <div className="mt-1.5 text-right">
                  <Link href="/forgot-password" className="text-xs font-medium text-primary-500 hover:text-primary-600">
                    ลืม Password
                  </Link>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" variant="tan" fullWidth size="lg" loading={loading} className="mt-2">
              {isLogin ? "เข้าสู่ระบบ" : "ส่งข้อมูล"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-neutral-600">
            {isLogin ? (
              <>
                ยังไม่มีบัญชี BuddyBook ?{" "}
                <Link href="/register" className="font-medium text-sky-600 hover:underline">
                  สมัครสมาชิกที่นี่
                </Link>
              </>
            ) : (
              <>
                มีบัญชี BuddyBook แล้ว?{" "}
                <Link href="/login" className="font-medium text-sky-600 hover:underline">
                  เข้าสู่ระบบ
                </Link>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
