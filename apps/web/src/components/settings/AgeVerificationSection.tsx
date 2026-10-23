import { BadgeCheck, CalendarHeart } from "lucide-react";
import { AgeVerificationOptions } from "@/components/age/AgeVerificationOptions";

/** หน้าตั้งค่า — สถานะยืนยันอายุ ซึ่งกำหนดว่าเปิดอ่านนิยายเรตไหนได้ (ทุกวัย / 13+ / 18+)
 *  ยังไม่ยืนยัน: ยืนยันด้วย Google หรือกรอกวันเกิดเอง (ครั้งเดียว)
 *  กรอกเองแล้ว: เหลือปุ่ม Google ไว้ยืนยันซ้ำ (ทับค่าที่กรอกเองได้ เช่นกรอกผิด)
 *  ยืนยันด้วย Google แล้ว: แสดงสถานะอย่างเดียว */
export function AgeVerificationSection({
  verifiedAge,
  source,
}: {
  verifiedAge: number | null;
  source: string | null;
}) {
  const verified = verifiedAge !== null;
  const access = !verified
    ? "นิยายเรตทุกวัยเท่านั้น"
    : verifiedAge >= 18
      ? "นิยายทุกเรต (ทุกวัย, 13+, 18+)"
      : verifiedAge >= 13
        ? "นิยายเรตทุกวัยและ 13+"
        : "นิยายเรตทุกวัยเท่านั้น";

  return (
    <section className="rounded-card border border-neutral-200 p-5">
      <div className="flex items-start gap-3">
        <CalendarHeart className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-neutral-900">ยืนยันอายุ</h2>
          <p className="mt-1 text-sm text-neutral-500">ใช้กำหนดว่าอ่านนิยายเรตไหนได้บ้าง</p>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-neutral-500">สถานะ:</dt>
              <dd className="font-medium text-neutral-900">
                {verified ? (
                  <span className="inline-flex items-center gap-1">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    ยืนยันแล้ว{source === "google" ? " ด้วยบัญชี Google" : source === "self_declared" ? " (กรอกวันเกิดเอง)" : ""}
                    {" · "}อายุ {verifiedAge} ปี
                  </span>
                ) : (
                  "ยังไม่ยืนยัน"
                )}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-neutral-500">อ่านได้:</dt>
              <dd className="text-neutral-900">{access}</dd>
            </div>
          </dl>

          {source !== "google" && (
            <div className="mt-5">
              <AgeVerificationOptions returnTo="/settings" allowSelfDeclare={!verified && source === null} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
