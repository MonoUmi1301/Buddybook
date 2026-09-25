import { collectionIconMeta, isCollectionIcon } from "@/lib/collectionIcons";
import { cn } from "@/lib/cn";

interface ShelfTitleProps {
  name: string;
  icon: string | null;
  /** "R G B" ของสีชั้น — ไอคอนใช้สีเดียวกับชั้น */
  tintRgb?: string;
  className?: string;
}

/** ชื่อชั้นหนังสือ + ไอคอนชั้น (แทนอีโมจิเดิม) — ไอคอนตกแต่งเท่านั้น จึงซ่อนจาก screen reader */
export function ShelfTitle({ name, icon, tintRgb, className }: ShelfTitleProps) {
  const meta = isCollectionIcon(icon) ? collectionIconMeta[icon] : null;
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      {meta && (
        <meta.Icon
          aria-hidden
          className="h-[1.05em] w-[1.05em] shrink-0"
          style={tintRgb ? { color: `rgb(${tintRgb})` } : undefined}
          strokeWidth={2.2}
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
