"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FolderFile } from "@/components/ui/collection-folder";
import type { CollectionIcon } from "@/lib/collectionIcons";
import { AcrylicShelf, type ShelfGroup } from "@/components/library/AcrylicShelf";
import { SpineShelf } from "@/components/library/SpineShelf";
import { AddNovelsDialog, CollectionFormDialog } from "@/components/library/CollectionDialogs";
import {
  continueHref,
  coverOf,
  libraryStatusLabel,
  progressPercent,
  type Collection,
  type CollectionTint,
  type LibraryCounts,
  type LibraryEntry,
  type LibraryNovel,
  type LibraryStatus,
} from "@/lib/library";

// แฟ้มใส่ CSS เป็นข้อความใน <style> ซึ่ง React 18 escape เครื่องหมาย " ฝั่ง server ไม่ตรงกับ client
// (hydration error) — เลยเรนเดอร์ฝั่ง client อย่างเดียว พร้อมกล่องจองที่ขนาดเท่าแฟ้ม (สูง (272+54)/340 ของความกว้าง)
const FOLDER_WIDTH = 240;
const CollectionFolder = dynamic(() => import("@/components/ui/collection-folder"), {
  ssr: false,
  loading: () => <div aria-hidden style={{ width: FOLDER_WIDTH, height: (FOLDER_WIDTH * 326) / 340 }} className="shrink-0" />,
});

export type LibraryFilter = "all" | LibraryStatus;

interface LibraryViewProps {
  entries: LibraryEntry[];
  counts: LibraryCounts;
  collections: Collection[];
  initialFilter: LibraryFilter;
}

const FILTERS: LibraryFilter[] = ["all", "reading", "up_next", "completed"];
const filterLabel: Record<LibraryFilter, string> = { all: "ทั้งหมด", ...libraryStatusLabel };

const lastReadAt = (e: LibraryEntry) => (e.progress ? Date.parse(e.progress.last_read_at) : 0);

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return null;
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    return json?.error ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";
  } catch {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
  }
}

/**
 * หน้า My Library ฝั่ง client — 3 ส่วน เรียงตามความถี่ที่ใช้ วัสดุละความหมาย:
 * 1. อ่านต่อ (ชั้นอะคริลิก หันปก) = เรื่องสถานะ "กำลังอ่าน" เรียงอ่านล่าสุดก่อน กดปกไปตอนล่าสุด
 *    — ไม่มีเรื่องค้างอ่าน → แสดง "อ่านต่อไป" แทน, ไม่มีทั้งคู่ → ซ่อน
 * 2. คอลเลคชัน (แฟ้มกระดาษครีม) = กลุ่มที่ผู้ใช้สร้างเอง กดเปิดแฟ้ม = กรองส่วนที่ 3
 * 3. ชั้นหนังสือทั้งหมด (สันหนังสือ) = ทุกเล่ม กรองด้วยสถานะ (?status=) ซ้อนกับแฟ้มที่เปิดได้
 * สถานะเป็น "ตัวกรอง" ไม่ใช่แฟ้ม เพราะหนังสือทุกเล่มมีสถานะเดียวเสมอ ส่วนคอลเลคชันเล่มหนึ่งอยู่ได้หลายแฟ้ม
 * ทุกการแก้ไขอัปเดต state ทันทีแล้ว router.refresh() ให้ข้อมูลจาก server ตรงกันอีกรอบ
 */
export function LibraryView({ entries: initialEntries, counts: initialCounts, collections: initialCollections, initialFilter }: LibraryViewProps) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initialEntries);
  const [counts, setCounts] = React.useState(initialCounts);
  const [collections, setCollections] = React.useState(initialCollections);
  const [formFor, setFormFor] = React.useState<Collection | "new" | null>(null);
  const [addTo, setAddTo] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<LibraryFilter>(initialFilter);
  // แฟ้มคอลเลคชันที่เปิดอยู่ (ทีละแฟ้ม) — กรองชั้นสันให้เหลือเฉพาะเรื่องในแฟ้มนี้
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const folderRowRef = React.useRef<HTMLDivElement>(null);
  const outsidePress = React.useRef(false);

  // แฟ้มปิดตัวเองเมื่อกดนอกแฟ้ม — แต่ตัวกรองต้องอยู่ต่อขณะเลื่อน/กดชั้นด้านล่าง จึงจำว่า pointerdown ล่าสุด
  // อยู่นอกแถวแฟ้มไหม (capture ทำงานก่อน listener ของแฟ้ม) แล้วไม่สนการปิดที่มาจากตรงนั้น
  React.useEffect(() => {
    const onDown = (e: PointerEvent) => {
      outsidePress.current = !folderRowRef.current?.contains(e.target as Node);
    };
    const onKey = () => {
      outsidePress.current = false;
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  React.useEffect(() => setEntries(initialEntries), [initialEntries]);
  React.useEffect(() => setCounts(initialCounts), [initialCounts]);
  React.useEffect(() => setCollections(initialCollections), [initialCollections]);

  function changeFilter(next: LibraryFilter) {
    setFilter(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "all") params.delete("status");
    else params.set("status", next);
    params.delete("view"); // มุมมองเดิม ?view= ไม่ใช้แล้ว
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const entryByNovel = React.useMemo(() => new Map(entries.map((e) => [e.novel.novel_id, e])), [entries]);
  const open = openId ? collections.find((c) => c.collection_id === openId) : undefined;

  // 1. อ่านต่อ — กำลังอ่าน (อ่านล่าสุดก่อน) หรือถ้าไม่มี ใช้ "อ่านต่อไป" (เพิ่มเข้าชั้นล่าสุดก่อน)
  const continueShelf = React.useMemo(() => {
    const reading = entries.filter((e) => e.status === "reading").sort((a, b) => lastReadAt(b) - lastReadAt(a));
    const upNext = entries.filter((e) => e.status === "up_next").sort((a, b) => Date.parse(b.added_at) - Date.parse(a.added_at));
    const list = reading.length ? reading : upNext;
    if (list.length === 0) return null;
    const group: ShelfGroup = {
      id: "__continue",
      name: reading.length ? "กำลังอ่าน" : "อ่านต่อไป",
      icon: null,
      tint: "orange",
      editable: false,
      novels: list.map((e) => e.novel),
    };
    return { group, isReading: reading.length > 0 };
  }, [entries]);

  // 3. ชั้นสัน — ทั้งหมดหรือเฉพาะแฟ้มที่เปิด แล้วกรองตามสถานะ; ตัวเลขบนปุ่มสถานะนับในขอบเขตเดียวกัน
  const scope = React.useMemo(() => (open ? open.novels : entries.map((e) => e.novel)), [open, entries]);
  const scopeCounts = React.useMemo(() => {
    const c: Record<LibraryFilter, number> = { all: scope.length, reading: 0, up_next: 0, completed: 0 };
    for (const n of scope) {
      const s = entryByNovel.get(n.novel_id)?.status;
      if (s) c[s]++;
    }
    return c;
  }, [scope, entryByNovel]);
  const spineGroup: ShelfGroup = React.useMemo(
    () => ({
      id: open?.collection_id ?? "__all",
      name: open ? open.name : filterLabel[filter],
      icon: open?.icon ?? null,
      tint: open?.tint ?? null,
      editable: false,
      novels: scope.filter((n) => filter === "all" || entryByNovel.get(n.novel_id)?.status === filter),
    }),
    [open, scope, filter, entryByNovel]
  );

  function folderFiles(novels: LibraryNovel[]): FolderFile[] {
    return novels.map((novel) => {
      const progress = entryByNovel.get(novel.novel_id)?.progress;
      return {
        name: novel.title,
        image: coverOf(novel),
        href: `/novels/${novel.novel_id}`,
        meta: progress ? `อ่าน ${progress.last_chapter_number}/${novel.chapter_count} ตอน` : "ยังไม่เริ่มอ่าน",
      };
    });
  }

  // ---------- mutations ----------
  async function saveCollection(values: { name: string; icon: CollectionIcon | null; tint: CollectionTint }) {
    const editing = formFor && formFor !== "new" ? formFor : null;
    const err = editing
      ? await send(`/api/v1/collections/${editing.collection_id}`, "PATCH", values)
      : await send("/api/v1/collections", "POST", values);
    if (!err) {
      if (editing) {
        setCollections((list) => list.map((c) => (c.collection_id === editing.collection_id ? { ...c, ...values } : c)));
      }
      router.refresh();
    }
    return err;
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`ลบคอลเลคชัน "${collection.name}"? นิยายในแฟ้มจะยังอยู่ในชั้นหนังสือของคุณ`)) return;
    setCollections((list) => list.filter((c) => c.collection_id !== collection.collection_id));
    setOpenId((id) => (id === collection.collection_id ? null : id));
    const err = await send(`/api/v1/collections/${collection.collection_id}`, "DELETE");
    if (err) setError(err);
    router.refresh();
  }

  async function toggleInCollection(collectionId: string, novelId: string, inCollection: boolean) {
    const novel = entryByNovel.get(novelId)?.novel;
    setCollections((list) =>
      list.map((c) =>
        c.collection_id !== collectionId
          ? c
          : {
              ...c,
              novels: inCollection
                ? c.novels.filter((n) => n.novel_id !== novelId)
                : novel
                  ? [...c.novels, novel]
                  : c.novels,
            }
      )
    );
    const err = inCollection
      ? await send(`/api/v1/collections/${collectionId}/items/${novelId}`, "DELETE")
      : await send(`/api/v1/collections/${collectionId}/items`, "POST", { novel_id: novelId });
    if (err) setError(err);
    router.refresh();
  }

  const addToCollection = addTo ? collections.find((c) => c.collection_id === addTo) : undefined;

  // ---------- render ----------
  if (counts.all === 0) return <LibraryEmptyState />;

  return (
    <div className="pb-10 max-md:pb-28">
      {/* ---------- header ---------- */}
      <header>
        <h1 className="text-h1 text-neutral-900 max-lg:text-h2 max-md:text-[1.75rem]">ชั้นหนังสือของฉัน</h1>
        <p className="mt-1 text-sm text-neutral-500">{counts.all.toLocaleString()} เรื่อง</p>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>
            ปิด
          </button>
        </p>
      )}

      {/* ---------- 1. อ่านต่อ (ชั้นอะคริลิก) ---------- */}
      {continueShelf && (
        <section aria-labelledby="lib-continue" className="mt-10 max-md:mt-6">
          <SectionHead
            id="lib-continue"
            title={continueShelf.isReading ? "อ่านต่อ" : "เริ่มเรื่องถัดไป"}
            hint={continueShelf.isReading ? "เรื่องที่อ่านค้าง · กดปกเพื่ออ่านต่อ" : "ยังไม่มีเรื่องที่อ่านค้าง · เรื่องที่จองไว้อ่าน"}
          />
          <AcrylicShelf
            group={continueShelf.group}
            hrefOf={(novel) => continueHref(novel.novel_id, entryByNovel.get(novel.novel_id)?.progress ?? null)}
            badgeOf={(novel) => {
              const entry = entryByNovel.get(novel.novel_id);
              return entry?.progress ? `${progressPercent(entry.progress, novel.chapter_count)}%` : null;
            }}
          />
        </section>
      )}

      {/* ---------- 2. คอลเลคชัน (แฟ้มกระดาษ) — เปิดแฟ้ม = กรองส่วนที่ 3 ---------- */}
      <section
        aria-labelledby="lib-folders"
        className={cn("mt-10 max-md:mt-6", continueShelf && "border-t border-neutral-200 pt-8 max-md:pt-6")}
      >
        <SectionHead id="lib-folders" title="คอลเลคชัน" hint="กลุ่มที่คุณสร้าง · กดแฟ้มเพื่อกรองชั้นด้านล่าง" />
        <div
          ref={folderRowRef}
          className="-mx-8 flex items-end gap-6 overflow-x-auto px-8 pb-2 pt-8 max-lg:-mx-6 max-lg:px-6 max-md:-mx-4 max-md:gap-4 max-md:px-4 scrollbar-hide"
        >
          {collections.map((collection, i) => (
            <CollectionFolder
              key={collection.collection_id + collection.novels.length}
              label={collection.name}
              meta={`${collection.novels.length} เรื่อง`}
              tone="cream"
              sheetShape="cover"
              action="more"
              files={folderFiles(collection.novels)}
              width={FOLDER_WIDTH}
              appearDelay={Math.min(i, 6) * 80}
              open={openId === collection.collection_id}
              onOpenChange={(isOpen) => {
                if (!isOpen && outsidePress.current) return;
                setOpenId((id) => (isOpen ? collection.collection_id : id === collection.collection_id ? null : id));
              }}
              menu={[
                { label: "เพิ่ม / เอานิยายออก", onSelect: () => setAddTo(collection.collection_id) },
                { label: "เปลี่ยนชื่อ", onSelect: () => setFormFor(collection) },
                { label: "ลบคอลเลคชัน", danger: true, onSelect: () => void deleteCollection(collection) },
              ]}
            />
          ))}
          {collections.length === 0 ? (
            <button
              type="button"
              onClick={() => setFormFor("new")}
              style={{ height: 150, marginBottom: 14 }}
              className="flex w-full max-w-md shrink-0 items-center gap-4 rounded-2xl border-2 border-dashed border-neutral-300 px-6 text-left transition-colors hover:border-[#b89f74] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f2e8d5] text-[#6b5641]">
                <Plus className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-semibold text-neutral-900">สร้างแฟ้มแรก</span>
                <span className="block text-sm text-neutral-500">จัดกลุ่มหนังสือเอง เช่น แฟนตาซี, อ่านซ้ำ, อ่านริมทะเล</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFormFor("new")}
              aria-label="สร้างคอลเลคชันใหม่"
              title="สร้างคอลเลคชันใหม่"
              style={{ width: 110, height: 150, marginBottom: 14 }}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-400 transition-colors",
                "hover:border-[#b89f74] hover:text-[#6b5641] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              )}
            >
              <Plus className="h-7 w-7" strokeWidth={1.6} />
            </button>
          )}
        </div>
      </section>

      {/* ---------- 3. ชั้นหนังสือทั้งหมด (สันหนังสือ) — กรองสถานะ + แฟ้มที่เปิด ---------- */}
      <section aria-labelledby="lib-spines" className="mt-10 border-t border-neutral-200 pt-8 max-md:mt-6 max-md:pt-6">
        <SectionHead id="lib-spines" title="ชั้นหนังสือทั้งหมด" hint={`${spineGroup.novels.length.toLocaleString()} เรื่อง · เลื่อนดูได้`} />

        <div className="mb-6 flex items-center gap-2 max-lg:flex-wrap max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 scrollbar-hide">
          <div role="radiogroup" aria-label="กรองตามสถานะ" className="flex gap-2 max-md:flex-nowrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => changeFilter(f)}
                className={cn(
                  "h-11 shrink-0 whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2",
                  filter === f ? "bg-primary-500 text-white shadow-sm" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                )}
              >
                {filterLabel[f]} <span className={filter === f ? "text-white/80" : "text-neutral-400"}>({scopeCounts[f]})</span>
              </button>
            ))}
          </div>
          {open && (
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="inline-flex h-11 min-w-0 shrink-0 items-center gap-1.5 rounded-pill bg-[#f2e8d5] px-4 text-sm font-medium text-[#4a3a2a] hover:bg-[#ebdfc7]"
            >
              <span className="max-w-[16rem] truncate">ในแฟ้ม: {open.name}</span>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">ปิดแฟ้ม ดูทั้งหมด</span>
            </button>
          )}
        </div>

        {spineGroup.novels.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">
            {open && scope.length === 0
              ? `ยังไม่มีนิยายในแฟ้ม "${open.name}"`
              : `ไม่มีนิยายสถานะ "${filterLabel[filter]}"${open ? ` ในแฟ้ม "${open.name}"` : ""}`}
          </p>
        ) : (
          <SpineShelf group={spineGroup} entries={entryByNovel} />
        )}
      </section>

      {/* ---------- มือถือ: ปุ่มลอย "เพิ่มนิยาย" ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden justify-center pb-[calc(1rem+env(safe-area-inset-bottom))] max-md:flex">
        <Link
          href="/search"
          className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-pill bg-neutral-900 px-6 text-sm font-semibold text-white shadow-xl shadow-black/20"
        >
          <Plus className="h-4 w-4" />
          เพิ่มนิยาย
        </Link>
      </div>

      <CollectionFormDialog
        open={formFor !== null}
        collection={formFor && formFor !== "new" ? formFor : undefined}
        onClose={() => setFormFor(null)}
        onSubmit={saveCollection}
      />
      <AddNovelsDialog
        open={addTo !== null}
        collection={addToCollection}
        entries={entries}
        onClose={() => setAddTo(null)}
        onToggle={(novelId, inCollection) => toggleInCollection(addTo!, novelId, inCollection)}
      />
    </div>
  );
}

function SectionHead({ id, title, hint, extra }: { id: string; title: string; hint?: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <h2 id={id} className="text-h3 text-neutral-900 max-md:text-xl max-md:font-semibold">
          {title}
        </h2>
        {extra}
      </div>
      {hint && <p className="text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}

function LibraryEmptyState() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <svg viewBox="0 0 240 150" className="w-64 max-md:w-52" aria-hidden>
        <rect x="20" y="104" width="200" height="14" rx="7" className="fill-brand-tan/60" />
        <rect x="28" y="118" width="8" height="22" rx="2" className="fill-brand-brown/40" />
        <rect x="204" y="118" width="8" height="22" rx="2" className="fill-brand-brown/40" />
        <rect x="58" y="54" width="22" height="50" rx="3" className="fill-primary-300/70" />
        <rect x="84" y="40" width="18" height="64" rx="3" className="fill-brand-brown/30" />
        <rect x="150" y="62" width="44" height="12" rx="3" transform="rotate(-14 150 62)" className="fill-neutral-300" />
        <circle cx="130" cy="30" r="3" className="fill-primary-400" />
        <circle cx="170" cy="22" r="2" className="fill-brand-tan" />
      </svg>
      <h1 className="mt-6 text-h3 text-neutral-900">ชั้นหนังสือยังว่างอยู่</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        กด &ldquo;เพิ่มเข้าชั้น&rdquo; จากหน้านิยายที่ชอบ หรือเริ่มอ่านสักเรื่อง แล้วเรื่องนั้นจะมารออยู่ที่นี่
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex h-12 items-center gap-2 rounded-pill bg-primary-500 px-6 text-sm font-semibold text-white hover:bg-primary-600"
      >
        <Compass className="h-4 w-4" />
        สำรวจนิยาย
      </Link>
    </div>
  );
}
