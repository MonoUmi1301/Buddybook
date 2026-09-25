"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Minus, Plus, X } from "lucide-react";
import { GiftImage } from "@/components/gifts/GiftImage";
import { LetterCard } from "@/components/gifts/LetterCard";
import { toast } from "@/components/ui/Toaster";
import { useDialogA11y } from "@/hooks/use-dialog-a11y";
import { CARD_TEMPLATES, type CardTemplate } from "@/lib/donate-assets";
import {
  ANONYMOUS_NAME,
  CARD_MESSAGE_MAX,
  QUANTITY_MAX,
  QUANTITY_MIN,
  SIGNATURE_MAX,
  TEMPLATE_LABELS,
  clearDraft,
  countCardChars,
  fetchBalance,
  fetchCatalog,
  formatCoins,
  newIdempotencyKey,
  saveDraft,
  sendGift,
  stripEmoji,
  type GiftCatalog,
  type GiftCatalogItem,
  type GiftDraft,
  type GiftTarget,
  type GiftTier,
  type SendGiftError,
} from "@/lib/gifts";
import { cn } from "@/lib/cn";

type Selection = { kind: "gift"; giftId: string } | { kind: "custom" } | null;
type Stage = "compose" | "confirm" | "sending" | "done";

interface GiftDialogProps {
  target: GiftTarget;
  /** ชื่อผู้ใช้ที่ล็อกอิน — ใช้เป็นชื่อลงท้ายตั้งต้นของการ์ด */
  viewerName: string;
  /** เลือกไว้ให้ก่อน (เช่น ปุ่มท้ายตอน = coffee) */
  initialGiftSlug?: string;
  /** ร่างที่ค้างไว้ตอนไปเติมคอยน์ */
  draft?: GiftDraft | null;
  onClose: () => void;
}

const TILE_SIZES = "(max-width: 767px) 26vw, (max-width: 1023px) 16vw, 112px";
const SEND_ANIMATION_MS = 1900;
const QUICK_QUANTITIES = [1, 3, 5, 10];
const QUICK_CUSTOM = [10, 50, 100, 500];

const TIER_RIBBON: Record<GiftTier, string> = {
  S: "bg-gift-matcha/40 text-gift-ink",
  M: "bg-gift-blush/50 text-gift-ink",
  L: "bg-gift-bear/35 text-gift-ink",
  XL: "bg-gift-navy text-gift-surface",
};

const TEMPLATE_SWATCH: Record<CardTemplate, string> = {
  stamp: "bg-gift-paper border-gift-bear",
  matcha: "bg-gift-matcha",
  navy: "bg-gift-navy",
  bear: "bg-gift-bear",
};

function animationClass(item: GiftCatalogItem | undefined) {
  if (!item) return "";
  return { none: "", pop: "gift-anim-pop", float: "gift-anim-float", sparkle: "gift-anim-sparkle" }[item.animation];
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gift-ink">{label}</span>
        <span className="block text-xs text-gift-muted">{hint}</span>
      </span>
      <span className="relative inline-flex shrink-0 items-center">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-7 w-12 rounded-full bg-gift-edge transition-colors peer-checked:bg-gift-bear peer-focus-visible:ring-2 peer-focus-visible:ring-gift-bear peer-focus-visible:ring-offset-2 motion-reduce:transition-none" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-gift-surface shadow transition-transform peer-checked:translate-x-5 motion-reduce:transition-none" />
      </span>
    </label>
  );
}

/**
 * เพิ่มภายหลัง (Gift donations) — ส่งของขวัญ + การ์ดจดหมายถึงนักเขียน (แทน DonateModal เดิม)
 * - desktop (>=1024) / tablet: modal สองคอลัมน์ ซ้ายเลือกของขวัญ ขวาพรีวิวการ์ด + ช่องเขียน
 * - mobile (<768): แผ่นเลื่อนจากล่าง 3 ขั้น (เลือกของขวัญ -> เขียนการ์ด -> ยืนยัน)
 * - เงินไม่พอ: เก็บร่างใน sessionStorage แล้วพาไปหน้าเติมคอยน์ หน้านั้นมีปุ่มพากลับมาเปิด dialog พร้อมร่างเดิม
 * - กันกดซ้ำด้วย idempotency_key ต่อ "ความตั้งใจส่งหนึ่งครั้ง" (แก้อะไรในร่าง = key ใหม่,
 *   ส่งซ้ำเพราะเน็ตหลุด = key เดิม) ราคาไม่ถูกส่งไป API เลย
 */
export function GiftDialog({ target, viewerName, initialGiftSlug, draft, onClose }: GiftDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [catalog, setCatalog] = useState<GiftCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  const [selection, setSelection] = useState<Selection>(null);
  const [quantity, setQuantity] = useState(draft?.quantity ?? 1);
  const [customCoins, setCustomCoins] = useState(draft?.customCoins ? String(draft.customCoins) : "");
  const [template, setTemplate] = useState<CardTemplate>(draft?.template ?? "stamp");
  const [message, setMessage] = useState(draft?.message ?? "");
  const [signature, setSignature] = useState(draft?.signature ?? "");
  const [isAnonymous, setIsAnonymous] = useState(draft?.isAnonymous ?? false);
  const [isPublic, setIsPublic] = useState(draft?.isPublic ?? false);

  const [stage, setStage] = useState<Stage>("compose");
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);
  const [error, setError] = useState<SendGiftError | null>(null);
  const [emojiNotice, setEmojiNotice] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const busy = stage === "sending" || stage === "done";
  useDialogA11y(dialogRef, onClose, !busy);

  function loadCatalog() {
    setCatalogError(false);
    fetchCatalog()
      .then((data) => {
        setCatalog(data);
        setSelection((current) => {
          if (current) return current;
          if (draft) {
            if (draft.giftId && data.items.some((i) => i.gift_id === draft.giftId)) return { kind: "gift", giftId: draft.giftId };
            if (draft.customCoins) return { kind: "custom" };
          }
          const preset = initialGiftSlug && data.items.find((i) => i.slug === initialGiftSlug);
          return preset ? { kind: "gift", giftId: preset.gift_id } : null;
        });
      })
      .catch(() => setCatalogError(true));
  }

  useEffect(() => {
    loadCatalog();
    fetchBalance().then(setBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดครั้งเดียวตอนเปิด
  }, []);

  const selectedGift = selection?.kind === "gift" ? catalog?.items.find((i) => i.gift_id === selection.giftId) : undefined;
  const customAmount = Number.parseInt(customCoins, 10);
  const total =
    selection?.kind === "gift" && selectedGift
      ? selectedGift.price_coins * quantity
      : selection?.kind === "custom" && Number.isFinite(customAmount) && customAmount > 0
        ? customAmount
        : 0;
  const maxPerSend = catalog?.max_coins_per_send ?? Infinity;
  const missing = balance !== null ? Math.max(0, total - balance) : 0;
  const messageCount = countCardChars(message);
  const signatureCount = countCardChars(signature);
  const feePercent = selection?.kind === "gift" ? (catalog?.fee_percent ?? 0) : 0;
  const authorReceives = total - Math.floor((total * Math.round(feePercent * 100)) / 10000);

  const selectionValid = total > 0 && total <= maxPerSend;
  const cardValid = messageCount <= CARD_MESSAGE_MAX && signatureCount <= SIGNATURE_MAX;
  // ยอดคงเหลือโหลดไม่ได้ (null) ก็ยังส่งได้ — API เช็คยอดจริงอีกชั้นแล้วตอบ 422 ถ้าไม่พอ
  const canConfirm = selectionValid && cardValid && missing === 0;

  const displaySignature = isAnonymous ? ANONYMOUS_NAME : signature.trim() || viewerName;

  // แก้อะไรก็ตามในร่าง = ความตั้งใจส่งครั้งใหม่ → ต้องใช้ key ใหม่ (ไม่งั้น API ตอบ 409 ว่า key ถูกใช้กับของอื่นแล้ว)
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [selection, quantity, customCoins, template, message, signature, isAnonymous, isPublic]);

  // ข้อผิดพลาดเดิมหายเมื่อผู้ใช้แก้สิ่งที่เกี่ยวข้อง
  useEffect(() => {
    setError((e) => (e?.kind === "field" ? null : e));
  }, [message, signature]);
  useEffect(() => {
    setError((e) => (e?.kind === "insufficient" ? null : e));
  }, [selection, quantity, customCoins]);

  function selectGift(item: GiftCatalogItem) {
    setSelection({ kind: "gift", giftId: item.gift_id });
  }

  function setQuantityClamped(n: number) {
    if (!Number.isFinite(n)) return;
    setQuantity(Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.round(n))));
  }

  function onMessageChange(value: string) {
    const cleaned = stripEmoji(value);
    if (cleaned !== value) setEmojiNotice(true);
    setMessage(cleaned);
  }

  function goTopUp() {
    saveDraft({
      target,
      returnTo: `${window.location.pathname}${window.location.search}`,
      giftId: selection?.kind === "gift" ? selection.giftId : null,
      customCoins: selection?.kind === "custom" && customAmount > 0 ? customAmount : null,
      quantity,
      template,
      message,
      signature,
      isAnonymous,
      isPublic,
    });
    router.push("/wallet");
  }

  function toConfirm() {
    if (!canConfirm) return;
    setError(null);
    setStage("confirm");
  }

  async function submit() {
    if (!canConfirm || busy) return;
    idempotencyKeyRef.current ??= newIdempotencyKey();
    setStage("sending");
    setError(null);

    const result = await sendGift({
      author_id: target.authorId,
      novel_id: target.novelId,
      chapter_id: target.chapterId,
      ...(selection?.kind === "gift" ? { gift_id: selection.giftId, quantity } : { custom_coins: customAmount }),
      card: {
        template,
        message: message.trim() || undefined,
        signature_name: isAnonymous ? undefined : signature.trim() || undefined,
        is_anonymous: isAnonymous,
        is_public: isPublic,
      },
      idempotency_key: idempotencyKeyRef.current,
    });

    if (!result.ok) {
      setError(result.error);
      if (result.error.kind === "insufficient") {
        setBalance(result.error.balance);
        setStage("compose");
        setMobileStep(1);
      } else if (result.error.kind === "field") {
        setStage("compose");
        setMobileStep(2);
      } else {
        setStage("confirm");
      }
      return;
    }

    setBalance(result.data.balance_after);
    clearDraft();
    const finish = () => {
      onClose();
      toast(`ส่งของขวัญให้ ${target.authorName} แล้ว`);
      router.refresh();
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    setStage("done");
    window.setTimeout(finish, SEND_ANIMATION_MS);
  }

  const giftLabel = selectedGift
    ? `${selectedGift.name_th} x${quantity}`
    : selection?.kind === "custom"
      ? "Custom coins"
      : "";

  const stepTitles = ["เลือกของขวัญ", "เขียนการ์ด", "ยืนยัน"];
  const currentMobileStep = stage === "compose" ? mobileStep : 3;

  function goBack() {
    if (busy) return;
    if (stage === "confirm") setStage("compose");
    else if (mobileStep === 2) setMobileStep(1);
  }

  const canGoBack = !busy && (stage === "confirm" || mobileStep === 2);

  const catalogItems = useMemo(() => catalog?.items ?? [], [catalog]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 md:items-center md:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-dialog-title"
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-gift-surface text-gift-ink shadow-2xl outline-none",
          "max-h-[92dvh] rounded-t-3xl animate-in slide-in-from-bottom-8 duration-200 motion-reduce:animate-none",
          "md:max-h-[min(90vh,780px)] md:max-w-[880px] md:rounded-3xl md:zoom-in-95 md:slide-in-from-bottom-0 lg:max-w-[1060px]"
        )}
      >
        {/* ---------- header ---------- */}
        <div className="flex shrink-0 items-center gap-2 border-b border-gift-edge px-3 pb-3 pt-2 md:px-6 md:pt-4">
          <div aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-gift-edge md:hidden" />
          <button
            type="button"
            onClick={goBack}
            aria-label="ย้อนกลับ"
            className={cn(
              "mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gift-muted hover:bg-gift-edge/50",
              canGoBack ? (stage === "confirm" ? "" : "md:hidden") : "invisible md:hidden"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="mt-2 min-w-0 flex-1 text-center md:text-left">
            <h2 id="gift-dialog-title" className="truncate text-lg font-bold md:text-xl">
              ส่งของขวัญให้ {target.authorName}
            </h2>
            {target.novelTitle && <p className="truncate text-xs text-gift-muted md:text-sm">จากเรื่อง {target.novelTitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="ปิด"
            className="mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gift-muted hover:bg-gift-edge/50 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ---------- ลำดับขั้น (mobile) ---------- */}
        <ol className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-xs md:hidden" aria-label="ขั้นตอน">
          {stepTitles.map((title, i) => (
            <li key={title} className="flex items-center gap-2" aria-current={currentMobileStep === i + 1 ? "step" : undefined}>
              {i > 0 && <span aria-hidden className="h-px w-4 bg-gift-edge" />}
              <span
                className={cn(
                  "rounded-pill px-2.5 py-1",
                  currentMobileStep === i + 1 ? "bg-gift-bear/20 font-semibold text-gift-ink" : "text-gift-muted"
                )}
              >
                {i + 1}. {title}
              </span>
            </li>
          ))}
        </ol>

        {/* ---------- body ---------- */}
        {stage === "compose" ? (
          <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:overflow-hidden">
            {/* ซ้าย: เลือกของขวัญ */}
            <section
              aria-label="เลือกของขวัญ"
              className={cn("px-4 pb-4 pt-2 md:overflow-y-auto md:border-r md:border-gift-edge md:px-6 md:py-5", mobileStep === 2 && "max-md:hidden")}
            >
              {catalogError ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gift-muted">โหลดรายการของขวัญไม่สำเร็จ</p>
                  <button type="button" onClick={loadCatalog} className="mt-3 min-h-[44px] rounded-pill border border-gift-bear px-5 text-sm font-medium">
                    ลองอีกครั้ง
                  </button>
                </div>
              ) : !catalog ? (
                <div className="flex justify-center py-16" aria-label="กำลังโหลด">
                  <Loader2 className="h-6 w-6 animate-spin text-gift-bear" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-4">
                    {catalogItems.map((item, index) => {
                      const selected = selection?.kind === "gift" && selection.giftId === item.gift_id;
                      return (
                        <button
                          key={item.gift_id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => selectGift(item)}
                          className={cn(
                            "gift-tile relative flex min-h-[44px] flex-col items-center rounded-2xl border-2 bg-gift-paper px-1.5 pb-2 pt-4 text-center",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gift-bear focus-visible:ring-offset-2 focus-visible:ring-offset-gift-surface",
                            selected ? "border-gift-bear shadow-md" : "border-transparent"
                          )}
                        >
                          <span className={cn("gift-tier-ribbon absolute left-2 top-0 px-1.5 pb-2 pt-0.5 text-[10px] font-bold", TIER_RIBBON[item.tier])}>
                            {item.tier}
                          </span>
                          <span className={cn("block aspect-square w-full max-w-[104px]", selected && animationClass(item))}>
                            <GiftImage slug={item.slug} alt="" sizes={TILE_SIZES} eager={index < 4} />
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs font-medium leading-snug sm:text-sm">{item.name_th}</span>
                          <span className="mt-0.5 text-xs font-semibold text-gift-bear">{formatCoins(item.price_coins)}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      aria-pressed={selection?.kind === "custom"}
                      onClick={() => setSelection({ kind: "custom" })}
                      className={cn(
                        "gift-tile flex min-h-[44px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-gift-paper px-2 py-4 text-center",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gift-bear focus-visible:ring-offset-2 focus-visible:ring-offset-gift-surface",
                        selection?.kind === "custom" ? "border-gift-bear border-solid shadow-md" : "border-gift-edge"
                      )}
                    >
                      <span className="text-sm font-semibold">Custom coins</span>
                      <span className="mt-1 text-xs text-gift-muted">ระบุจำนวนคอยน์เอง</span>
                    </button>
                  </div>

                  {/* จำนวน / คอยน์ตามใจ */}
                  {selection?.kind === "gift" && selectedGift && (
                    <div className="mt-5 rounded-2xl bg-gift-paper p-4 md:sticky md:bottom-0 md:shadow-[0_-10px_20px_-8px_rgb(var(--gift-surface))] md:ring-1 md:ring-gift-edge">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{selectedGift.name_th}</p>
                          {selectedGift.description_th && <p className="line-clamp-2 text-xs text-gift-muted">{selectedGift.description_th}</p>}
                        </div>
                        <div className="flex shrink-0 items-center" role="group" aria-label="จำนวน">
                          <button
                            type="button"
                            onClick={() => setQuantityClamped(quantity - 1)}
                            disabled={quantity <= QUANTITY_MIN}
                            aria-label="ลดจำนวน"
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-gift-edge bg-gift-surface disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={QUANTITY_MIN}
                            max={QUANTITY_MAX}
                            value={quantity}
                            aria-label="จำนวนชิ้น"
                            onChange={(e) => setQuantityClamped(Number(e.target.value))}
                            className="h-11 w-14 bg-transparent text-center text-base font-semibold tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setQuantityClamped(quantity + 1)}
                            disabled={quantity >= QUANTITY_MAX}
                            aria-label="เพิ่มจำนวน"
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-gift-edge bg-gift-surface disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {QUICK_QUANTITIES.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setQuantityClamped(n)}
                            aria-pressed={quantity === n}
                            className={cn(
                              "min-h-[36px] min-w-[44px] rounded-pill border px-3 text-xs font-medium",
                              quantity === n ? "border-gift-bear bg-gift-bear/15" : "border-gift-edge"
                            )}
                          >
                            x{n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selection?.kind === "custom" && (
                    <div className="mt-5 rounded-2xl bg-gift-paper p-4 md:sticky md:bottom-0 md:shadow-[0_-10px_20px_-8px_rgb(var(--gift-surface))] md:ring-1 md:ring-gift-edge">
                      <label htmlFor="gift-custom-coins" className="text-sm font-semibold">
                        จำนวนคอยน์
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          id="gift-custom-coins"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={maxPerSend === Infinity ? undefined : maxPerSend}
                          value={customCoins}
                          placeholder="เช่น 50"
                          onChange={(e) => setCustomCoins(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
                          className="h-11 min-w-0 flex-1 rounded-xl border border-gift-edge bg-gift-surface px-4 text-base tabular-nums focus:border-gift-bear focus:outline-none"
                        />
                        <span className="text-sm text-gift-muted">คอยน์</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {QUICK_CUSTOM.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCustomCoins(String(n))}
                            aria-pressed={customAmount === n}
                            className={cn(
                              "min-h-[36px] min-w-[44px] rounded-pill border px-3 text-xs font-medium",
                              customAmount === n ? "border-gift-bear bg-gift-bear/15" : "border-gift-edge"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      {total > maxPerSend && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">ส่งได้สูงสุด {formatCoins(maxPerSend)} ต่อครั้ง</p>
                      )}
                    </div>
                  )}

                  {!selection && <p className="mt-5 text-center text-sm text-gift-muted">เลือกของขวัญหนึ่งชิ้น หรือระบุคอยน์เอง</p>}
                </>
              )}
            </section>

            {/* ขวา: พรีวิวการ์ด + ช่องเขียน */}
            <section
              aria-label="เขียนการ์ด"
              className={cn("px-4 pb-4 pt-2 md:overflow-y-auto md:px-6 md:py-5", mobileStep === 1 && "max-md:hidden")}
            >
              <LetterCard
                template={template}
                recipientName={target.authorName}
                message={message}
                signature={displaySignature}
                placeholder="ข้อความของคุณจะแสดงตรงนี้"
              />

              <fieldset className="mt-5">
                <legend className="text-sm font-semibold">แบบการ์ด</legend>
                <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup">
                  {CARD_TEMPLATES.map((t) => (
                    <label
                      key={t}
                      className={cn(
                        "flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-xs",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gift-bear",
                        template === t ? "border-gift-bear bg-gift-bear/10 font-semibold" : "border-gift-edge"
                      )}
                    >
                      <input type="radio" name="gift-template" value={t} checked={template === t} onChange={() => setTemplate(t)} className="sr-only" />
                      <span aria-hidden className={cn("h-4 w-4 rounded-full border", TEMPLATE_SWATCH[t])} />
                      {TEMPLATE_LABELS[t]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="gift-message" className="text-sm font-semibold">
                    ข้อความถึงนักเขียน <span className="font-normal text-gift-muted">(ไม่บังคับ)</span>
                  </label>
                  <span
                    className={cn("text-xs tabular-nums", messageCount > CARD_MESSAGE_MAX ? "font-semibold text-red-600 dark:text-red-400" : "text-gift-muted")}
                    aria-live="polite"
                  >
                    {messageCount}/{CARD_MESSAGE_MAX}
                  </span>
                </div>
                <textarea
                  id="gift-message"
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  rows={4}
                  maxLength={CARD_MESSAGE_MAX * 2}
                  aria-describedby="gift-message-hint"
                  aria-invalid={messageCount > CARD_MESSAGE_MAX || (error?.kind === "field" && error.field === "message")}
                  className="mt-1.5 w-full resize-none rounded-xl border border-gift-edge bg-gift-surface px-3 py-2.5 text-base leading-relaxed focus:border-gift-bear focus:outline-none md:text-sm"
                />
                <p id="gift-message-hint" className="mt-1 text-xs text-gift-muted">
                  {emojiNotice ? "การ์ดรองรับเฉพาะตัวอักษร อีโมจิจะถูกตัดออก " : ""}
                  ห้ามใส่ลิงก์ อีเมล หรือเบอร์โทร
                </p>
                {error?.kind === "field" && (error.field === "message" || error.field === "signature_name") && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error.message}
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="gift-signature" className="text-sm font-semibold">
                  ลงชื่อ
                </label>
                <input
                  id="gift-signature"
                  value={isAnonymous ? ANONYMOUS_NAME : signature}
                  disabled={isAnonymous}
                  onChange={(e) => setSignature(stripEmoji(e.target.value).slice(0, SIGNATURE_MAX * 2))}
                  placeholder={viewerName}
                  className="mt-1.5 h-11 w-full rounded-xl border border-gift-edge bg-gift-surface px-3 text-base focus:border-gift-bear focus:outline-none disabled:opacity-60 md:text-sm"
                />
                {signatureCount > SIGNATURE_MAX && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">ชื่อยาวเกิน {SIGNATURE_MAX} ตัวอักษร</p>
                )}
              </div>

              <div className="mt-3 divide-y divide-gift-edge">
                <Switch checked={isAnonymous} onChange={setIsAnonymous} label="ไม่ระบุตัวตน" hint={`นักเขียนจะเห็นว่าส่งจาก "${ANONYMOUS_NAME}"`} />
                <Switch
                  checked={isPublic}
                  onChange={setIsPublic}
                  label="แสดงการ์ดต่อสาธารณะ"
                  hint={isPublic ? "การ์ดจะแสดงในหน้านิยาย/หน้านักเขียน" : "ปิดอยู่: นักเขียนอ่านได้คนเดียว"}
                />
              </div>
            </section>
          </div>
        ) : (
          /* ---------- ยืนยัน ---------- */
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
            <div className="mx-auto grid max-w-2xl gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="flex flex-col items-center text-center">
                <div className={cn("h-32 w-32", animationClass(selectedGift))}>
                  {selectedGift ? (
                    <GiftImage slug={selectedGift.slug} alt={selectedGift.name_th} sizes="128px" eager />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-gift-paper text-lg font-bold text-gift-bear">
                      {total}
                    </div>
                  )}
                </div>
                <p className="mt-2 font-semibold">{giftLabel}</p>
                <p className="text-sm text-gift-bear">{formatCoins(total)}</p>
              </div>
              <div className="min-w-0">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gift-muted">ส่งถึง</dt>
                    <dd className="text-right font-medium">{target.authorName}</dd>
                  </div>
                  {target.novelTitle && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gift-muted">เรื่อง</dt>
                      <dd className="truncate text-right">{target.novelTitle}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-gift-muted">ผู้ส่ง</dt>
                    <dd className="text-right">{isAnonymous ? ANONYMOUS_NAME : displaySignature}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gift-muted">การ์ด</dt>
                    <dd className="text-right">
                      {message.trim() ? (isPublic ? "แสดงต่อสาธารณะ" : "นักเขียนอ่านได้คนเดียว") : "ไม่มีข้อความ"}
                    </dd>
                  </div>
                  {feePercent > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gift-muted">นักเขียนได้รับ</dt>
                      <dd className="text-right">
                        {formatCoins(authorReceives)} <span className="text-xs text-gift-muted">(หักค่าธรรมเนียม {feePercent}%)</span>
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 border-t border-gift-edge pt-2">
                    <dt className="text-gift-muted">คงเหลือหลังส่ง</dt>
                    <dd className="text-right font-semibold tabular-nums">{balance !== null ? formatCoins(balance - total) : "-"}</dd>
                  </div>
                </dl>
                {message.trim() && (
                  <div className="mt-4">
                    <LetterCard template={template} recipientName={target.authorName} message={message} signature={displaySignature} size="mini" />
                  </div>
                )}
                {error && error.kind !== "field" && error.kind !== "insufficient" && (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                    {error.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------- footer ---------- */}
        <div className="gift-safe-bottom shrink-0 border-t border-gift-edge bg-gift-surface px-4 pt-3 md:px-6 md:pb-4">
          {missing > 0 && stage === "compose" && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-gift-blush/20 px-3 py-2">
              <p className="text-sm">
                คอยน์ไม่พอ ขาดอีก <span className="font-semibold tabular-nums">{formatCoins(missing)}</span>
              </p>
              <button
                type="button"
                onClick={goTopUp}
                className="min-h-[44px] shrink-0 rounded-pill border border-gift-bear bg-gift-surface px-4 text-sm font-semibold hover:bg-gift-bear/10"
              >
                เติมคอยน์
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gift-muted">รวม</p>
              <p className="text-lg font-bold tabular-nums leading-tight">{formatCoins(total)}</p>
              <p className="text-xs text-gift-muted">
                คงเหลือ {balance === null ? "..." : <span className="tabular-nums">{formatCoins(balance)}</span>}
              </p>
              {/* ยอดที่นักเขียนได้จริง — ของขวัญหักค่าธรรมเนียมแพลตฟอร์ม (ปัดเศษลง), Custom coins ไม่หัก */}
              {total > 0 && (
                <p className="text-xs text-gift-muted">
                  {feePercent > 0 ? (
                    <>
                      นักเขียนจะได้รับ <span className="font-semibold tabular-nums text-gift-ink">{formatCoins(authorReceives)}</span> (หลังหักค่าธรรมเนียม {feePercent}%)
                    </>
                  ) : (
                    "นักเขียนได้รับเต็มจำนวน"
                  )}
                </p>
              )}
            </div>

            {stage === "compose" && (
              <>
                {/* mobile: ไปทีละขั้น */}
                <button
                  type="button"
                  onClick={() => (mobileStep === 1 ? setMobileStep(2) : toConfirm())}
                  disabled={mobileStep === 1 ? !selectionValid : !canConfirm}
                  className="min-h-[48px] shrink-0 rounded-pill bg-gift-bear px-6 text-sm font-semibold text-white shadow-sm disabled:opacity-50 md:hidden"
                >
                  {mobileStep === 1 ? "ถัดไป" : "ตรวจสอบ"}
                </button>
                <button
                  type="button"
                  onClick={toConfirm}
                  disabled={!canConfirm}
                  className="hidden min-h-[48px] shrink-0 rounded-pill bg-gift-bear px-8 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gift-bear/90 disabled:opacity-50 md:block"
                >
                  ส่งของขวัญ
                </button>
              </>
            )}

            {stage !== "compose" && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setStage("compose")}
                  disabled={busy}
                  className="hidden min-h-[48px] rounded-pill border border-gift-edge px-5 text-sm font-medium disabled:opacity-50 md:block"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !canConfirm}
                  data-autofocus
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-pill bg-gift-bear px-6 text-sm font-semibold text-white shadow-sm disabled:opacity-60 md:px-8"
                >
                  {stage === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  ยืนยันส่ง
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---------- ส่งสำเร็จ: ของขวัญเข้าซอง แล้วซองบินออก ---------- */}
        {stage === "done" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gift-surface/95" role="status" aria-live="polite">
            <div className="gift-send__envelope relative h-28 w-44">
              <div className="gift-envelope__body absolute inset-0 rounded-lg" />
              <div className="absolute inset-x-0 -top-2 z-0 flex justify-center">
                <div className="gift-send__item h-20 w-20">
                  {selectedGift ? (
                    <GiftImage slug={selectedGift.slug} alt="" sizes="80px" eager />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-gift-paper font-bold text-gift-bear">{total}</div>
                  )}
                </div>
              </div>
              <div className="gift-envelope__pocket absolute inset-0 z-[1] rounded-b-lg" />
              <div className="gift-send__flap gift-envelope__flap absolute inset-x-0 top-0 z-[2] h-16" />
              <div className="gift-wax-seal absolute left-1/2 top-12 z-[3] h-6 w-6 -translate-x-1/2 rounded-full" />
            </div>
            <p className="mt-8 text-sm font-medium text-gift-ink">กำลังส่งถึง {target.authorName}</p>
          </div>
        )}
      </div>
    </div>
  );
}
