"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, Compass, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CollectionIcon } from "@/lib/collectionIcons";
import { LibraryCoverflow } from "@/components/library/LibraryCoverflow";
import { AcrylicShelf, type ShelfGroup } from "@/components/library/AcrylicShelf";
import { SpineShelf } from "@/components/library/SpineShelf";
import { AddNovelsDialog, CollectionFormDialog } from "@/components/library/CollectionDialogs";
import {
  libraryStatusLabel,
  type Collection,
  type CollectionTint,
  type LibraryCounts,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/library";

export type LibraryFilter = "all" | LibraryStatus;
export type LibraryViewMode = "shelves" | "spines";

interface LibraryViewProps {
  entries: LibraryEntry[];
  counts: LibraryCounts;
  collections: Collection[];
  initialFilter: LibraryFilter;
  initialView: LibraryViewMode;
}

const FILTERS: LibraryFilter[] = ["all", "reading", "up_next", "completed"];
const filterLabel: Record<LibraryFilter, string> = { all: "ทั้งหมด", ...libraryStatusLabel };

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
 * หน้า My Library ฝั่ง client — ตัวกรองสถานะ (กรองทั้ง coverflow และชั้น), สลับมุมมองชั้นอะคริลิก/สันหนังสือ
 * (เก็บใน URL ?status= & ?view= ด้วย history.replaceState ไม่ต้องโหลดหน้าใหม่), จัดการชั้นย่อย
 * ทุกการแก้ไขอัปเดต state ทันทีแล้ว router.refresh() ให้ข้อมูลจาก server ตรงกันอีกรอบ
 */
export function LibraryView({ entries: initialEntries, counts: initialCounts, collections: initialCollections, initialFilter, initialView }: LibraryViewProps) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initialEntries);
  const [counts, setCounts] = React.useState(initialCounts);
  const [collections, setCollections] = React.useState(initialCollections);
  const [filter, setFilter] = React.useState<LibraryFilter>(initialFilter);
  const [view, setView] = React.useState<LibraryViewMode>(initialView);
  const [formFor, setFormFor] = React.useState<Collection | "new" | null>(null);
  const [addTo, setAddTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setEntries(initialEntries), [initialEntries]);
  React.useEffect(() => setCounts(initialCounts), [initialCounts]);
  React.useEffect(() => setCollections(initialCollections), [initialCollections]);

  function updateUrl(next: { status?: LibraryFilter; view?: LibraryViewMode }) {
    const params = new URLSearchParams(window.location.search);
    const status = next.status ?? filter;
    const v = next.view ?? view;
    if (status === "all") params.delete("status");
    else params.set("status", status);
    if (v === "shelves") params.delete("view");
    else params.set("view", v);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const entryByNovel = React.useMemo(() => new Map(entries.map((e) => [e.novel.novel_id, e])), [entries]);
  const matches = React.useCallback(
    (novelId: string) => filter === "all" || entryByNovel.get(novelId)?.status === filter,
    [entryByNovel, filter]
  );

  // coverflow: "ทั้งหมด" = กำลังอ่าน (ถ้าไม่มีเลยค่อยโชว์ทุกเรื่อง), ตัวกรองอื่น = ตามสถานะนั้น
  // เรียงตามอ่านล่าสุดก่อน แล้วตามวันที่เพิ่มเข้าชั้น
  const coverflowEntries = React.useMemo(() => {
    const reading = entries.filter((e) => e.status === "reading");
    const base = filter === "all" ? (reading.length ? reading : entries) : entries.filter((e) => e.status === filter);
    return [...base].sort((a, b) => {
      const ta = a.progress ? Date.parse(a.progress.last_read_at) : 0;
      const tb = b.progress ? Date.parse(b.progress.last_read_at) : 0;
      return tb - ta || Date.parse(b.added_at) - Date.parse(a.added_at);
    });
  }, [entries, filter]);
  const coverflowTitle =
    filter === "all" ? (entries.some((e) => e.status === "reading") ? "กำลังอ่าน" : "ในชั้นของคุณ") : filterLabel[filter];

  const groups: ShelfGroup[] = React.useMemo(() => {
    const inAny = new Set(collections.flatMap((c) => c.novels.map((n) => n.novel_id)));
    const list: ShelfGroup[] = collections
      .map((c) => ({
        id: c.collection_id,
        name: c.name,
        icon: c.icon,
        tint: c.tint,
        editable: true,
        novels: c.novels.filter((n) => matches(n.novel_id)),
      }))
      .filter((g) => filter === "all" || g.novels.length > 0);
    const loose = entries.filter((e) => !inAny.has(e.novel.novel_id) && matches(e.novel.novel_id)).map((e) => e.novel);
    if (loose.length > 0) {
      list.push({ id: "__loose", name: "ยังไม่ได้จัดชั้น", icon: null, tint: null, editable: false, novels: loose });
    }
    return list;
  }, [collections, entries, filter, matches]);

  // ---------- mutations ----------
  async function changeStatus(novelId: string, status: LibraryStatus) {
    const prev = entryByNovel.get(novelId)?.status;
    if (!prev || prev === status) return;
    setEntries((list) => list.map((e) => (e.novel.novel_id === novelId ? { ...e, status } : e)));
    setCounts((c) => ({ ...c, [prev]: c[prev] - 1, [status]: c[status] + 1 }));
    const err = await send(`/api/v1/library/${novelId}`, "PATCH", { status });
    if (err) setError(err);
    router.refresh();
  }

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

  async function setTint(collectionId: string, tint: CollectionTint) {
    setCollections((list) => list.map((c) => (c.collection_id === collectionId ? { ...c, tint } : c)));
    const err = await send(`/api/v1/collections/${collectionId}`, "PATCH", { tint });
    if (err) setError(err);
    router.refresh();
  }

  async function deleteCollection(collection: Collection) {
    if (!window.confirm(`ลบชั้น "${collection.name}"? นิยายในชั้นจะยังอยู่ในชั้นหนังสือของคุณ`)) return;
    setCollections((list) => list.filter((c) => c.collection_id !== collection.collection_id));
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

  const collectionById = (id: string) => collections.find((c) => c.collection_id === id);
  const addToCollection = addTo ? collectionById(addTo) : undefined;

  // ---------- render ----------
  if (counts.all === 0) return <LibraryEmptyState />;

  const viewToggle = (
    <div role="radiogroup" aria-label="มุมมองชั้นหนังสือ" className="flex shrink-0 rounded-pill bg-neutral-100 p-1">
      {(
        [
          ["shelves", "ชั้นอะคริลิก", LayoutGrid],
          ["spines", "สันหนังสือ", BookMarked],
        ] as const
      ).map(([mode, label, Icon]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={view === mode}
          aria-label={label}
          onClick={() => {
            setView(mode);
            updateUrl({ view: mode });
          }}
          className={cn(
            "flex h-10 items-center gap-2 rounded-pill px-4 text-sm font-medium transition-colors max-md:w-11 max-md:justify-center max-md:px-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
            view === mode ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="max-md:hidden">{label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="pb-10 max-md:pb-28">
      {/* ---------- header ---------- */}
      <header className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 text-neutral-900 max-lg:text-h2 max-md:text-[1.75rem]">ชั้นหนังสือของฉัน</h1>
            <p className="mt-1 text-sm text-neutral-500">{counts.all.toLocaleString()} เรื่อง</p>
          </div>
          {viewToggle}
        </div>

        <div className="flex items-center gap-3 max-lg:flex-wrap max-md:flex-nowrap">
          <div
            role="radiogroup"
            aria-label="กรองตามสถานะ"
            className="flex gap-2 max-lg:flex-wrap max-md:-mx-4 max-md:snap-x max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 scrollbar-hide"
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => {
                  setFilter(f);
                  updateUrl({ status: f });
                }}
                className={cn(
                  "h-11 shrink-0 snap-start whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2",
                  filter === f ? "bg-primary-500 text-white shadow-sm" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                )}
              >
                {filterLabel[f]} <span className={filter === f ? "text-white/80" : "text-neutral-400"}>({counts[f]})</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFormFor("new")}
            className="ml-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-pill border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:text-primary-600 max-md:hidden"
          >
            <Plus className="h-4 w-4" />
            สร้างชั้นใหม่
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>
            ปิด
          </button>
        </p>
      )}

      {/* ---------- coverflow ---------- */}
      <div className="mt-10 border-t border-neutral-200 pt-10 max-md:mt-6 max-md:pt-6">
        {coverflowEntries.length > 0 ? (
          <LibraryCoverflow title={coverflowTitle} entries={coverflowEntries} onStatusChange={changeStatus} />
        ) : (
          <p className="py-10 text-center text-sm text-neutral-400">ไม่มีนิยายสถานะ &ldquo;{filterLabel[filter]}&rdquo; ในชั้นตอนนี้</p>
        )}
      </div>

      {/* ---------- shelves ---------- */}
      <div className="mt-12 border-t border-neutral-200 pt-10 max-md:mt-8 max-md:pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-h3 text-neutral-900 max-md:text-xl max-md:font-semibold">ชั้นย่อยของฉัน</h2>
          <button
            type="button"
            onClick={() => setFormFor("new")}
            className="hidden h-11 items-center gap-1.5 rounded-pill px-3 text-sm font-medium text-primary-600 hover:bg-primary-500/10 max-md:inline-flex"
          >
            <Plus className="h-4 w-4" />
            ชั้นใหม่
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">ไม่มีชั้นที่มีนิยายตรงกับตัวกรองนี้</p>
        ) : (
          <div className={cn("space-y-14 max-md:space-y-10", view === "spines" && "space-y-10")}>
            {groups.map((group) => {
              const collection = collectionById(group.id);
              return view === "spines" ? (
                <SpineShelf key={group.id} group={group} entries={entryByNovel} />
              ) : (
                <AcrylicShelf
                  key={group.id}
                  group={group}
                  onAdd={collection ? () => setAddTo(group.id) : undefined}
                  onRename={collection ? () => setFormFor(collection) : undefined}
                  onTint={collection ? (t) => setTint(group.id, t) : undefined}
                  onDelete={collection ? () => deleteCollection(collection) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

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
