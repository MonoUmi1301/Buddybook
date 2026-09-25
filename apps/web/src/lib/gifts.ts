import type { CardTemplate } from "@/lib/donate-assets";

/** เพิ่มภายหลัง (Gift donations) — type + helper ฝั่งหน้าเว็บของระบบของขวัญ (API อยู่ที่ apps/api/src/modules/gifts) */

export type GiftTier = "S" | "M" | "L" | "XL";
export type GiftAnimation = "none" | "pop" | "float" | "sparkle";

export interface GiftCatalogItem {
  gift_id: string;
  slug: string;
  name_th: string;
  name_en: string;
  description_th: string | null;
  image_url: string;
  tier: GiftTier;
  animation: GiftAnimation;
  price_coins: number;
  is_limited: boolean;
  available_to: string | null;
}

export interface GiftCatalog {
  items: GiftCatalogItem[];
  fee_percent: number;
  max_coins_per_send: number;
}

export interface GiftTarget {
  authorId: string;
  authorName: string;
  novelId?: string;
  novelTitle?: string;
  chapterId?: string;
}

export const CARD_MESSAGE_MAX = 500;
export const SIGNATURE_MAX = 50;
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;
export const ANONYMOUS_NAME = "นักอ่านนิรนาม";

export const TEMPLATE_LABELS: Record<CardTemplate, string> = {
  stamp: "แสตมป์",
  matcha: "มัทฉะ",
  navy: "กรมท่า",
  bear: "หมีน้อย",
};

export const TIER_LABELS: Record<GiftTier, string> = { S: "S", M: "M", L: "L", XL: "XL" };

export function formatCoins(n: number) {
  return `${n.toLocaleString("th-TH")} คอยน์`;
}

// ---------------------------------------------------------------------------
// ข้อความ — ตัดอีโมจิ/HTML ทิ้งตั้งแต่ตอนพิมพ์ และนับตัวอักษรแบบเดียวกับ API (code point หลังทำความสะอาด)
// ---------------------------------------------------------------------------

const EMOJI_RE =
  /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u{1F3FB}-\u{1F3FF}]|\u{FE0E}|\u{FE0F}|\u{200D}|\u{20E3}|[\u{E0020}-\u{E007F}]/gu;
const HTML_TAG_RE = /<\/?[a-zA-Z!][^>]*>/g;

export function stripEmoji(text: string) {
  return text.replace(EMOJI_RE, "");
}

export function countCardChars(text: string) {
  return [...stripEmoji(text).replace(HTML_TAG_RE, "").trim()].length;
}

// ---------------------------------------------------------------------------
// ร่างที่ยังส่งไม่เสร็จ — เก็บไว้ตอนไปเติมคอยน์ (ออกไปหน้า Stripe แล้วกลับมาที่ /wallet) เพื่อพากลับมาส่งต่อ
// sessionStorage อาจใช้ไม่ได้ (private mode/ถูกบล็อก) ทุกการอ่าน/เขียนจึงห่อ try/catch และไม่มีร่างก็ใช้งานได้ปกติ
// ---------------------------------------------------------------------------

const DRAFT_KEY = "bb_gift_draft";
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
export const RESUME_PARAM = "gift";
export const RESUME_VALUE = "resume";

export interface GiftDraft {
  target: GiftTarget;
  /** หน้าที่จะพากลับไปพร้อม ?gift=resume */
  returnTo: string;
  giftId: string | null;
  customCoins: number | null;
  quantity: number;
  template: CardTemplate;
  message: string;
  signature: string;
  isAnonymous: boolean;
  isPublic: boolean;
  savedAt: number;
}

export function saveDraft(draft: Omit<GiftDraft, "savedAt">) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // ไม่มีที่เก็บร่าง — ผู้ใช้กลับมาแล้วต้องเลือกใหม่ ไม่กระทบการเติมเงิน
  }
}

export function readDraft(): GiftDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as GiftDraft;
    if (!draft?.target?.authorId || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function resumeHref(returnTo: string) {
  const url = new URL(returnTo, "http://placeholder");
  url.searchParams.set(RESUME_PARAM, RESUME_VALUE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `gift-${crypto.randomUUID()}`;
  return `gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface SendGiftBody {
  author_id: string;
  novel_id?: string;
  chapter_id?: string;
  gift_id?: string;
  custom_coins?: number;
  quantity?: number;
  card?: {
    template?: CardTemplate;
    message?: string;
    signature_name?: string;
    is_anonymous?: boolean;
    is_public?: boolean;
  };
  idempotency_key: string;
}

export interface SendGiftResponse {
  donation: { donation_id: string; amount: number };
  balance_after: number;
  replayed: boolean;
}

export type SendGiftError =
  | { kind: "insufficient"; missing: number; balance: number }
  | { kind: "field"; field: string; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "other"; message: string };

export async function fetchCatalog(): Promise<GiftCatalog> {
  const res = await fetch("/api/v1/gifts/catalog", { cache: "no-store" });
  if (!res.ok) throw new Error("catalog");
  return res.json();
}

export async function fetchBalance(): Promise<number | null> {
  try {
    const res = await fetch("/api/v1/wallet/transactions", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { balance: number };
    return json.balance;
  } catch {
    return null;
  }
}

export async function sendGift(body: SendGiftBody): Promise<{ ok: true; data: SendGiftResponse } | { ok: false; error: SendGiftError }> {
  let res: Response;
  try {
    res = await fetch("/api/v1/gifts/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: { kind: "other", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" } };
  }
  const json = await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: json as SendGiftResponse };

  const details = json?.details;
  if (res.status === 422 && typeof details?.missing === "number") {
    return { ok: false, error: { kind: "insufficient", missing: details.missing, balance: details.balance } };
  }
  if (res.status === 422 && typeof details?.field === "string") {
    return { ok: false, error: { kind: "field", field: details.field, message: json.error } };
  }
  if (res.status === 429) {
    return { ok: false, error: { kind: "rate_limited", message: json?.error ?? "ส่งถี่เกินไป กรุณารอสักครู่" } };
  }
  return { ok: false, error: { kind: "other", message: json?.error ?? "ส่งของขวัญไม่สำเร็จ" } };
}

// ---------------------------------------------------------------------------
// กล่องจดหมายนักเขียน (Phase 3) — GET/PATCH /me/gifts/*
// ---------------------------------------------------------------------------

export const THANK_MESSAGE_MAX = 200;
export const REPORT_REASON_MAX = 200;

export interface GiftSummary {
  gift_id: string;
  slug: string;
  name_th: string;
  name_en: string;
  image_url: string;
  tier: GiftTier;
  animation: GiftAnimation;
}

export interface GiftUser {
  user_id: string;
  username: string;
  pen_name: string | null;
  avatar_url: string | null;
}

export interface InboxItem {
  donation_id: string;
  gift: GiftSummary | null;
  quantity: number;
  unit_price_coins: number | null;
  amount: number;
  net_amount: number;
  fee_amount: number;
  card_template: CardTemplate | null;
  message: string | null;
  signature_name: string | null;
  is_anonymous: boolean;
  is_public: boolean;
  sender: GiftUser | null;
  novel: { novel_id: string; title: string } | null;
  chapter: { chapter_id: string; chapter_number: number; title: string } | null;
  read_at: string | null;
  hidden_at: string | null;
  reported_at: string | null;
  thank_message: string | null;
  thanked_at: string | null;
  created_at: string;
}

export interface InboxPage {
  items: InboxItem[];
  next_cursor: string | null;
  unread_count: number;
}

export interface InboxStats {
  this_month: { gifts: number; sends: number; coins_earned: number; supporters: number };
  all_time: { gifts: number; sends: number; coins_earned: number };
  unread_count: number;
  top_gifts: { gift: GiftSummary; count: number }[];
  top_supporters: { user: GiftUser; total_coins: number }[];
  novels: { novel_id: string; title: string; count: number }[];
}

export type InboxStatus = "all" | "unread" | "hidden";

export interface InboxFilter {
  status: InboxStatus;
  novelId: string;
  giftId: string;
}

export function senderLabel(item: Pick<InboxItem, "is_anonymous" | "signature_name" | "sender">) {
  if (item.is_anonymous) return ANONYMOUS_NAME;
  return item.signature_name?.trim() || (item.sender ? item.sender.pen_name?.trim() || item.sender.username : ANONYMOUS_NAME);
}

export function giftLabel(item: Pick<InboxItem, "gift" | "quantity" | "amount">) {
  return item.gift ? `${item.gift.name_th} x${item.quantity}` : formatCoins(item.amount);
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  return json as T;
}

export async function fetchInbox(filter: InboxFilter, cursor?: string | null): Promise<InboxPage> {
  const params = new URLSearchParams();
  if (filter.status !== "all") params.set("status", filter.status);
  if (filter.novelId) params.set("novel_id", filter.novelId);
  if (filter.giftId) params.set("gift_id", filter.giftId);
  if (cursor) params.set("cursor", cursor);
  return jsonOrThrow(await fetch(`/api/v1/me/gifts/received?${params}`, { cache: "no-store" }));
}

export async function fetchInboxStats(): Promise<InboxStats> {
  return jsonOrThrow(await fetch("/api/v1/me/gifts/stats", { cache: "no-store" }));
}

export async function updateInboxItem(
  donationId: string,
  body: { read?: boolean; hidden?: boolean; report_reason?: string }
): Promise<InboxItem> {
  return jsonOrThrow(
    await fetch(`/api/v1/me/gifts/${donationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function thankInboxItem(donationId: string, message: string): Promise<InboxItem> {
  return jsonOrThrow(
    await fetch(`/api/v1/me/gifts/${donationId}/thank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  );
}

// ---------------------------------------------------------------------------
// หน้าสาธารณะ (Phase 4) — "กำลังใจจากนักอ่าน" + ป้ายผู้สนับสนุน
// ---------------------------------------------------------------------------

export interface PublicGiftCard {
  donation_id: string;
  gift: GiftSummary | null;
  quantity: number;
  card_template: CardTemplate | null;
  message: string;
  /** null เมื่อผู้ส่งเลือกไม่ระบุตัวตน */
  signature_name: string | null;
  sender: GiftUser | null;
  created_at: string;
}

export interface PublicGifts {
  total_gifts: number;
  gift_counts: { gift: GiftSummary; count: number }[];
  top_supporters: { user: GiftUser; total_coins: number }[];
  recent_cards: PublicGiftCard[];
}

export interface SupporterBadge {
  id: string;
  label: string;
  description_th: string;
  image_slug: string | null;
}

export function publicCardSignature(card: Pick<PublicGiftCard, "signature_name" | "sender">) {
  return card.signature_name?.trim() || (card.sender ? card.sender.pen_name?.trim() || card.sender.username : ANONYMOUS_NAME);
}
