"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Camera, CircleAlert, IdCard, Loader2, Lock, ScanFace } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { KycConsentModal } from "@/components/kyc/KycConsentModal";
import { KYC_CONSENT_VERSION } from "@/lib/kycConsent";
import { formatApiError } from "@/lib/formatApiError";
import { handleAsync } from "@/lib/handleAsync";

export interface KycStatus {
  enabled: boolean;
  status: "none" | "pending" | "approved" | "rejected";
  reject_reason: string | null;
  retry_allowed: boolean;
  document_type: string | null;
  completed_at: string | null;
}

type Step = "intro" | "waiting" | "approved" | "rejected";

const POLL_MS = 4000;

/** เหตุผลที่ไม่ผ่าน (รหัสจาก apps/api lib/kyc/evaluate.ts) → ข้อความที่ผู้ใช้ทำต่อได้ */
const rejectMessage: Record<string, string> = {
  PROVIDER_REJECTED: "ตรวจสอบไม่ผ่าน — ภาพบัตรหรือใบหน้าอาจไม่ชัด หรือใบหน้าไม่ตรงกับรูปบนบัตร",
  SESSION_EXPIRED: "การยืนยันหมดเวลาหรือถูกยกเลิกก่อนทำเสร็จ กรุณาเริ่มใหม่",
  INCOMPLETE_CHECKS: "ระบบตรวจใบหน้าไม่ครบขั้นตอน กรุณาลองใหม่อีกครั้ง",
  UNSUPPORTED_DOCUMENT: "รองรับเฉพาะบัตรประชาชนหรือหนังสือเดินทาง",
  NO_BIRTH_DATE: "อ่านวันเกิดจากเอกสารไม่ได้ กรุณาถ่ายใหม่ให้เห็นข้อความชัดเจน",
  INVALID_BIRTH_DATE: "วันเกิดบนเอกสารไม่ถูกต้อง กรุณาติดต่อฝ่ายสนับสนุน",
  BIRTH_DATE_MISMATCH: "วันเกิดจากเอกสารไม่สอดคล้องกัน กรุณาติดต่อฝ่ายสนับสนุน",
  DOCUMENT_EXPIRED: "เอกสารหมดอายุแล้ว กรุณาใช้เอกสารที่ยังไม่หมดอายุ",
  INVALID_ID_NUMBER: "อ่านเลขบัตรประชาชนไม่ถูกต้อง กรุณาถ่ายใหม่ให้ชัดเจน",
  DUPLICATE_IDENTITY: "เอกสารนี้ถูกใช้ยืนยันบัญชีอื่นไปแล้ว",
};

function stepFor(status: KycStatus, returnedFromProvider: boolean): Step {
  if (status.status === "approved") return "approved";
  if (status.status === "rejected") return "rejected";
  // กลับมาจากหน้า Didit (มี ?verificationSessionId=) แล้วผลยังไม่ออก → รอผล
  return status.status === "pending" && returnedFromProvider ? "waiting" : "intro";
}

/**
 * หน้ายืนยันตัวตน e-KYC: แนะนำ → ขอความยินยอม (PDPA) → ไปหน้า Didit (ถ่ายบัตร + สแกนใบหน้า)
 * → Didit พากลับมาที่หน้านี้ → รอผล (poll GET /kyc/status) → ผลลัพธ์
 * ภาพบัตร/ใบหน้าถูกถ่ายและส่งบนหน้าของ Didit ตรงไปเซิร์ฟเวอร์เขา หน้านี้ไม่เคยเห็นไฟล์ภาพเลย
 * ใช้ redirect (ไม่ฝัง iframe) — Didit แนะนำแบบนี้และรองรับสลับไปทำต่อบนมือถือ
 */
export function VerifyIdentityFlow({ initialStatus, returnTo }: { initialStatus: KycStatus; returnTo: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnedFromProvider = searchParams.has("verificationSessionId");
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState<Step>(() => stepFor(initialStatus, returnedFromProvider));
  const [consentOpen, setConsentOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/v1/kyc/status", { cache: "no-store" });
    if (!res.ok) return null;
    const next = (await res.json()) as KycStatus;
    setStatus(next);
    return next;
  }, []);

  // รอผลตรวจ — ส่วนใหญ่ได้ผลภายในไม่กี่นาที (ถ้าผู้ให้บริการส่งให้คนตรวจอาจนานกว่านั้น)
  useEffect(() => {
    if (step !== "waiting") return;
    let cancelled = false;
    const timer = setInterval(
      handleAsync(async () => {
        const next = await refreshStatus();
        if (cancelled || !next) return;
        if (next.status === "approved" || next.status === "rejected") {
          setStep(stepFor(next, true));
          router.refresh();
        }
      }),
      POLL_MS
    );
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [step, refreshStatus, router]);

  async function handleConsentAccepted() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/kyc/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, consent_version: KYC_CONSENT_VERSION, return_to: returnTo }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(formatApiError(json, "เริ่มการยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
      // ไปหน้าถ่ายบัตร/สแกนหน้าของ Didit — ทำเสร็จแล้ว Didit พากลับมาที่ /verify-identity
      window.location.assign((json as { url: string }).url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เริ่มการยืนยันตัวตนไม่สำเร็จ");
      setStarting(false);
    }
  }

  const consentModal = consentOpen && (
    <KycConsentModal
      onAccept={handleAsync(handleConsentAccepted)}
      onClose={() => setConsentOpen(false)}
      submitting={starting}
      error={error}
    />
  );

  if (!status.enabled && step !== "approved") {
    return (
      <Card>
        <CircleAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-center text-h3 text-neutral-900">ยังไม่เปิดให้ยืนยันด้วยบัตร</h1>
        <p className="mt-2 text-center text-sm text-neutral-500">ระหว่างนี้ยืนยันอายุด้วยบัญชี Google ได้ที่หน้าตั้งค่า</p>
        <Link href="/settings" className={buttonClasses({ variant: "primary", fullWidth: true, className: "mt-5" })}>
          ไปหน้าตั้งค่า
        </Link>
      </Card>
    );
  }

  if (step === "approved") {
    return (
      <Card>
        <BadgeCheck className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-3 text-center text-h3 text-neutral-900">ยืนยันตัวตนสำเร็จ</h1>
        <p className="mt-2 text-center text-sm text-neutral-500">
          บัญชีนี้ยืนยันอายุด้วยเอกสารแล้ว — ระบบเปิดให้อ่านนิยายตามเรตที่อายุของคุณถึงเกณฑ์
        </p>
        <Link href={returnTo} className={buttonClasses({ variant: "primary", fullWidth: true, className: "mt-5" })}>
          กลับไปอ่านต่อ
        </Link>
      </Card>
    );
  }

  if (step === "rejected") {
    return (
      <Card>
        <CircleAlert className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-3 text-center text-h3 text-neutral-900">ยืนยันตัวตนไม่ผ่าน</h1>
        <p className="mt-2 text-center text-sm text-neutral-600">
          {rejectMessage[status.reject_reason ?? ""] ?? "ตรวจสอบไม่ผ่าน กรุณาลองใหม่อีกครั้ง"}
        </p>
        {status.retry_allowed ? (
          <Button type="button" variant="primary" fullWidth className="mt-5" onClick={() => setConsentOpen(true)}>
            ลองใหม่อีกครั้ง
          </Button>
        ) : (
          <Link href="/support" className={buttonClasses({ variant: "outline", fullWidth: true, className: "mt-5" })}>
            ติดต่อฝ่ายสนับสนุน
          </Link>
        )}
        {consentModal}
      </Card>
    );
  }

  if (step === "waiting") {
    return (
      <Card>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-500" />
        <h1 className="mt-3 text-center text-h3 text-neutral-900">กำลังตรวจสอบ</h1>
        <p className="mt-2 text-center text-sm text-neutral-500" role="status">
          ส่งข้อมูลแล้ว ปกติใช้เวลาไม่กี่นาที — ปิดหน้านี้ได้ ผลจะแสดงในหน้าตั้งค่า
        </p>
        <Link href={returnTo} className={buttonClasses({ variant: "outline", fullWidth: true, className: "mt-5" })}>
          กลับไปก่อน
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <div className="rounded-card border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-h3 text-neutral-900">ยืนยันอายุด้วยบัตรประชาชนหรือหนังสือเดินทาง</h1>
        <p className="mt-2 text-sm text-neutral-500">
          ใช้เวลาประมาณ 2–3 นาที ผลการยืนยันใช้ปลดล็อกนิยายเรต 13+ และ 18+ (เมื่ออายุถึงเกณฑ์)
        </p>

        {status.status === "pending" && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            คุณเริ่มยืนยันตัวตนไว้แล้ว — กดทำต่อเพื่อกลับไปทำจากขั้นที่ค้างไว้
          </p>
        )}

        <ol className="mt-5 space-y-3">
          <IntroStep icon={IdCard} title="ถ่ายรูปบัตร" text="บัตรประชาชน (หน้า-หลัง) หรือหน้าข้อมูลของหนังสือเดินทาง วางบนพื้นเรียบ แสงพอ ไม่สะท้อน" />
          <IntroStep icon={ScanFace} title="สแกนใบหน้า" text="มองกล้องตามคำแนะนำบนจอ เพื่อตรวจว่าเป็นบุคคลจริงและตรงกับรูปบนบัตร" />
          <IntroStep icon={Camera} title="อนุญาตให้ใช้กล้อง" text="ระบบจะพาไปหน้าของผู้ให้บริการยืนยันตัวตน บนคอมพิวเตอร์สแกน QR เพื่อทำต่อบนมือถือได้" />
        </ol>

        <div className="mt-5 flex gap-3 rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
          <p>
            ภาพบัตรและใบหน้าส่งตรงไปผู้ให้บริการยืนยันตัวตนผ่านการเชื่อมต่อที่เข้ารหัส และถูกสั่งลบทันทีเมื่อได้ผลตรวจ BuddyBook ไม่เก็บภาพ
            ชื่อ หรือเลขบัตรของคุณ — เก็บเพียงวันเกิดและผลการยืนยัน ถอนความยินยอมได้ทุกเมื่อที่หน้าตั้งค่า
          </p>
        </div>

        {error && !consentOpen && <p className="mt-4 text-sm text-red-500">{error}</p>}
        <Button type="button" variant="primary" fullWidth size="lg" className="mt-5" onClick={() => setConsentOpen(true)}>
          {status.status === "pending" ? "ทำต่อ" : "เริ่มยืนยันตัวตน"}
        </Button>
        <Link href={returnTo} className="mt-3 block text-center text-sm text-neutral-400 hover:text-neutral-600">
          ไว้ทีหลัง
        </Link>
      </div>
      {consentModal}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-card border border-neutral-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function IntroStep({ icon: Icon, title, text }: { icon: typeof IdCard; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-500">{text}</p>
      </div>
    </li>
  );
}
