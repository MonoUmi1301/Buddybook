import type { ReactNode } from "react";
import { Mascot } from "@/components/ui/Mascot";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "sm" | "lg";
  className?: string;
}

/** ใช้แทนข้อความเปล่า ๆ ทุกจุดที่ยังไม่มีข้อมูล (ชั้นหนังสือ/ผลค้นหา/แจ้งเตือน ฯลฯ) —
 *  ให้หน้าตาสม่ำเสมอกันทั้งแอปแทนการเขียน <p>ยังไม่มี...</p> ซ้ำ ๆ ในแต่ละหน้า */
export function EmptyState({ title, description, action, size = "lg", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
      <Mascot size={size} className="mb-4" />
      <p className={cn("font-semibold text-neutral-700", size === "lg" ? "text-base" : "text-sm")}>{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-neutral-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
