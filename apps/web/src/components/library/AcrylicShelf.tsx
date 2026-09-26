"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ShelfTitle } from "@/components/library/ShelfTitle";
import { useDismiss } from "@/components/library/shelf-utils";
import {
  collectionTintLabel,
  collectionTintRgb,
  coverOf,
  type CollectionTint,
  type LibraryNovel,
} from "@/lib/library";

export interface ShelfGroup {
  id: string;
  name: string;
  icon: string | null;
  /** null = ชั้นเสมือน "ยังไม่ได้จัดชั้น" (สีเทา ไม่มีเมนูแก้ไข) */
  tint: CollectionTint | null;
  novels: LibraryNovel[];
  editable: boolean;
}

interface AcrylicShelfProps {
  group: ShelfGroup;
  onAdd?: () => void;
  onRename?: () => void;
  onTint?: (tint: CollectionTint) => void;
  onDelete?: () => void;
}

const NEUTRAL_SHELF = "148 163 184";

/**
 * ชั้นอะคริลิก — ปกนิยายยืนเรียงบนแผ่นอะคริลิกโปร่งแสงสีตามชั้นย่อย (CSS var --shelf)
 * แผ่นอะคริลิกอยู่ "หน้า" ปก 25% ล่าง และอยู่นอก scroller ปกจึงเลื่อนผ่านหลังแผ่นได้
 */
export function AcrylicShelf({ group, onAdd, onRename, onTint, onDelete }: AcrylicShelfProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeMenu = React.useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismiss<HTMLDivElement>(menuOpen, closeMenu);
  const headingId = React.useId();

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const tintRgb = group.tint ? collectionTintRgb[group.tint] : NEUTRAL_SHELF;
  const title = <ShelfTitle name={group.name} icon={group.icon} tintRgb={group.tint ? tintRgb : undefined} />;

  const menu = (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`ตัวเลือกของชั้น ${group.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl duration-150 animate-in fade-in zoom-in-95"
        >
          {onAdd && (
            <MenuItem className="hidden max-md:flex" onClick={() => (closeMenu(), onAdd())} icon={Plus}>
              เพิ่มนิยายเข้าชั้นนี้
            </MenuItem>
          )}
          <MenuItem onClick={() => (closeMenu(), onRename?.())} icon={Pencil}>
            เปลี่ยนชื่อ / อีโมจิ
          </MenuItem>
          <div className="px-3 py-2">
            <p className="mb-2 text-xs text-neutral-500">สีชั้น</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(collectionTintRgb) as CollectionTint[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="menuitemradio"
                  aria-checked={group.tint === t}
                  aria-label={collectionTintLabel[t]}
                  onClick={() => (closeMenu(), onTint?.(t))}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    group.tint === t && "ring-2 ring-neutral-900"
                  )}
                  style={{ backgroundColor: `rgb(${collectionTintRgb[t]})` }}
                />
              ))}
            </div>
          </div>
          <MenuItem onClick={() => (closeMenu(), onDelete?.())} icon={Trash2} danger>
            ลบชั้นนี้
          </MenuItem>
        </div>
      )}
    </div>
  );

  return (
    <section aria-labelledby={headingId} style={{ ["--shelf" as string]: tintRgb }}>
      {/* หัวชั้น — มือถือย้ายชื่อไปไว้ใต้ชั้นแทน (ตาม reference) */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0 max-md:hidden">
          <h3 id={headingId} className="truncate text-lg font-semibold text-neutral-900">
            {title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `rgb(${tintRgb})` }} aria-hidden />
            {group.novels.length} เรื่อง
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 max-md:ml-auto">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="เลื่อนซ้าย"
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 max-md:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="เลื่อนขวา"
            className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 max-md:hidden"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          {group.editable && onAdd && (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`เพิ่มนิยายเข้าชั้น ${group.name}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 max-md:hidden"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          {group.editable && menu}
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto px-6 pb-4 pt-2 max-md:px-4"
          tabIndex={0}
          aria-label={`นิยายในชั้น ${group.name}`}
        >
          {group.novels.length === 0 ? (
            <p className="flex h-[225px] items-center text-sm text-neutral-400 max-lg:h-[195px] max-md:h-[165px]">
              ยังไม่มีนิยายในชั้นนี้{group.editable ? " — กด + เพื่อเพิ่ม" : ""}
            </p>
          ) : (
            group.novels.map((novel, i) => (
              <Link
                key={novel.novel_id}
                href={`/novels/${novel.novel_id}`}
                title={novel.title}
                className={cn(
                  "group relative shrink-0 snap-start transition-transform duration-200 hover:z-10 hover:-translate-y-2 focus-visible:z-10 focus-visible:-translate-y-2 focus-visible:outline-none",
                  i > 0 && "-ml-3 max-md:-ml-2"
                )}
                style={{ zIndex: group.novels.length - i }}
              >
                <Image
                  src={coverOf(novel)}
                  alt={novel.title}
                  width={400}
                  height={600}
                  sizes="(max-width: 767px) 110px, (max-width: 1023px) 130px, 150px"
                  draggable={false}
                  className="aspect-[2/3] w-[150px] rounded-md object-cover shadow-md ring-1 ring-black/5 group-focus-visible:ring-2 group-focus-visible:ring-primary-400 max-lg:w-[130px] max-md:w-[110px]"
                />
              </Link>
            ))
          )}
        </div>

        {/* แผ่นอะคริลิก — บังปก 25% ล่าง, ไม่รับคลิก (ปกยังกดได้ทั้งใบ) */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[72px] rounded-2xl backdrop-blur-md max-lg:h-[64px] max-md:h-[56px]",
            "bg-[rgb(var(--shelf)/0.55)] dark:bg-[rgb(var(--shelf)/0.28)]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-8px_16px_rgba(0,0,0,0.06),0_10px_24px_-12px_rgb(var(--shelf)/0.9)]",
            "ring-1 ring-inset ring-white/40"
          )}
        >
          <span className="absolute left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/80 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]" />
          <span className="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/80 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]" />
        </div>
      </div>

      {/* มือถือ: ชื่อชั้นใต้ชั้น */}
      <div className="mt-3 hidden text-center max-md:block">
        <p className="text-base font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{group.novels.length} เรื่อง</p>
      </div>
    </section>
  );
}

function MenuItem({
  children,
  onClick,
  icon: Icon,
  danger,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: typeof Plus;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none",
        danger ? "text-red-600" : "text-neutral-700",
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
