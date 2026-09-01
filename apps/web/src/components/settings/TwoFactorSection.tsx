"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatApiError } from "@/lib/formatApiError";

interface SetupData {
  secret: string;
  qr_code_data_url: string;
}

/** เพิ่มภายหลัง (audit fix — 2FA) — เปิด/ปิดการยืนยันตัวตนสองขั้นตอนด้วยแอป Authenticator
 *  (Google Authenticator ฯลฯ) ตอนล็อกอิน ดีไซน์ตาม pattern เดียวกับ DeleteAccountSection.tsx
 *  ขั้นเปิดใช้งาน: ขอ secret+QR ใหม่จาก /2fa/setup (ยังไม่บันทึกจนกว่าจะ confirm) → สแกน/กรอกเอง
 *  ในแอป → กรอกรหัส 6 หลักยืนยันที่ /2fa/confirm ถึงจะเปิดใช้งานจริง */
export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "setup" | "disable">("idle");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartSetup() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/2fa/setup", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "เริ่มตั้งค่าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        return;
      }
      setSetupData(json as SetupData);
      setStage("setup");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupData) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setupData.secret, code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "รหัสไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง"));
        return;
      }
      setStage("idle");
      setSetupData(null);
      setCode("");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(formatApiError(json, "ปิดใช้งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
        return;
      }
      setStage("idle");
      setPassword("");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setStage("idle");
    setSetupData(null);
    setCode("");
    setPassword("");
    setError(null);
  }

  return (
    <div className="rounded-card border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className={`mt-0.5 h-5 w-5 ${enabled ? "text-primary-500" : "text-neutral-400"}`} />
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              ยืนยันตัวตนสองขั้นตอน (2FA)
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  enabled ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {enabled ? "เปิดอยู่" : "ปิดอยู่"}
              </span>
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {enabled
                ? "เปิดใช้งานอยู่ — ต้องกรอกรหัสจากแอป Authenticator ทุกครั้งที่เข้าสู่ระบบ"
                : "เพิ่มความปลอดภัยด้วยการกรอกรหัส 6 หลักจากแอป Authenticator (เช่น Google Authenticator) ทุกครั้งที่เข้าสู่ระบบ"}
            </p>
          </div>
        </div>

        {stage === "idle" &&
          (enabled ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setStage("disable")}
            >
              ปิดใช้งาน
            </Button>
          ) : (
            <Button type="button" variant="outline" className="shrink-0" onClick={handleStartSetup} loading={loading}>
              เปิดใช้งาน
            </Button>
          ))}
      </div>

      {stage === "setup" && setupData && (
        <form
          className="mt-4 space-y-3 rounded-xl border-2 border-primary-200 bg-primary-50/50 p-4"
          onSubmit={handleConfirmSetup}
        >
          <p className="text-sm text-neutral-600">
            เปิดแอป Authenticator แล้วสแกน QR code นี้ หรือกรอกรหัสลับด้านล่างด้วยตัวเอง
          </p>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupData.qr_code_data_url} alt="QR code สำหรับตั้งค่า 2FA" className="h-44 w-44" />
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-center font-mono text-xs tracking-wider text-neutral-700">
            {setupData.secret}
          </div>

          <Input
            placeholder="รหัส 6 หลักจากแอป"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="tan" loading={loading} disabled={code.length !== 6}>
              ยืนยันและเปิดใช้งาน
            </Button>
          </div>
        </form>
      )}

      {stage === "disable" && (
        <form
          className="mt-4 space-y-3 rounded-xl border-2 border-red-200 bg-red-50/50 p-4"
          onSubmit={handleDisable}
        >
          <p className="text-sm text-neutral-600">กรอกรหัสผ่านเพื่อยืนยันการปิดใช้งาน 2FA</p>
          <Input
            type="password"
            placeholder="รหัสผ่านปัจจุบัน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary" className="bg-red-600 hover:bg-red-700" loading={loading}>
              ปิดใช้งาน 2FA
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
