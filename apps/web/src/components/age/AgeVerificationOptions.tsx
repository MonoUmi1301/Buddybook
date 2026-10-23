"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonClasses } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/SocialIcon";
import { formatApiError } from "@/lib/formatApiError";

/** ข้อความผลการยืนยันด้วย Google — callback แนบ ?age_verify= กลับมาที่หน้าที่กดปุ่ม */
const googleResultMessage: Record<string, { tone: "ok" | "error"; text: string }> = {
  ok: { tone: "ok", text: "ยืนยันอายุด้วยบัญชี Google แล้ว" },
  no_birthday: {
    tone: "error",
    text: "ไม่พบวันเกิดพร้อมปีเกิดในบัญชี Google นี้ หรือไม่ได้อนุญาตให้เข้าถึงวันเกิด — ตั้งวันเกิดที่ myaccount.google.com แล้วลองใหม่",
  },
  failed: { tone: "error", text: "ยืนยันอายุด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง" },
  unavailable: { tone: "error", text: "ตอนนี้ยังยืนยันอายุด้วย Google ไม่ได้ ลองใหม่ภายหลัง" },
};

/** ปุ่ม "ยืนยันอายุด้วย Google" (แนะนำ — วันเกิดมาจากบัญชี Google ผู้ใช้แก้เองไม่ได้) + กรอกวันเกิดเอง
 *  (ทางสำรอง กรอกได้ครั้งเดียว) ใช้ร่วมกันในหน้าเกตเรตเนื้อหาและหน้าตั้งค่าบัญชี
 *  allowSelfDeclare=false — บัญชีที่ยืนยันแล้ว เหลือแค่ปุ่ม Google ไว้แก้วันเกิดที่กรอกผิด */
export function AgeVerificationOptions({
  returnTo,
  allowSelfDeclare = true,
}: {
  returnTo: string;
  allowSelfDeclare?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleResult = googleResultMessage[searchParams.get("age_verify") ?? ""];
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelfDeclare(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate) {
      setError("กรุณาเลือกวันเกิด");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users/me/age-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birth_date: birthDate }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(json, "ยืนยันอายุไม่สำเร็จ ลองใหม่อีกครั้ง"));
        setSubmitting(false);
        return;
      }
      // หน้าเกตจะเปิดเนื้อหาถ้าอายุถึงเกณฑ์ ไม่ถึงก็เปลี่ยนเป็นข้อความ "อายุไม่ถึงเกณฑ์" เอง
      router.refresh();
      setSubmitting(false);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="text-left">
      {googleResult && (
        <p
          className={
            googleResult.tone === "ok"
              ? "mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
          }
        >
          {googleResult.text}
        </p>
      )}

      <a
        href={`/api/v1/auth/oauth/google/verify-age?return_to=${encodeURIComponent(returnTo)}`}
        className={buttonClasses({ variant: "google", fullWidth: true, size: "lg", className: "relative" })}
      >
        <GoogleIcon className="absolute left-5 h-5 w-5" />
        ยืนยันอายุด้วย Google
      </a>
      <p className="mt-2 text-xs text-neutral-500">
        ใช้วันเกิดในบัญชี Google (อีเมลไม่ต้องตรงกับบัญชีนี้) — BuddyBook เก็บแค่วันเกิดไว้คำนวณอายุ
      </p>

      {allowSelfDeclare && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs text-neutral-400">หรือกรอกวันเกิดเอง</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
          <form onSubmit={handleSelfDeclare}>
            <label htmlFor="age-birth-date" className="mb-1.5 block text-sm font-medium text-neutral-700">
              วันเกิดของคุณ
            </label>
            <input
              id="age-birth-date"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-11 w-full rounded-lg border border-neutral-300 px-4 text-sm focus:border-primary-400 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-amber-700">กรอกได้ครั้งเดียว แก้ไขเองภายหลังไม่ได้</p>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <Button type="submit" variant="outline" fullWidth className="mt-4" loading={submitting}>
              ยืนยันวันเกิด
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
