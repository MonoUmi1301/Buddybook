import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatPillProps {
  icon: LucideIcon;
  value: string | number;
  className?: string;
  iconClassName?: string;
}

/** ไอคอน+ตัวเลข เช่น ยอดวิว/ยอดไลก์/จำนวนตอน — ดูแถวสถิติใต้ชื่อเรื่องใน wf_novel_detail.png */
export function StatPill({ icon: Icon, value, className, iconClassName }: StatPillProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-neutral-400", className)}>
      <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
      {value}
    </span>
  );
}
