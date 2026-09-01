import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TagColor =
  | "rose"
  | "teal"
  | "violet"
  | "amber"
  | "emerald"
  | "sky"
  | "red"
  | "orange"
  | "slate";

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  color?: TagColor;
}

// พาเลตสีแท็กหมวดนิยาย — ก็อปสีมาจากแถบ "หมวดนิยาย" ท้าย wf_home_dark.png (แต่ละหมวดมีสีต่างกัน)
// ใช้ class เต็มคงที่ (ไม่ต่อ string แบบ dynamic) เพราะ Tailwind JIT ต้องเห็น class ตรง ๆ ตอน build
const colorClasses: Record<TagColor, string> = {
  rose: "bg-rose-500/90 text-white",
  teal: "bg-teal-500/90 text-white",
  violet: "bg-violet-500/90 text-white",
  amber: "bg-amber-500/90 text-white",
  emerald: "bg-emerald-500/90 text-white",
  sky: "bg-sky-500/90 text-white",
  red: "bg-red-500/90 text-white",
  orange: "bg-primary-500/90 text-white",
  slate: "bg-neutral-600/90 text-white",
};

export function Tag({ className, color = "slate", children, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium",
        colorClasses[color],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
