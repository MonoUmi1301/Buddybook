"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { KYC_CONSENT } from "@/lib/kycConsent";

/** PDPA consent ก่อนเริ่ม e-KYC — ต้องติ๊กยินยอมโดยชัดแจ้ง (มาตรา 26 ข้อมูลชีวภาพ) ปุ่มยืนยันถึงจะกดได้
 *  ไม่มีการติ๊กไว้ให้ล่วงหน้า และปิด/ยกเลิกได้โดยไม่มีผลเสีย (ความยินยอมต้องเป็นอิสระ) */
export function KycConsentModal({
  onAccept,
  onClose,
  submitting,
  error,
}: {
  onAccept: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [agreed, setAgreed] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-card bg-white shadow-xl sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary-500" />
            {KYC_CONSENT.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="ปิด"
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-neutral-700">
          <p>{KYC_CONSENT.intro}</p>
          {KYC_CONSENT.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="font-semibold text-neutral-900">{section.heading}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
          <p>
            อ่านรายละเอียดเพิ่มเติมได้ที่{" "}
            <Link href={KYC_CONSENT.privacyPolicyHref} target="_blank" className="text-primary-600 underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
        </div>

        <div className="border-t border-neutral-100 px-5 py-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
            />
            <span>{KYC_CONSENT.checkbox}</span>
          </label>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              ไม่ยินยอม
            </Button>
            <Button type="button" variant="primary" onClick={onAccept} disabled={!agreed} loading={submitting}>
              ยินยอมและเริ่มยืนยันตัวตน
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
