"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { GiftImage } from "@/components/gifts/GiftImage";
import { InboxEnvelope } from "@/components/gifts/inbox/InboxEnvelope";
import { LetterViewer } from "@/components/gifts/inbox/LetterViewer";
import {
  fetchCatalog,
  fetchInbox,
  fetchInboxStats,
  formatCoins,
  updateInboxItem,
  type GiftCatalogItem,
  type InboxFilter,
  type InboxItem,
  type InboxStats,
  type InboxStatus,
} from "@/lib/gifts";
import { cn } from "@/lib/cn";

interface GiftInboxProps {
  authorName: string;
  initialItems: InboxItem[];
  initialCursor: string | null;
  initialStats: InboxStats | null;
  /** donation_id จากลิงก์ในแจ้งเตือน (?open=) — เปิดซองนั้นให้ทันที */
  openId?: string;
}

const STATUS_TABS: { value: InboxStatus; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "unread", label: "ยังไม่อ่าน" },
  { value: "hidden", label: "ซ่อนไว้" },
];

const FLAP_MS = 320;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gift-paper px-4 py-3">
      <p className="text-xs text-gift-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gift-ink">{value}</p>
    </div>
  );
}

/**
 * เพิ่มภายหลัง (Gift donations) — "กล่องจดหมาย" ในแดชบอร์ดนักเขียน (/write/gifts)
 * สถิติ + ตัวกรอง (สถานะ/นิยาย/ของขวัญ) + กริดซองจดหมาย แตะซอง = ฝาเปิดแล้วการ์ดลอยขึ้นมา
 * ซองที่ยังไม่อ่านจะถูกทำเครื่องหมายอ่านแล้วตอนเปิด
 */
export function GiftInbox({ authorName, initialItems, initialCursor, initialStats, openId }: GiftInboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [stats, setStats] = useState(initialStats);
  const [filter, setFilter] = useState<InboxFilter>({ status: "all", novelId: "", giftId: "" });
  const [loading, setLoading] = useState<"list" | "more" | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  // อัตราค่าธรรมเนียมปัจจุบัน (ใช้แค่เป็นป้าย % — ยอดจริงของแต่ละรายการมาจาก fee_amount ที่บันทึกตอนส่ง)
  const [feePercent, setFeePercent] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<InboxItem | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    fetchCatalog()
      .then((c) => {
        setCatalog(c.items);
        setFeePercent(c.fee_percent);
      })
      .catch(() => undefined);
  }, []);

  // เปลี่ยนตัวกรอง = โหลดหน้าแรกใหม่
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let cancelled = false;
    setLoading("list");
    setListError(null);
    fetchInbox(filter)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.next_cursor);
      })
      .catch((e: Error) => !cancelled && setListError(e.message))
      .finally(() => !cancelled && setLoading(null));
    return () => {
      cancelled = true;
    };
  }, [filter]);

  // ลิงก์จากแจ้งเตือน: เปิดซองที่ระบุ แล้วลบ ?open= ออกจาก URL
  useEffect(() => {
    if (!openId) return;
    router.replace(pathname, { scroll: false });
    const target = initialItems.find((i) => i.donation_id === openId);
    if (target) openEnvelope(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ทำครั้งเดียวตอนเข้าหน้า
  }, []);

  function replaceItem(next: InboxItem) {
    setItems((prev) => {
      // ซ่อน/เลิกซ่อนแล้วไม่ตรงกับแท็บที่ดูอยู่ = เอาออกจากรายการ
      if (filter.status === "all" && next.hidden_at) return prev.filter((i) => i.donation_id !== next.donation_id);
      if (filter.status === "hidden" && !next.hidden_at) return prev.filter((i) => i.donation_id !== next.donation_id);
      return prev.map((i) => (i.donation_id === next.donation_id ? next : i));
    });
    setViewing((v) => (v?.donation_id === next.donation_id ? next : v));
  }

  function refreshStats() {
    fetchInboxStats()
      .then(setStats)
      .catch(() => undefined);
  }

  function openEnvelope(item: InboxItem) {
    if (openingId) return;
    const show = () => {
      setOpeningId(null);
      setViewing(item);
    };
    if (!item.read_at) {
      // อ่านแล้ว: อัปเดตในจอทันที ไม่รอ API (ถ้าพลาดก็แค่ยังนับเป็นยังไม่อ่านในครั้งหน้า)
      const readNow = { ...item, read_at: new Date().toISOString() };
      setItems((prev) => prev.map((i) => (i.donation_id === item.donation_id ? readNow : i)));
      setStats((s) => (s ? { ...s, unread_count: Math.max(0, s.unread_count - 1) } : s));
      updateInboxItem(item.donation_id, { read: true }).catch(() => undefined);
      item = readNow;
    }
    if (prefersReducedMotion()) {
      show();
      return;
    }
    setOpeningId(item.donation_id);
    window.setTimeout(show, FLAP_MS);
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading("more");
    try {
      const page = await fetchInbox(filter, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(null);
    }
  }

  const selectClass =
    "h-11 min-w-0 rounded-xl border border-gift-edge bg-gift-surface px-3 text-sm text-gift-ink focus:border-gift-bear focus:outline-none";

  return (
    <div className="text-gift-ink">
      {/* ---------- สถิติ ---------- */}
      {stats && (
        <section aria-label="สถิติของขวัญ" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="ของขวัญเดือนนี้" value={`${stats.this_month.gifts.toLocaleString("th-TH")} ชิ้น`} />
          <StatTile label="คอยน์ที่ได้รับเดือนนี้" value={formatCoins(stats.this_month.coins_earned)} />
          <StatTile label="ผู้สนับสนุนเดือนนี้" value={`${stats.this_month.supporters.toLocaleString("th-TH")} คน`} />
          <StatTile label="ยังไม่อ่าน" value={`${stats.unread_count.toLocaleString("th-TH")} ฉบับ`} />
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {/* ---------- ตัวกรอง ---------- */}
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="สถานะ" className="flex w-full rounded-pill bg-gift-paper p-1 sm:w-auto">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={filter.status === t.value}
                  onClick={() => setFilter((f) => ({ ...f, status: t.value }))}
                  className={cn(
                    "min-h-[40px] flex-1 rounded-pill px-4 text-sm sm:flex-none",
                    filter.status === t.value ? "bg-gift-surface font-semibold shadow-sm" : "text-gift-muted"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="inbox-novel">
              กรองตามนิยาย
            </label>
            <select
              id="inbox-novel"
              value={filter.novelId}
              onChange={(e) => setFilter((f) => ({ ...f, novelId: e.target.value }))}
              className={cn(selectClass, "flex-1 sm:max-w-[14rem] sm:flex-none")}
            >
              <option value="">ทุกเรื่อง</option>
              {stats?.novels.map((n) => (
                <option key={n.novel_id} value={n.novel_id}>
                  {n.title} ({n.count})
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="inbox-gift">
              กรองตามของขวัญ
            </label>
            <select
              id="inbox-gift"
              value={filter.giftId}
              onChange={(e) => setFilter((f) => ({ ...f, giftId: e.target.value }))}
              className={cn(selectClass, "flex-1 sm:max-w-[12rem] sm:flex-none")}
            >
              <option value="">ของขวัญทุกแบบ</option>
              {catalog.map((g) => (
                <option key={g.gift_id} value={g.gift_id}>
                  {g.name_th}
                </option>
              ))}
            </select>
          </div>

          {/* ---------- ซองจดหมาย ---------- */}
          <div className="relative mt-4">
            {loading === "list" && (
              <div className="absolute inset-0 z-[2] flex items-start justify-center bg-gift-surface/60 pt-16" aria-label="กำลังโหลด">
                <Loader2 className="h-6 w-6 animate-spin text-gift-bear" />
              </div>
            )}
            {listError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
                {listError}
              </p>
            )}
            {items.length === 0 && loading !== "list" ? (
              <div className="rounded-2xl border border-dashed border-gift-edge px-6 py-16 text-center">
                <p className="font-semibold">
                  {filter.status === "unread" ? "อ่านครบทุกฉบับแล้ว" : filter.status === "hidden" ? "ไม่มีการ์ดที่ซ่อนไว้" : "ยังไม่มีจดหมาย"}
                </p>
                {filter.status === "all" && !filter.novelId && !filter.giftId && (
                  <p className="mt-1 text-sm text-gift-muted">เมื่อนักอ่านส่งของขวัญหรือการ์ดมา จะมาอยู่ที่นี่</p>
                )}
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((item, index) => (
                  <li key={item.donation_id}>
                    <InboxEnvelope
                      item={item}
                      eager={index < 4}
                      opening={openingId === item.donation_id}
                      feePercent={feePercent}
                      onOpen={() => openEnvelope(item)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {cursor && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading !== null}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border border-gift-edge px-6 text-sm hover:border-gift-bear disabled:opacity-50"
                >
                  {loading === "more" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  โหลดเพิ่ม
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---------- ของขวัญยอดนิยม / ผู้สนับสนุน ---------- */}
        {stats && (
          <aside className="space-y-4">
            <section className="rounded-2xl bg-gift-paper p-4">
              <h2 className="text-sm font-semibold">ของขวัญที่ได้รับมากที่สุด</h2>
              {stats.top_gifts.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {stats.top_gifts.map(({ gift, count }) => (
                    <li key={gift.gift_id} className="flex items-center gap-3">
                      <span className="h-10 w-10 shrink-0">
                        <GiftImage slug={gift.slug} alt="" sizes="40px" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{gift.name_th}</span>
                      <span className="text-sm font-semibold tabular-nums">{count.toLocaleString("th-TH")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gift-muted">ยังไม่มี</p>
              )}
            </section>
            <section className="rounded-2xl bg-gift-paper p-4">
              <h2 className="text-sm font-semibold">ผู้สนับสนุนสูงสุด</h2>
              <p className="text-xs text-gift-muted">ไม่นับผู้ที่ส่งแบบไม่ระบุตัวตน</p>
              {stats.top_supporters.length > 0 ? (
                <ol className="mt-3 space-y-2">
                  {stats.top_supporters.map(({ user, total_coins }, i) => (
                    <li key={user.user_id} className="flex items-center gap-3">
                      <span className="w-4 text-center text-xs font-bold text-gift-muted">{i + 1}</span>
                      <Avatar src={user.avatar_url ?? undefined} alt={user.username} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{user.pen_name || user.username}</span>
                      <span className="text-xs font-semibold tabular-nums text-gift-bear">{formatCoins(total_coins)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-gift-muted">ยังไม่มี</p>
              )}
            </section>
            <p className="px-1 text-xs text-gift-muted">
              รวมทั้งหมด {stats.all_time.gifts.toLocaleString("th-TH")} ชิ้น · {formatCoins(stats.all_time.coins_earned)}
            </p>
          </aside>
        )}
      </div>

      {viewing && (
        <LetterViewer
          item={viewing}
          authorName={authorName}
          feePercent={feePercent}
          onChange={(next) => {
            replaceItem(next);
            refreshStats();
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
