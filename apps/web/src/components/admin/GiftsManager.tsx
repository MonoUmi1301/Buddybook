"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GiftImage } from "@/components/gifts/GiftImage";
import { toast } from "@/components/ui/Toaster";
import { giftImage } from "@/lib/donate-assets";
import { THAI_TIME_ZONE } from "@/lib/format";
import { formatCoins, type GiftAnimation, type GiftTier } from "@/lib/gifts";
import { cn } from "@/lib/cn";

export interface AdminGiftRow {
  gift_id: string;
  slug: string;
  name_th: string;
  name_en: string;
  description_th: string | null;
  price_coins: number;
  tier: GiftTier;
  image_url: string;
  animation: GiftAnimation;
  is_active: boolean;
  is_limited: boolean;
  available_from: string | null;
  available_to: string | null;
  sort_order: number;
}

interface FormState {
  slug: string;
  name_th: string;
  name_en: string;
  description_th: string;
  price_coins: string;
  tier: GiftTier;
  image_url: string;
  imageTouched: boolean;
  animation: GiftAnimation;
  is_active: boolean;
  is_limited: boolean;
  available_from: string;
  available_to: string;
  sort_order: string;
}

const TIERS: GiftTier[] = ["S", "M", "L", "XL"];
const ANIMATIONS: { value: GiftAnimation; label: string }[] = [
  { value: "none", label: "ไม่มี" },
  { value: "pop", label: "เด้ง (pop)" },
  { value: "float", label: "ลอย (float)" },
  { value: "sparkle", label: "วิบวับ (sparkle)" },
];

/** ISO -> ค่าของ <input type="datetime-local"> ตามเวลาเครื่องผู้ใช้ */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function toForm(row?: AdminGiftRow, nextSort = 0): FormState {
  return {
    slug: row?.slug ?? "",
    name_th: row?.name_th ?? "",
    name_en: row?.name_en ?? "",
    description_th: row?.description_th ?? "",
    price_coins: row ? String(row.price_coins) : "",
    tier: row?.tier ?? "S",
    image_url: row?.image_url ?? "",
    imageTouched: Boolean(row),
    animation: row?.animation ?? "pop",
    is_active: row?.is_active ?? true,
    is_limited: row?.is_limited ?? false,
    available_from: toLocalInput(row?.available_from ?? null),
    available_to: toLocalInput(row?.available_to ?? null),
    sort_order: String(row?.sort_order ?? nextSort),
  };
}

function windowLabel(row: AdminGiftRow) {
  if (!row.available_from && !row.available_to) return null;
  const f = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: THAI_TIME_ZONE }) : "...");
  return `${f(row.available_from)} - ${f(row.available_to)}`;
}

const selectClass =
  "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100";

/**
 * เพิ่มภายหลัง (Gift donations) — แอดมินจัดการแคตตาล็อกของขวัญ (GET/POST/PATCH/DELETE /admin/gifts)
 * ลบของที่เคยมีคนส่งแล้วไม่ได้ (ประวัติต้องอยู่) API จะปิดขายแทน
 * รูปอยู่ที่ apps/web/public/donate/gifts/<slug>.png — วางไฟล์ก่อนแล้วค่อยเพิ่มที่นี่ ไม่งั้นจะแสดงมาสคอตแทน
 */
export function GiftsManager({ initialGifts }: { initialGifts: AdminGiftRow[] }) {
  const [gifts, setGifts] = useState(initialGifts);
  const [editing, setEditing] = useState<{ id: string | null; form: FormState } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEditing((e) => {
      if (!e) return e;
      const form = { ...e.form, [key]: value };
      // รูปตาม slug อัตโนมัติจนกว่าแอดมินจะแก้ช่องรูปเอง
      if (key === "slug" && !form.imageTouched) form.image_url = value ? giftImage(String(value)) : "";
      if (key === "image_url") form.imageTouched = true;
      return { ...e, form };
    });
  }

  function startCreate() {
    const nextSort = Math.max(0, ...gifts.map((g) => g.sort_order)) + 10;
    setError(null);
    setEditing({ id: null, form: toForm(undefined, nextSort) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const f = editing.form;
    const body = {
      slug: f.slug.trim(),
      name_th: f.name_th.trim(),
      name_en: f.name_en.trim(),
      description_th: f.description_th.trim() || null,
      price_coins: Number(f.price_coins),
      tier: f.tier,
      image_url: f.image_url.trim(),
      animation: f.animation,
      is_active: f.is_active,
      is_limited: f.is_limited,
      available_from: fromLocalInput(f.available_from),
      available_to: fromLocalInput(f.available_to),
      sort_order: Number(f.sort_order) || 0,
    };
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing.id ? `/api/v1/admin/gifts/${editing.id}` : "/api/v1/admin/gifts", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status === 409 ? "มี slug นี้อยู่แล้ว" : (json?.error ?? "บันทึกไม่สำเร็จ ตรวจสอบข้อมูลอีกครั้ง"));
        return;
      }
      const row = json as AdminGiftRow;
      setGifts((gs) => (editing.id ? gs.map((g) => (g.gift_id === row.gift_id ? row : g)) : [...gs, row]).sort((a, b) => a.sort_order - b.sort_order));
      setEditing(null);
      toast(editing.id ? "บันทึกของขวัญแล้ว" : "เพิ่มของขวัญแล้ว");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AdminGiftRow) {
    setBusyId(row.gift_id);
    const res = await fetch(`/api/v1/admin/gifts/${row.gift_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    if (res.ok) {
      const next = (await res.json()) as AdminGiftRow;
      setGifts((gs) => gs.map((g) => (g.gift_id === next.gift_id ? next : g)));
    } else {
      toast("อัปเดตสถานะไม่สำเร็จ");
    }
    setBusyId(null);
  }

  async function remove(row: AdminGiftRow) {
    if (!window.confirm(`ลบ "${row.name_th}"? ถ้าเคยมีคนส่งชิ้นนี้แล้ว ระบบจะปิดขายแทนการลบ`)) return;
    setBusyId(row.gift_id);
    const res = await fetch(`/api/v1/admin/gifts/${row.gift_id}`, { method: "DELETE" });
    if (res.ok) {
      const result = (await res.json()) as { deleted: boolean; deactivated: boolean };
      if (result.deleted) {
        setGifts((gs) => gs.filter((g) => g.gift_id !== row.gift_id));
        toast("ลบของขวัญแล้ว");
      } else {
        setGifts((gs) => gs.map((g) => (g.gift_id === row.gift_id ? { ...g, is_active: false } : g)));
        toast("มีคนเคยส่งชิ้นนี้แล้ว จึงปิดขายแทนการลบ");
      }
    } else {
      toast("ลบไม่สำเร็จ");
    }
    setBusyId(null);
  }

  const f = editing?.form;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">ของขวัญ</h2>
          <p className="text-xs text-neutral-500">รูปต้องอยู่ที่ public/donate/gifts/&lt;slug&gt;.png (PNG พื้นใส)</p>
        </div>
        {!editing && (
          <Button type="button" variant="primary" onClick={startCreate}>
            <Plus className="h-4 w-4" />
            เพิ่มของขวัญ
          </Button>
        )}
      </div>

      {editing && f && (
        <form onSubmit={save} className="mb-6 rounded-card border border-neutral-200 bg-white p-4 sm:p-5">
          <h3 className="mb-4 font-semibold text-neutral-900">{editing.id ? `แก้ไข ${f.name_th}` : "เพิ่มของขวัญใหม่"}</h3>
          <div className="grid gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
            <div className="mx-auto h-24 w-24 rounded-xl bg-gift-paper p-1 sm:mx-0">
              {f.slug && <GiftImage key={f.slug} slug={f.slug} alt="" sizes="96px" eager />}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="gift-slug"
                label="slug (ชื่อไฟล์รูป)"
                value={f.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                required
                maxLength={50}
              />
              <Input id="gift-price" label="ราคา (คอยน์)" type="number" min={1} value={f.price_coins} onChange={(e) => set("price_coins", e.target.value)} required />
              <Input id="gift-name-th" label="ชื่อภาษาไทย" value={f.name_th} onChange={(e) => set("name_th", e.target.value)} required maxLength={100} />
              <Input id="gift-name-en" label="ชื่อภาษาอังกฤษ" value={f.name_en} onChange={(e) => set("name_en", e.target.value)} required maxLength={100} />
              <div className="sm:col-span-2">
                <Input id="gift-desc" label="คำอธิบาย (ไม่บังคับ)" value={f.description_th} onChange={(e) => set("description_th", e.target.value)} maxLength={500} />
              </div>
              <div>
                <label htmlFor="gift-tier" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  ขนาด
                </label>
                <select id="gift-tier" value={f.tier} onChange={(e) => set("tier", e.target.value as GiftTier)} className={selectClass}>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gift-animation" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  แอนิเมชัน
                </label>
                <select id="gift-animation" value={f.animation} onChange={(e) => set("animation", e.target.value as GiftAnimation)} className={selectClass}>
                  {ANIMATIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input id="gift-image" label="path รูป" value={f.image_url} onChange={(e) => set("image_url", e.target.value)} required />
              <Input id="gift-sort" label="ลำดับการแสดง" type="number" value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
              <Input
                id="gift-from"
                label="เริ่มขาย (ไม่บังคับ)"
                type="datetime-local"
                value={f.available_from}
                onChange={(e) => set("available_from", e.target.value)}
              />
              <Input
                id="gift-to"
                label="หยุดขาย (ไม่บังคับ)"
                type="datetime-local"
                value={f.available_to}
                onChange={(e) => set("available_to", e.target.value)}
              />
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4" />
                เปิดขาย
              </label>
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={f.is_limited} onChange={(e) => set("is_limited", e.target.checked)} className="h-4 w-4" />
                ของขวัญจำกัดเวลา
              </label>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              บันทึก
            </Button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-neutral-100 rounded-card border border-neutral-200 bg-white">
        {gifts.map((g) => {
          const saleWindow = windowLabel(g);
          return (
            <li key={g.gift_id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", !g.is_active && "opacity-60")}>
              <span className="h-12 w-12 shrink-0 rounded-lg bg-gift-paper p-0.5">
                <GiftImage slug={g.slug} alt="" sizes="48px" />
              </span>
              {/* มือถือ: ข้อมูลเต็มบรรทัด สถานะ/ปุ่มขึ้นบรรทัดใหม่ใต้ข้อมูล (desktop/tablet อยู่แถวเดียวกัน) */}
              <div className="min-w-0 flex-1 max-sm:basis-[calc(100%-3.75rem)]">
                <p className="text-sm font-medium text-neutral-900">
                  {g.name_th} <span className="text-neutral-400">/ {g.name_en}</span>
                </p>
                <p className="text-xs text-neutral-500">
                  {g.slug} · {formatCoins(g.price_coins)} · {g.tier} · {g.animation} · ลำดับ {g.sort_order}
                  {g.is_limited && " · จำกัดเวลา"}
                  {saleWindow && ` · ${saleWindow}`}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-pill px-2.5 py-0.5 text-xs font-medium max-sm:ml-[3.75rem]",
                  g.is_active ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-neutral-200 text-neutral-600"
                )}
              >
                {g.is_active ? "เปิดขาย" : "ปิดขาย"}
              </span>
              <div className="flex gap-1 max-sm:ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEditing({ id: g.gift_id, form: toForm(g) });
                  }}
                  className="min-h-[44px] rounded-lg px-3 text-sm text-primary-600 hover:bg-primary-500/10"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={busyId === g.gift_id}
                  onClick={() => toggleActive(g)}
                  className="min-h-[44px] rounded-lg px-3 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                >
                  {g.is_active ? "ปิดขาย" : "เปิดขาย"}
                </button>
                <button
                  type="button"
                  disabled={busyId === g.gift_id}
                  onClick={() => remove(g)}
                  className="min-h-[44px] rounded-lg px-3 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                >
                  ลบ
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
