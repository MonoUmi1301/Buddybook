import { cn } from "@/lib/cn";
import { formatThaiDate } from "@/lib/format";
import {
  contentRatingLabel,
  legalStatusLabel,
  novelStatusClasses,
  novelStatusLabel,
} from "@/lib/novelLabels";
import type { NovelDetailData } from "@/components/novel-detail/NovelHero";

interface NovelOverviewProps {
  novel: NovelDetailData;
  lastPublishedAt?: string;
  totalCharacters: number;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-800">{children}</dd>
    </div>
  );
}

/** แท็บ "เรื่องย่อ" — เรื่องย่อเต็ม + ตารางข้อมูลนิยาย
 *  หมายเหตุ: เดิมเคยมีบล็อกคำเตือนเนื้อหา (Content & Trigger Warning) แต่เป็นข้อความ hardcode
 *  ตัวเดียวกันทุกนิยาย และ schema ไม่มีคอลัมน์ให้นักเขียนระบุคำเตือนจริง จึงไม่แสดง */
export function NovelOverview({ novel, lastPublishedAt, totalCharacters }: NovelOverviewProps) {
  return (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">เรื่องย่อ</h2>
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
        {novel.synopsis || <span className="text-neutral-400">นักเขียนยังไม่ได้ใส่เรื่องย่อ</span>}
      </p>

      <dl className="mt-6 divide-y divide-neutral-100 border-t border-neutral-100">
        <InfoRow label="สถานะ">
          <span className={cn("rounded-pill px-2.5 py-0.5 text-xs ring-1 ring-inset", novelStatusClasses[novel.status])}>
            {novelStatusLabel[novel.status]}
          </span>
        </InfoRow>
        <InfoRow label="ประเภท">{legalStatusLabel[novel.legal_status]}</InfoRow>
        {novel.primary_tag && (
          <InfoRow label="หมวดหมู่">
            {novel.primary_tag.name}
            {novel.secondary_tag && <span className="text-neutral-400"> · {novel.secondary_tag.name}</span>}
          </InfoRow>
        )}
        <InfoRow label="เรตเนื้อหา">{contentRatingLabel[novel.content_rating]}</InfoRow>
        <InfoRow label="ความยาวรวม">{totalCharacters.toLocaleString()} ตัวอักษร</InfoRow>
        <InfoRow label="เริ่มเผยแพร่">{formatThaiDate(novel.created_at)}</InfoRow>
        {lastPublishedAt && <InfoRow label="อัปเดตล่าสุด">{formatThaiDate(lastPublishedAt)}</InfoRow>}
      </dl>
    </section>
  );
}
