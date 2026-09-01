"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, X } from "lucide-react";

export interface LibraryItem {
  library_id: string;
  novel: {
    novel_id: string;
    title: string;
    cover_image_url: string | null;
    status: "ongoing" | "completed" | "hiatus";
    view_count: number;
  };
}

const statusLabel: Record<LibraryItem["novel"]["status"], string> = {
  ongoing: "กำลังเขียน",
  completed: "จบแล้ว",
  hiatus: "พักเขียน",
};

/** การ์ดนิยายในชั้นหนังสือ — ต่อกับ GET/DELETE /library จริง (ไม่มีข้อมูล rating/like
 *  เหมือนการ์ดหน้า Home เพราะ schema จริงไม่มีตาราง "novel likes" แยก) */
export function LibraryNovelCard({ item }: { item: LibraryItem }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/v1/library/${item.novel.novel_id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setRemoved(true);
        router.refresh();
      }
    } finally {
      setRemoving(false);
    }
  }

  if (removed) return null;

  return (
    <div className="group relative w-36 shrink-0 sm:w-40">
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        aria-label="เอาออกจากชั้นหนังสือ"
        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 disabled:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
      <Link href={`/novels/${item.novel.novel_id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-neutral-100 ring-1 ring-black/5 transition-transform duration-200 group-hover:-translate-y-1">
          {item.novel.cover_image_url && (
            <Image src={item.novel.cover_image_url} alt={item.novel.title} fill sizes="160px" className="object-cover" />
          )}
          <span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            {statusLabel[item.novel.status]}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-neutral-900 group-hover:text-primary-600">
          {item.novel.title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500">
          <Eye className="h-3.5 w-3.5" /> {item.novel.view_count.toLocaleString()}
        </p>
      </Link>
    </div>
  );
}
