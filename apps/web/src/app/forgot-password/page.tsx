"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** เพิ่มภายหลัง (audit fix) — ตอนนี้มี Resend แล้ว ส่งลิงก์ตั้งรหัสผ่านใหม่ไปอีเมลจริง แทนที่การแสดง
 *  reset_link ตรง ๆ บนหน้าจอแบบเดิม (ดู auth.service.ts requestPasswordReset) */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo variant="light" className="text-h3" />
        </div>

        <h1 className="text-center text-h3 text-neutral-900">ลืมรหัสผ่าน</h1>
        <p className="mt-1 text-center text-sm text-neutral-500">กรอกอีเมลที่ใช้สมัคร เพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>

        {submitted ? (
          <div className="mt-6 space-y-3 text-center text-sm">
            <p className="text-neutral-700">
              ถ้ามีบัญชีที่ใช้อีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว (มีอายุ 30 นาที)
              กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์สแปม)
            </p>
          </div>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" variant="tan" fullWidth size="lg" loading={loading} className="mt-2">
              ส่งลิงก์ตั้งรหัสผ่านใหม่
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-neutral-600">
          <Link href="/login" className="font-medium text-sky-600 hover:underline">
            กลับไปเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
