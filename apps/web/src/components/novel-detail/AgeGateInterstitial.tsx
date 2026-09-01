"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** เพิ่มภายหลัง (Phase J) — หน้าจอเต็มหน้าแทน error box ธรรมดา ตอนเจอ 403 age-gate จาก
 *  GET /novels/:id หรือ GET /chapters/:id (backend ปฏิเสธเนื้อหาไปแล้วทั้งหมด ไม่มีอะไรให้โชว์
 *  บางส่วน จึงทำเป็นการ์ดกลางจอแทน modal ทับเนื้อหา) ต่อกับ PATCH /users/me/age-verification
 *  ที่มีอยู่แล้วแต่ไม่เคยมี UI เรียกใช้จริงมาก่อนเลย */
export function AgeGateInterstitial() {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [underage, setUnderage] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate) {
      setError("กรุณาเลือกวันเกิด");
      return;
    }
    setSubmitting(true);
    setError(null);
    setUnderage(false);

    try {
      const res = await fetch("/api/v1/users/me/age-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birth_date: birthDate }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "ยืนยันอายุไม่สำเร็จ ลองใหม่อีกครั้ง");
        setSubmitting(false);
        return;
      }
      if (!json.age_verified) {
        setUnderage(true);
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-card border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-h3 text-neutral-900">เนื้อหาสำหรับผู้ใหญ่</h1>
        <p className="mt-2 text-sm text-neutral-500">
          เนื้อหานี้เหมาะสำหรับผู้มีอายุ 18 ปีขึ้นไป กรุณายืนยันวันเกิดของคุณก่อนเข้าชม
        </p>

        {underage ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            บัญชีนี้ยังไม่ผ่านการยืนยันอายุ 18 ปีขึ้นไป จึงไม่สามารถเข้าชมเนื้อหานี้ได้
          </p>
        ) : (
          <form onSubmit={handleVerify} className="mt-4 text-left">
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">วันเกิดของคุณ</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-11 w-full rounded-lg border border-neutral-300 px-4 text-sm focus:border-primary-400 focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <Button type="submit" variant="primary" fullWidth className="mt-4" loading={submitting}>
              ยืนยันอายุ
            </Button>
          </form>
        )}

        <Link href="/" className="mt-4 inline-block text-sm text-neutral-400 hover:text-neutral-600">
          ย้อนกลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
