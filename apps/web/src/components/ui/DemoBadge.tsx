import { cn } from "@/lib/cn";

interface DemoBadgeProps {
  className?: string;
}

/** ป้าย "ตัวอย่าง" — ทุกคนเห็น บนบัญชี/นิยาย/รีวิวที่เป็นข้อมูลตัวอย่าง (users.account_type = DEMO, is_demo = true)
 *  ใช้ตัวเดียวทั้งเว็บ: โปรไฟล์ การ์ดนิยาย หน้ารายละเอียดนิยาย รีวิว */
export function DemoBadge({ className }: DemoBadgeProps) {
  return (
    <span
      title="ข้อมูลตัวอย่างสำหรับสาธิตระบบ ไม่ใช่ผู้ใช้จริง"
      className={cn(
        "inline-flex shrink-0 items-center rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-semibold leading-4 text-amber-800 ring-1 ring-amber-300/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/40",
        className
      )}
    >
      ตัวอย่าง
    </span>
  );
}
