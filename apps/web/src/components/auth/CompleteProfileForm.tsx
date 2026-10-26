"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatApiError } from "@/lib/formatApiError";
import { EMAIL_DOMAIN_ERROR, isAllowedEmailDomain } from "@/lib/emailDomains";
import { handleAsync } from "@/lib/handleAsync";

const OTP_RESEND_COOLDOWN_SEC = 60;

/**
 * หน้า /complete-profile — บัญชีที่ล็อกอินด้วย LINE แต่ LINE ไม่ส่งอีเมลมา (ผู้ใช้ไม่อนุญาตอีเมล หรือบัญชีเดิมที่เคย
 * มีอีเมลปลอม) ต้องกรอกอีเมลและยืนยัน OTP ก่อนใช้งานส่วนอื่น (proxy.ts + requireAuth ฝั่ง API บล็อกไว้)
 * ขั้น "email" → POST complete-profile/request-otp, ขั้น "otp" → POST complete-profile/verify-otp (ได้ cookie ใหม่)
 */
export function CompleteProfileForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function requestOtp() {
    setError(null);
    if (!isAllowedEmailDomain(email)) {
      setError(EMAIL_DOMAIN_ERROR);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/complete-profile/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "ส่งรหัสยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        return;
      }
      setStep("otp");
      setOtp("");
      setCooldown(OTP_RESEND_COOLDOWN_SEC);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    await requestOtp();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/complete-profile/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "ยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        return;
      }
      // โหลดหน้าใหม่ทั้งหน้า — proxy.ts อ่าน cookie token ชุดใหม่ (ไม่มี email_required) แล้วพาไป onboarding/หน้าแรกเอง
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- ต้องโหลดใหม่ทั้งหน้าให้ proxy เห็น cookie ใหม่
      window.location.assign("/");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- โหลดใหม่ทั้งหน้าเพื่อล้าง state ของผู้ใช้ที่ออกจากระบบ
      window.location.assign("/login");
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex justify-center">
        <Logo variant="light" className="text-h3" />
      </div>

      <h1 className="mb-2 text-center text-lg font-semibold text-neutral-900">เพิ่มอีเมลของคุณ</h1>

      {step === "email" ? (
        <form className="space-y-3" onSubmit={handleAsync(handleEmailSubmit)}>
          <p className="text-center text-sm text-neutral-600">
            บัญชี LINE ของคุณไม่ได้แชร์อีเมลให้เรา กรุณากรอกอีเมลเพื่อใช้ยืนยันตัวตนและติดต่อเรื่องบัญชี/การเติมเหรียญ
            ก่อนเริ่มใช้งาน
          </p>
          <Input
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoFocus
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" variant="tan" fullWidth size="lg" loading={loading} disabled={!email.trim()}>
            ส่งรหัสยืนยัน
          </Button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={handleAsync(handleVerify)}>
          <p className="text-center text-sm text-neutral-600">
            เราส่งรหัสยืนยัน 6 หลักไปที่ <span className="font-medium text-neutral-900">{email}</span> แล้ว
          </p>
          <Input
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="รหัส 6 หลัก"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" variant="tan" fullWidth size="lg" loading={loading} disabled={otp.length !== 6}>
            ยืนยันอีเมล
          </Button>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="font-medium hover:text-neutral-700"
            >
              เปลี่ยนอีเมล
            </button>
            <button
              type="button"
              onClick={handleAsync(requestOtp)}
              disabled={cooldown > 0 || loading}
              className="font-medium text-primary-500 hover:text-primary-600 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              {cooldown > 0 ? `ส่งรหัสอีกครั้ง (${cooldown}s)` : "ส่งรหัสอีกครั้ง"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4 text-xs text-neutral-500">
        <Link href="/privacy" className="hover:text-neutral-700 hover:underline">
          นโยบายความเป็นส่วนตัว
        </Link>
        <button
          type="button"
          onClick={handleAsync(handleLogout)}
          disabled={loggingOut}
          className="font-medium hover:text-neutral-700 disabled:text-neutral-400"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
