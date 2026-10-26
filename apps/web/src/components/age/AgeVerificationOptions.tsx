"use client";

import { useSearchParams } from "next/navigation";
import { IdCard } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/SocialIcon";

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

/** ทางยืนยันอายุที่มีหลักฐานเท่านั้น (ไม่มีการกรอกวันเกิดเอง): บัญชี Google หรือบัตรประชาชน/พาสปอร์ต (e-KYC)
 *  ใช้ร่วมกันในหน้าเกตเรตเนื้อหาและหน้าตั้งค่าบัญชี */
export function AgeVerificationOptions({ returnTo }: { returnTo: string }) {
  const searchParams = useSearchParams();
  const googleResult = googleResultMessage[searchParams.get("age_verify") ?? ""];

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

      <a
        href={`/verify-identity?return_to=${encodeURIComponent(returnTo)}`}
        className={buttonClasses({ variant: "outline", fullWidth: true, size: "lg", className: "relative mt-3" })}
      >
        <IdCard className="absolute left-5 h-5 w-5 text-neutral-500" />
        ยืนยันด้วยบัตรประชาชน/พาสปอร์ต
      </a>
      <p className="mt-2 text-xs text-neutral-500">ถ่ายรูปบัตรคู่กับสแกนใบหน้า — BuddyBook ไม่เก็บรูปหรือเลขบัตร</p>
    </div>
  );
}
