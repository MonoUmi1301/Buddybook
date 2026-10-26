import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { AgeVerificationOptions } from "@/components/age/AgeVerificationOptions";

/** รหัส 403 ของเกตเรตเนื้อหาจาก apps/api (lib/contentRating.ts assertContentRatingAllowed) */
export interface AgeGateInfo {
  code: "AGE_VERIFICATION_REQUIRED" | "AGE_RESTRICTED";
  required_age: number;
}

/** อ่าน details ของ 403 จาก GET /novels/:id, /chapters/:id — null = ไม่ใช่ error ของเกตเรต */
export function parseAgeGate(status: number, json: unknown): AgeGateInfo | null {
  if (status !== 403) return null;
  const details = (json as { details?: { code?: string; required_age?: number } } | null)?.details;
  const codes: string[] = ["AGE_VERIFICATION_REQUIRED", "AGE_RESTRICTED"];
  if (!details?.code || !codes.includes(details.code)) return null;
  return { code: details.code as AgeGateInfo["code"], required_age: details.required_age ?? 18 };
}

/** หน้าจอเต็มหน้าแทนเนื้อหา ตอนเจอ 403 เกตเรต (backend ไม่ส่งเนื้อหามาเลย ไม่มีอะไรให้โชว์บางส่วน)
 *  - ยังไม่ล็อกอิน → ให้เข้าสู่ระบบก่อน (ยืนยันอายุผูกกับบัญชี)
 *  - ยังไม่ยืนยันอายุ → ยืนยันด้วย Google หรือบัตรประชาชน/พาสปอร์ต (ไม่มีการกรอกวันเกิดเอง)
 *  - ยืนยันแล้วแต่อายุไม่ถึงเกณฑ์ (AGE_RESTRICTED) → แจ้งอย่างเดียว ยืนยันใหม่เองไม่ได้ */
export function AgeGateInterstitial({
  gate,
  loggedIn,
  returnTo,
}: {
  gate: AgeGateInfo;
  loggedIn: boolean;
  returnTo: string;
}) {
  const restricted = gate.code === "AGE_RESTRICTED";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-card border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-h3 text-neutral-900">เนื้อหาสำหรับอายุ {gate.required_age} ปีขึ้นไป</h1>

        {restricted ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            อายุที่ยืนยันไว้ในบัญชีนี้ยังไม่ถึง {gate.required_age} ปี จึงไม่สามารถเข้าชมเนื้อหานี้ได้
          </p>
        ) : loggedIn ? (
          <>
            <p className="mb-5 mt-2 text-sm text-neutral-500">
              กรุณายืนยันอายุก่อนเข้าชม — ระบบจะเปิดให้อ่านเฉพาะนิยายที่เรตเหมาะกับอายุของคุณ
            </p>
            <AgeVerificationOptions returnTo={returnTo} />
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-neutral-500">เข้าสู่ระบบแล้วยืนยันอายุก่อนถึงจะเข้าชมเนื้อหานี้ได้</p>
            <Link href="/login" className={buttonClasses({ variant: "primary", fullWidth: true, className: "mt-4" })}>
              เข้าสู่ระบบ
            </Link>
          </>
        )}

        <Link href="/" className="mt-4 inline-block text-sm text-neutral-400 hover:text-neutral-600">
          ย้อนกลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
