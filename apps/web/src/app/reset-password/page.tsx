"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordRequirementsHint } from "@/components/auth/PasswordRequirementsHint";
import { formatApiError } from "@/lib/formatApiError";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (res.status === 204) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2000);
        return;
      }
      const json = await res.json().catch(() => null);
      setError(formatApiError(json, "ลิงก์นี้อาจหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่"));
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

        <h1 className="text-center text-h3 text-neutral-900">ตั้งรหัสผ่านใหม่</h1>

        {!token ? (
          <p className="mt-6 text-center text-sm text-red-500">
            ลิงก์นี้ไม่ถูกต้อง — กรุณาขอลิงก์ใหม่จากหน้า{" "}
            <Link href="/forgot-password" className="font-medium text-sky-600 hover:underline">
              ลืมรหัสผ่าน
            </Link>
          </p>
        ) : success ? (
          <p className="mt-6 text-center text-sm text-neutral-700">
            ตั้งรหัสผ่านใหม่สำเร็จแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...
          </p>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
            <div>
              <Input
                type="password"
                placeholder="รหัสผ่านใหม่"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <PasswordRequirementsHint password={password} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" variant="tan" fullWidth size="lg" loading={loading} className="mt-2">
              ตั้งรหัสผ่านใหม่
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
