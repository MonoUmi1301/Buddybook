"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/library/shelf-utils";
import { ShelfTitle } from "@/components/library/ShelfTitle";
import { COLLECTION_ICONS, collectionIconMeta, isCollectionIcon, type CollectionIcon } from "@/lib/collectionIcons";
import {
  collectionTintLabel,
  collectionTintRgb,
  coverOf,
  type Collection,
  type CollectionTint,
  type LibraryEntry,
} from "@/lib/library";

interface CollectionFormDialogProps {
  open: boolean;
  /** undefined = สร้างใหม่ */
  collection?: Collection;
  onClose: () => void;
  onSubmit: (values: { name: string; icon: CollectionIcon | null; tint: CollectionTint }) => Promise<string | null>;
}

/** สร้าง/แก้ชั้นย่อย — ชื่อ, ไอคอน (ชุดคงที่ ไม่ใช่อีโมจิ — ดู lib/collectionIcons.ts), สี */
export function CollectionFormDialog({ open, collection, onClose, onSubmit }: CollectionFormDialogProps) {
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState<CollectionIcon | null>(null);
  const [tint, setTint] = React.useState<CollectionTint>("purple");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? "");
    setIcon(isCollectionIcon(collection?.icon) ? collection.icon : null);
    setTint(collection?.tint ?? "purple");
    setError(null);
  }, [open, collection]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("ตั้งชื่อชั้นก่อนนะ");
      return;
    }
    setSaving(true);
    const err = await onSubmit({ name: name.trim(), icon, tint });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Dialog open={open} title={collection ? "แก้ไขชั้น" : "สร้างชั้นใหม่"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm font-medium text-neutral-700">
          ชื่อชั้น
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            placeholder="เช่น อ่านริมทะเล"
            className="mt-1.5 block h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-700">ไอคอน (ไม่บังคับ)</legend>
          <div className="mt-1.5 grid grid-cols-7 gap-2 max-sm:grid-cols-5">
            {COLLECTION_ICONS.map((key) => {
              const { Icon, label } = collectionIconMeta[key];
              const selected = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(selected ? null : key)}
                  aria-pressed={selected}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "flex aspect-square min-h-[44px] w-full items-center justify-center rounded-lg border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                    selected ? "border-primary-400 bg-primary-500/10" : "border-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  <Icon className="h-5 w-5" style={{ color: `rgb(${collectionTintRgb[tint]})` }} strokeWidth={2.2} aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 text-neutral-500">
              ตัวอย่าง:{" "}
              <ShelfTitle
                name={name.trim() || "ชื่อชั้น"}
                icon={icon}
                tintRgb={collectionTintRgb[tint]}
                className="align-middle font-medium text-neutral-900"
              />
            </span>
            {icon && (
              <button type="button" onClick={() => setIcon(null)} className="min-h-[44px] px-2 text-neutral-500 hover:text-neutral-800">
                ไม่ใช้ไอคอน
              </button>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-700">สีชั้น</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(Object.keys(collectionTintRgb) as CollectionTint[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTint(t)}
                aria-pressed={tint === t}
                aria-label={collectionTintLabel[t]}
                className={cn(
                  "h-11 w-11 rounded-full ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                  tint === t && "ring-2 ring-neutral-900"
                )}
                style={{ backgroundColor: `rgb(${collectionTintRgb[t]})` }}
              />
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-pill px-5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-pill bg-primary-500 px-6 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {collection ? "บันทึก" : "สร้างชั้น"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

interface AddNovelsDialogProps {
  open: boolean;
  collection?: Collection;
  entries: LibraryEntry[];
  onClose: () => void;
  onToggle: (novelId: string, inCollection: boolean) => Promise<void>;
}

/** เลือกนิยายจากชั้นหนังสือหลักใส่/เอาออกจากชั้นย่อย — กดแล้วบันทึกทันที */
export function AddNovelsDialog({ open, collection, entries, onClose, onToggle }: AddNovelsDialogProps) {
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!collection) return null;
  const inCollection = new Set(collection.novels.map((n) => n.novel_id));
  const q = query.trim().toLowerCase();
  const list = q ? entries.filter((e) => e.novel.title.toLowerCase().includes(q)) : entries;

  return (
    <Dialog open={open} title={`เพิ่มนิยายเข้า "${collection.name}"`} onClose={onClose}>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาในชั้นหนังสือของคุณ"
          aria-label="ค้นหาในชั้นหนังสือของคุณ"
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none"
        />
      </label>

      <ul className="mt-3 max-h-[50vh] divide-y divide-neutral-100 overflow-y-auto">
        {list.map((entry) => {
          const checked = inCollection.has(entry.novel.novel_id);
          return (
            <li key={entry.novel.novel_id}>
              <button
                type="button"
                disabled={pending === entry.novel.novel_id}
                onClick={async () => {
                  setPending(entry.novel.novel_id);
                  await onToggle(entry.novel.novel_id, checked);
                  setPending(null);
                }}
                aria-pressed={checked}
                className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left hover:bg-neutral-50 disabled:opacity-60"
              >
                <Image src={coverOf(entry.novel)} alt="" width={400} height={600} sizes="36px" className="aspect-[2/3] w-9 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{entry.novel.title}</span>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                    checked ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 text-neutral-400"
                  )}
                >
                  {checked ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-6 text-center text-sm text-neutral-400">ไม่พบนิยายที่ตรงกับคำค้น</li>}
      </ul>

      <Link href="/search" className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary-600 hover:underline">
        หานิยายเรื่องใหม่เข้าชั้น →
      </Link>
    </Dialog>
  );
}
