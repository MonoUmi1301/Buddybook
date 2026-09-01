import Link from "next/link";
import { cn } from "@/lib/cn";
import type { TagColor } from "@/components/ui/Tag";

interface CategoryTag {
  tag_id: number;
  name: string;
}

const colorCycle: TagColor[] = ["rose", "violet", "sky", "teal", "amber", "slate", "orange", "emerald", "red"];

const colorClassesDark: Record<TagColor, string> = {
  rose: "bg-rose-500/15 text-rose-300 hover:bg-rose-500 hover:text-white",
  teal: "bg-teal-500/15 text-teal-300 hover:bg-teal-500 hover:text-white",
  violet: "bg-violet-500/15 text-violet-300 hover:bg-violet-500 hover:text-white",
  amber: "bg-amber-500/15 text-amber-300 hover:bg-amber-500 hover:text-white",
  emerald: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-white",
  sky: "bg-sky-500/15 text-sky-300 hover:bg-sky-500 hover:text-white",
  red: "bg-red-500/15 text-red-300 hover:bg-red-500 hover:text-white",
  orange: "bg-primary-500/15 text-primary-300 hover:bg-primary-500 hover:text-white",
  slate: "bg-neutral-500/15 text-neutral-300 hover:bg-neutral-500 hover:text-white",
};

const colorClassesLight: Record<TagColor, string> = {
  rose: "bg-rose-100 text-rose-700 hover:bg-rose-500 hover:text-white",
  teal: "bg-teal-100 text-teal-700 hover:bg-teal-500 hover:text-white",
  violet: "bg-violet-100 text-violet-700 hover:bg-violet-500 hover:text-white",
  amber: "bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white",
  emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-500 hover:text-white",
  sky: "bg-sky-100 text-sky-700 hover:bg-sky-500 hover:text-white",
  red: "bg-red-100 text-red-700 hover:bg-red-500 hover:text-white",
  orange: "bg-primary-100 text-primary-700 hover:bg-primary-500 hover:text-white",
  slate: "bg-neutral-100 text-neutral-700 hover:bg-neutral-500 hover:text-white",
};

interface CategoryPillsProps {
  theme?: "dark" | "light";
  tags: CategoryTag[];
}

/** หมวดนิยายท้ายหน้า Home — เดิมเป็นปุ่มตกแต่งเฉย ๆ ไม่มี href กดแล้วไม่ทำอะไรเลย (Phase K แก้)
 *  ตอนนี้แต่ละปุ่มลิงก์ไปหน้าค้นหาที่กรองด้วยแท็กจริงนั้น ๆ ดู wf_home_dark.png สำหรับดีไซน์ */
export function CategoryPills({ theme = "dark", tags }: CategoryPillsProps) {
  const isDark = theme === "dark";
  const colorClasses = isDark ? colorClassesDark : colorClassesLight;

  return (
    <section className="mt-10">
      <h2 className={cn("mb-3 text-h3", isDark ? "text-zinc-100" : "text-neutral-900")}>หมวดนิยาย</h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <Link
            key={tag.tag_id}
            href={`/search?genre_ids=${tag.tag_id}`}
            className={cn(
              "rounded-pill px-4 py-2 text-sm font-medium transition-colors duration-150",
              colorClasses[colorCycle[i % colorCycle.length]]
            )}
          >
            {tag.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
