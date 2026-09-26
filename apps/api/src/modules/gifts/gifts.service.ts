import { Prisma, type GiftCardTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import { assertNovelVisible } from "@/lib/novelVisibility";
import { WALLET_TX_OPTIONS, getBalance, ledgerTimestamp, lockWallets } from "@/modules/wallet/wallet.service";
import { sanitizeCardText } from "@/modules/gifts/gift-sanitize";
import { splitGiftFee } from "@/modules/gifts/gift-fee";
import { SUPPORTER_BADGES } from "@/config/supporterBadges";

/**
 * เพิ่มภายหลัง (Gift donations) — ของขวัญ + การ์ดจดหมายถึงนักเขียน ต่อยอดจากโดเนท coin เดิม
 * (ใช้ตาราง donations + wallet_transactions เดิม ไม่มีกระเป๋าแยก) โดเนท coin แบบเดิม
 * (POST /donations) วิ่งผ่าน sendGift ตัวเดียวกันในโหมด "Custom coins" (gift_id = null)
 */

export const CARD_MESSAGE_MAX = 500;
export const LEGACY_DONATION_MESSAGE_MAX = 1000;
export const SIGNATURE_MAX = 50;
export const THANK_MESSAGE_MAX = 200;
export const REPORT_REASON_MAX = 200;
export const ANONYMOUS_NAME = "นักอ่านนิรนาม";

const giftSelect = {
  gift_id: true,
  slug: true,
  name_th: true,
  name_en: true,
  image_url: true,
  tier: true,
  animation: true,
} satisfies Prisma.GiftItemSelect;

const userSelect = { user_id: true, username: true, pen_name: true, avatar_url: true } satisfies Prisma.UserSelect;

const donationListSelect = {
  donation_id: true,
  from_user_id: true,
  to_user_id: true,
  gift_id: true,
  amount: true,
  net_amount: true,
  fee_amount: true,
  quantity: true,
  unit_price_coins: true,
  message: true,
  card_template: true,
  signature_name: true,
  is_anonymous: true,
  is_public: true,
  read_at: true,
  hidden_at: true,
  reported_at: true,
  report_reason: true,
  thank_message: true,
  thanked_at: true,
  created_at: true,
  gift: { select: giftSelect },
  novel: { select: { novel_id: true, title: true } },
  chapter: { select: { chapter_id: true, chapter_number: true, title: true } },
  from_user: { select: userSelect },
  to_user: { select: userSelect },
} satisfies Prisma.DonationSelect;

type DonationListRow = Prisma.DonationGetPayload<{ select: typeof donationListSelect }>;

export function displayName(user: { username: string; pen_name: string | null }) {
  return user.pen_name || user.username;
}

function giftIsAvailable(gift: { is_active: boolean; available_from: Date | null; available_to: Date | null }, now = new Date()) {
  if (!gift.is_active) return false;
  if (gift.available_from && gift.available_from > now) return false;
  if (gift.available_to && gift.available_to <= now) return false;
  return true;
}

function sanitizeOrThrow(value: string | null | undefined, max: number, field: string) {
  const result = sanitizeCardText(value, max);
  if (!result.ok) throw ApiError.unprocessable(result.message, { field, reason: result.reason });
  return result.value;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** GET /gifts/catalog (Public) — เฉพาะของที่เปิดขายและอยู่ในช่วงเวลาขาย */
export async function listCatalog() {
  const now = new Date();
  const items = await prisma.giftItem.findMany({
    where: {
      is_active: true,
      AND: [
        { OR: [{ available_from: null }, { available_from: { lte: now } }] },
        { OR: [{ available_to: null }, { available_to: { gt: now } }] },
      ],
    },
    orderBy: [{ sort_order: "asc" }, { price_coins: "asc" }],
    select: {
      ...giftSelect,
      description_th: true,
      price_coins: true,
      is_limited: true,
      available_to: true,
    },
  });
  return { items, fee_percent: env.GIFT_PLATFORM_FEE_PERCENT, max_coins_per_send: env.GIFT_MAX_COINS_PER_SEND };
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export interface GiftCardInput {
  template?: GiftCardTemplate;
  message?: string;
  signature_name?: string;
  is_anonymous?: boolean;
  is_public?: boolean;
}

export interface SendGiftInput {
  author_id: string;
  novel_id?: string;
  chapter_id?: string;
  /** ส่งอย่างใดอย่างหนึ่ง: gift_id (ราคาอ่านจาก gift_items เสมอ) หรือ custom_coins */
  gift_id?: string;
  custom_coins?: number;
  quantity?: number;
  card?: GiftCardInput;
  idempotency_key?: string;
  /** POST /donations เดิมรับข้อความได้ 1000 ตัวอักษร — การ์ดใหม่ 500 */
  message_max?: number;
}

export interface SendGiftResult {
  donation: ReturnType<typeof toSentItem>;
  balance_after: number;
  replayed: boolean;
}

async function resolveTarget(from_user_id: string, input: SendGiftInput) {
  if (input.author_id === from_user_id) throw ApiError.badRequest("Cannot send a gift to yourself");

  const author = await prisma.user.findUnique({
    where: { user_id: input.author_id },
    select: { user_id: true, username: true, pen_name: true, is_suspended: true },
  });
  if (!author) throw ApiError.notFound("Recipient not found");
  if (author.is_suspended) throw ApiError.unprocessable("This author cannot receive gifts right now");

  let novel_id = input.novel_id;
  let chapter_id: string | undefined;

  if (input.chapter_id) {
    const chapter = await prisma.chapter.findUnique({
      where: { chapter_id: input.chapter_id },
      select: { chapter_id: true, novel_id: true, status: true },
    });
    if (!chapter || chapter.status !== "published") throw ApiError.notFound("Chapter not found");
    if (novel_id && novel_id !== chapter.novel_id) throw ApiError.badRequest("chapter_id does not belong to novel_id");
    novel_id = chapter.novel_id;
    chapter_id = chapter.chapter_id;
  }

  if (novel_id) {
    const novel = await prisma.novel.findUnique({
      where: { novel_id },
      select: { novel_id: true, author_id: true, visibility: true, allow_donations: true },
    });
    if (!novel) throw ApiError.notFound("Novel not found");
    assertNovelVisible(novel, from_user_id);
    if (novel.author_id !== author.user_id) throw ApiError.badRequest("novel_id does not belong to author_id");
    if (!novel.allow_donations) throw ApiError.unprocessable("The author has turned off gifts for this novel");
  }

  return { author, novel_id, chapter_id };
}

async function resolvePrice(input: SendGiftInput) {
  const hasGift = input.gift_id !== undefined;
  const hasCustom = input.custom_coins !== undefined;
  if (hasGift === hasCustom) throw ApiError.badRequest("Send exactly one of gift_id or custom_coins");

  if (hasGift) {
    const gift = await prisma.giftItem.findUnique({
      where: { gift_id: input.gift_id },
      select: { ...giftSelect, price_coins: true, is_active: true, available_from: true, available_to: true },
    });
    if (!gift || !giftIsAvailable(gift)) throw ApiError.unprocessable("This gift is not available");

    const quantity = input.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw ApiError.badRequest("quantity must be between 1 and 99");
    }
    const gross = gift.price_coins * quantity;
    const { fee, net } = splitGiftFee(gross, env.GIFT_PLATFORM_FEE_PERCENT);
    return { gift, quantity, unit_price: gift.price_coins, gross, fee, net };
  }

  // Custom coins — ไม่หักค่าธรรมเนียม (คงพฤติกรรมโดเนท coin เดิม) และจำนวนชิ้นเป็น 1 เสมอ
  const gross = input.custom_coins!;
  if (!(gross > 0)) throw ApiError.badRequest("custom_coins must be positive");
  return { gift: null, quantity: 1, unit_price: null, gross, fee: 0, net: gross };
}

function sameRequest(
  existing: { to_user_id: string; gift_id: string | null; quantity: number; amount: Prisma.Decimal },
  author_id: string,
  gift_id: string | null,
  quantity: number,
  gross: number
) {
  return (
    existing.to_user_id === author_id &&
    existing.gift_id === gift_id &&
    existing.quantity === quantity &&
    existing.amount.toNumber() === gross
  );
}

/**
 * POST /gifts/send (และ POST /donations เดิม) — ทำทุกอย่างใน transaction เดียว:
 * ล็อกกระเป๋าทั้งสองฝั่ง → เช็ค idempotency_key → เช็คยอด → สร้าง donation → ledger ผู้ให้ (เต็ม) +
 * ผู้รับ (หักค่าธรรมเนียม) → แจ้งเตือน
 *
 * ส่งซ้ำด้วย idempotency_key เดิม (ดับเบิลคลิก/เน็ตหลุดแล้ว retry) ได้ผลลัพธ์เดิม ไม่หักเงินซ้ำ —
 * เช็คหลังได้ lock แล้ว จึงเห็นรายการที่อีก request เพิ่ง commit ไปเสมอ และมี unique
 * (from_user_id, idempotency_key) เป็นชั้นสุดท้าย
 */
export async function sendGift(from_user_id: string, input: SendGiftInput): Promise<SendGiftResult> {
  const { author, novel_id, chapter_id } = await resolveTarget(from_user_id, input);
  const price = await resolvePrice(input);

  if (price.gross > env.GIFT_MAX_COINS_PER_SEND) {
    throw ApiError.unprocessable(`ส่งได้สูงสุด ${env.GIFT_MAX_COINS_PER_SEND} คอยน์ต่อครั้ง`);
  }

  const card = input.card ?? {};
  const message = sanitizeOrThrow(card.message, input.message_max ?? CARD_MESSAGE_MAX, "message");
  const signature_name = sanitizeOrThrow(card.signature_name, SIGNATURE_MAX, "signature_name");
  const is_anonymous = card.is_anonymous ?? false;
  const is_public = card.is_public ?? false;
  const gift_id = price.gift?.gift_id ?? null;

  const run = () =>
    prisma.$transaction(async (tx) => {
      await lockWallets(tx, [from_user_id, author.user_id]);

      if (input.idempotency_key) {
        const existing = await tx.donation.findUnique({
          where: { from_user_id_idempotency_key: { from_user_id, idempotency_key: input.idempotency_key } },
          select: donationListSelect,
        });
        if (existing) {
          if (!sameRequest(existing, author.user_id, gift_id, price.quantity, price.gross)) {
            throw ApiError.conflict("idempotency_key was already used for a different gift");
          }
          return { donation: existing, balance_after: await getBalance(from_user_id, tx), replayed: true };
        }
      }

      const senderBalance = await getBalance(from_user_id, tx);
      if (senderBalance < price.gross) {
        throw ApiError.unprocessable("Insufficient coin balance", {
          balance: senderBalance,
          required: price.gross,
          missing: price.gross - senderBalance,
        });
      }

      const donation = await tx.donation.create({
        data: {
          from_user_id,
          to_user_id: author.user_id,
          novel_id,
          chapter_id,
          gift_id,
          quantity: price.quantity,
          unit_price_coins: price.unit_price,
          amount: price.gross,
          fee_amount: price.fee,
          net_amount: price.net,
          message,
          card_template: card.template ?? null,
          signature_name,
          is_anonymous,
          is_public,
          idempotency_key: input.idempotency_key,
        },
        select: donationListSelect,
      });

      const balance_after = senderBalance - price.gross;
      await tx.walletTransaction.create({
        data: {
          user_id: from_user_id,
          type: "donation_sent",
          amount: price.gross,
          balance_after,
          reference_id: donation.donation_id,
          created_at: ledgerTimestamp(),
        },
      });

      const receiverBalance = await getBalance(author.user_id, tx);
      await tx.walletTransaction.create({
        data: {
          user_id: author.user_id,
          type: "donation_received",
          amount: price.net,
          balance_after: receiverBalance + price.net,
          reference_id: donation.donation_id,
          created_at: ledgerTimestamp(),
        },
      });

      const sender = is_anonymous
        ? null
        : await tx.user.findUnique({ where: { user_id: from_user_id }, select: { username: true, pen_name: true } });
      const senderName = sender ? displayName(sender) : ANONYMOUS_NAME;
      const withCard = message ? " พร้อมการ์ด" : "";
      const content = price.gift
        ? `${senderName} ส่ง${price.gift.name_th} x${price.quantity} ให้คุณ${withCard}`
        : `${senderName} ส่ง ${price.gross} คอยน์ให้คุณ${withCard}`;

      await tx.notification.create({
        data: {
          user_id: author.user_id,
          type: "donation",
          content,
          // เปิดกล่องจดหมายนักเขียนแล้วแกะซองนี้ให้ทันที (ดู apps/web/src/app/write/gifts)
          link_url: inboxLink(donation.donation_id),
        },
      });

      return { donation, balance_after, replayed: false };
    }, WALLET_TX_OPTIONS);

  let result: { donation: DonationListRow; balance_after: number; replayed: boolean };
  try {
    result = await run();
  } catch (err) {
    // สอง request key เดียวกันหลุดมาพร้อมกันจริง ๆ — อีกตัว commit ไปแล้ว รอบนี้จะเจอแถวนั้นหลัง lock
    if (input.idempotency_key && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      result = await run();
    } else {
      throw err;
    }
  }

  return { donation: toSentItem(result.donation), balance_after: result.balance_after, replayed: result.replayed };
}

// ---------------------------------------------------------------------------
// Serializers — แยกตามผู้ดู เพื่อไม่ให้ข้อความส่วนตัว/ตัวตนผู้ส่งนิรนามรั่วผ่าน API สาธารณะ
// ---------------------------------------------------------------------------

function baseItem(row: DonationListRow) {
  return {
    donation_id: row.donation_id,
    gift: row.gift,
    quantity: row.quantity,
    unit_price_coins: row.unit_price_coins,
    amount: row.amount.toNumber(),
    card_template: row.card_template,
    is_anonymous: row.is_anonymous,
    is_public: row.is_public,
    novel: row.novel,
    chapter: row.chapter,
    thank_message: row.thank_message,
    thanked_at: row.thanked_at,
    created_at: row.created_at,
  };
}

/** มุมมองผู้รับ (นักเขียน) — เห็นข้อความทุกแบบรวม private แต่ไม่เห็นตัวตนผู้ส่งที่เลือกนิรนาม */
export function toInboxItem(row: DonationListRow) {
  return {
    ...baseItem(row),
    net_amount: row.net_amount.toNumber(),
    fee_amount: row.fee_amount.toNumber(),
    message: row.message,
    signature_name: row.signature_name,
    sender: row.is_anonymous ? null : row.from_user,
    read_at: row.read_at,
    hidden_at: row.hidden_at,
    reported_at: row.reported_at,
  };
}

/** มุมมองผู้ส่ง — ของตัวเองทั้งหมด */
export function toSentItem(row: DonationListRow) {
  return {
    ...baseItem(row),
    message: row.message,
    signature_name: row.signature_name,
    recipient: row.to_user,
  };
}

/** มุมมองสาธารณะ — ใช้กับแถวที่ is_public เท่านั้น (ดู listPublicGifts) */
function toPublicCard(row: DonationListRow) {
  return {
    donation_id: row.donation_id,
    gift: row.gift,
    quantity: row.quantity,
    card_template: row.card_template,
    message: row.message,
    signature_name: row.is_anonymous ? null : row.signature_name,
    sender: row.is_anonymous ? null : row.from_user,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

async function paginate(where: Prisma.DonationWhereInput, cursor: string | undefined, limit = PAGE_SIZE) {
  const rows = await prisma.donation.findMany({
    where,
    orderBy: [{ created_at: "desc" }, { donation_id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { donation_id: cursor }, skip: 1 } : {}),
    select: donationListSelect,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, next_cursor: hasMore ? page[page.length - 1].donation_id : null };
}

export interface ReceivedFilter {
  cursor?: string;
  novel_id?: string;
  gift_id?: string;
  /** "hidden" = เฉพาะที่ซ่อน, "unread" = ยังไม่อ่าน, ไม่ส่ง = ที่ไม่ได้ซ่อนทั้งหมด */
  status?: "hidden" | "unread";
}

/** GET /me/gifts/received — กล่องจดหมายของนักเขียน (รวมข้อความ private) */
export async function listReceived(user_id: string, filter: ReceivedFilter) {
  const where: Prisma.DonationWhereInput = {
    to_user_id: user_id,
    novel_id: filter.novel_id,
    gift_id: filter.gift_id,
    hidden_at: filter.status === "hidden" ? { not: null } : null,
    ...(filter.status === "unread" ? { read_at: null } : {}),
  };
  const [{ rows, next_cursor }, unread_count] = await Promise.all([
    paginate(where, filter.cursor),
    prisma.donation.count({ where: { to_user_id: user_id, read_at: null, hidden_at: null } }),
  ]);
  return { items: rows.map(toInboxItem), next_cursor, unread_count };
}

/** ลิงก์ในแจ้งเตือนของผู้รับ — หน้า /write/gifts เปิดซองตาม ?open= ให้เอง */
export function inboxLink(donation_id: string) {
  return `/write/gifts?open=${donation_id}`;
}

/** ต้นเดือนปัจจุบันตามเวลาไทย (UTC+7 ไม่มี DST) เป็น Date แบบ UTC — "เดือนนี้" ของสถิติต้องตรงกับ
 *  ปฏิทินที่นักเขียนเห็น ไม่ใช่ปฏิทิน UTC ของเซิร์ฟเวอร์ (ช่วง 00:00-07:00 ของวันที่ 1 จะนับผิดเดือน) */
export function startOfThaiMonth(now = new Date()): Date {
  const bangkok = new Date(now.getTime() + 7 * 3600 * 1000);
  return new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), 1) - 7 * 3600 * 1000);
}

/** GET /me/gifts/stats — สถิติของขวัญที่นักเขียนได้รับ (ไม่นับรายการที่ซ่อน)
 *  coins = ยอดสุทธิที่เข้ากระเป๋าจริง (หลังหักค่าธรรมเนียม) ผู้สนับสนุนนิรนามไม่ติดอันดับ */
export async function getReceivedStats(user_id: string) {
  const base: Prisma.DonationWhereInput = { to_user_id: user_id, hidden_at: null };
  const month: Prisma.DonationWhereInput = { ...base, created_at: { gte: startOfThaiMonth() } };

  const [monthAgg, monthGifts, monthSupporters, allAgg, allGifts, giftGroups, supporterGroups, novelGroups, unread_count] =
    await Promise.all([
      prisma.donation.aggregate({ where: month, _sum: { net_amount: true }, _count: { _all: true } }),
      prisma.donation.aggregate({ where: { ...month, gift_id: { not: null } }, _sum: { quantity: true } }),
      prisma.donation.groupBy({ by: ["from_user_id"], where: month }),
      prisma.donation.aggregate({ where: base, _sum: { net_amount: true }, _count: { _all: true } }),
      prisma.donation.aggregate({ where: { ...base, gift_id: { not: null } }, _sum: { quantity: true } }),
      prisma.donation.groupBy({
        by: ["gift_id"],
        where: { ...base, gift_id: { not: null } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.donation.groupBy({
        by: ["from_user_id"],
        where: { ...base, is_anonymous: false },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 5,
      }),
      prisma.donation.groupBy({
        by: ["novel_id"],
        where: { to_user_id: user_id, novel_id: { not: null } },
        _count: { _all: true },
      }),
      prisma.donation.count({ where: { ...base, read_at: null } }),
    ]);

  const [gifts, users, novels] = await Promise.all([
    prisma.giftItem.findMany({ where: { gift_id: { in: giftGroups.map((g) => g.gift_id!) } }, select: giftSelect }),
    prisma.user.findMany({ where: { user_id: { in: supporterGroups.map((g) => g.from_user_id) } }, select: userSelect }),
    prisma.novel.findMany({
      where: { novel_id: { in: novelGroups.map((g) => g.novel_id!) } },
      select: { novel_id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  const giftMap = new Map(gifts.map((g) => [g.gift_id, g]));
  const userMap = new Map(users.map((u) => [u.user_id, u]));
  const novelCount = new Map(novelGroups.map((g) => [g.novel_id, g._count._all]));

  return {
    this_month: {
      gifts: monthGifts._sum.quantity ?? 0,
      sends: monthAgg._count._all,
      coins_earned: monthAgg._sum.net_amount?.toNumber() ?? 0,
      supporters: monthSupporters.length,
    },
    all_time: {
      gifts: allGifts._sum.quantity ?? 0,
      sends: allAgg._count._all,
      coins_earned: allAgg._sum.net_amount?.toNumber() ?? 0,
    },
    unread_count,
    top_gifts: giftGroups
      .map((g) => ({ gift: giftMap.get(g.gift_id!), count: g._sum.quantity ?? 0 }))
      .filter((g) => g.gift),
    top_supporters: supporterGroups
      .map((g) => ({ user: userMap.get(g.from_user_id), total_coins: g._sum.amount?.toNumber() ?? 0 }))
      .filter((s) => s.user),
    novels: novels.map((n) => ({ ...n, count: novelCount.get(n.novel_id) ?? 0 })),
  };
}

/** GET /users/:user_id/supporter-badges (Public) — ป้ายที่ผู้ใช้คนนี้ได้ตามเกณฑ์ใน config/supporterBadges.ts
 *  นับเฉพาะรายการที่ระบุตัวตนและไม่ถูกซ่อน (ดูเหตุผลในไฟล์ config) */
export async function getSupporterBadges(user_id: string) {
  const user = await prisma.user.findUnique({ where: { user_id }, select: { user_id: true } });
  if (!user) throw ApiError.notFound("User not found");

  const where: Prisma.DonationWhereInput = { from_user_id: user_id, is_anonymous: false, hidden_at: null };
  const [byGift, total] = await Promise.all([
    prisma.donation.groupBy({ by: ["gift_id"], where: { ...where, gift_id: { not: null } }, _sum: { quantity: true } }),
    prisma.donation.aggregate({ where, _sum: { amount: true } }),
  ]);
  const gifts = await prisma.giftItem.findMany({
    where: { gift_id: { in: byGift.map((g) => g.gift_id!) } },
    select: { gift_id: true, slug: true },
  });
  const slugById = new Map(gifts.map((g) => [g.gift_id, g.slug]));
  const quantityBySlug = new Map<string, number>();
  for (const g of byGift) {
    const slug = slugById.get(g.gift_id!);
    if (slug) quantityBySlug.set(slug, (quantityBySlug.get(slug) ?? 0) + (g._sum.quantity ?? 0));
  }
  const totalCoins = total._sum.amount?.toNumber() ?? 0;

  const badges = SUPPORTER_BADGES.filter((rule) => {
    const byQuantity =
      rule.gift_slugs && rule.min_quantity !== undefined
        ? rule.gift_slugs.reduce((sum, slug) => sum + (quantityBySlug.get(slug) ?? 0), 0) >= rule.min_quantity
        : false;
    const byCoins = rule.min_total_coins !== undefined ? totalCoins >= rule.min_total_coins : false;
    return byQuantity || byCoins;
  }).map(({ id, label, description_th, image_slug }) => ({ id, label, description_th, image_slug: image_slug ?? null }));

  return { badges };
}

/** GET /me/gifts/sent */
export async function listSent(user_id: string, cursor?: string) {
  const { rows, next_cursor } = await paginate({ from_user_id: user_id }, cursor);
  return { items: rows.map(toSentItem), next_cursor };
}

/** GET /authors/:user_id/gifts/public (Public) — "กำลังใจจากนักอ่าน"
 *  - gift_counts: นับของขวัญทุกชิ้นที่ไม่ถูกซ่อน (เป็นยอดรวม ไม่เปิดเผยข้อความ/ผู้ส่ง)
 *  - top_supporters: ไม่นับรายการนิรนามเลย (ไม่งั้นเดาตัวตนได้จากยอดรวม)
 *  - recent_cards: เฉพาะ is_public ที่ไม่ถูกซ่อน/ไม่ค้างรายงาน ข้อความ private ไม่มีทางออกมาทางนี้ */
export async function listPublicGifts(author_id: string, options: { novel_id?: string; viewer_id?: string }) {
  const author = await prisma.user.findUnique({ where: { user_id: author_id }, select: { user_id: true } });
  if (!author) throw ApiError.notFound("Author not found");

  if (options.novel_id) {
    const novel = await prisma.novel.findUnique({
      where: { novel_id: options.novel_id },
      select: { author_id: true, visibility: true },
    });
    if (!novel || novel.author_id !== author_id) throw ApiError.notFound("Novel not found");
    assertNovelVisible(novel, options.viewer_id);
  }

  const base: Prisma.DonationWhereInput = { to_user_id: author_id, hidden_at: null, novel_id: options.novel_id };

  const [giftGroups, supporterGroups, cards, total_gifts] = await Promise.all([
    prisma.donation.groupBy({
      by: ["gift_id"],
      where: { ...base, gift_id: { not: null } },
      _sum: { quantity: true },
    }),
    prisma.donation.groupBy({
      by: ["from_user_id"],
      where: { ...base, is_anonymous: false },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.donation.findMany({
      where: {
        ...base,
        is_public: true,
        message: { not: null },
        OR: [{ reported_at: null }, { report_resolved_at: { not: null } }],
      },
      orderBy: { created_at: "desc" },
      take: 6,
      select: donationListSelect,
    }),
    prisma.donation.aggregate({ where: { ...base, gift_id: { not: null } }, _sum: { quantity: true } }),
  ]);

  const [gifts, users] = await Promise.all([
    prisma.giftItem.findMany({
      where: { gift_id: { in: giftGroups.map((g) => g.gift_id!) } },
      select: { ...giftSelect, sort_order: true },
    }),
    prisma.user.findMany({ where: { user_id: { in: supporterGroups.map((g) => g.from_user_id) } }, select: userSelect }),
  ]);
  const giftCount = new Map(giftGroups.map((g) => [g.gift_id, g._sum.quantity ?? 0]));
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  return {
    total_gifts: total_gifts._sum.quantity ?? 0,
    gift_counts: gifts
      .map(({ sort_order, ...gift }) => ({ gift, count: giftCount.get(gift.gift_id) ?? 0, sort_order }))
      .sort((a, b) => b.count - a.count || a.sort_order - b.sort_order)
      .map(({ gift, count }) => ({ gift, count })),
    top_supporters: supporterGroups
      .map((g) => ({ user: userMap.get(g.from_user_id), total_coins: g._sum.amount?.toNumber() ?? 0 }))
      .filter((s) => s.user),
    recent_cards: cards.map(toPublicCard),
  };
}

// ---------------------------------------------------------------------------
// Author actions
// ---------------------------------------------------------------------------

async function findOwnReceived(user_id: string, donation_id: string) {
  const row = await prisma.donation.findUnique({
    where: { donation_id },
    select: { donation_id: true, to_user_id: true, from_user_id: true, thanked_at: true, reported_at: true, novel_id: true },
  });
  // ตอบ 404 แทน 403 เพื่อไม่ยืนยันว่ามีรายการนี้อยู่ (pattern เดียวกับ assertNovelVisible)
  if (!row || row.to_user_id !== user_id) throw ApiError.notFound("Gift not found");
  return row;
}

/** POST /me/gifts/:donation_id/thank — ตอบขอบคุณได้ครั้งเดียว แจ้งเตือนกลับไปหาผู้ส่ง */
export async function thankGift(user_id: string, donation_id: string, rawMessage: string) {
  const row = await findOwnReceived(user_id, donation_id);
  if (row.thanked_at) throw ApiError.conflict("You have already thanked this gift");

  const thank_message = sanitizeOrThrow(rawMessage, THANK_MESSAGE_MAX, "message");
  if (!thank_message) throw ApiError.badRequest("message is required");

  const author = await prisma.user.findUnique({ where: { user_id }, select: { username: true, pen_name: true } });

  const [updated] = await prisma.$transaction([
    prisma.donation.update({
      where: { donation_id },
      data: { thank_message, thanked_at: new Date(), read_at: new Date() },
      select: donationListSelect,
    }),
    prisma.notification.create({
      data: {
        user_id: row.from_user_id,
        type: "donation",
        content: `${author ? displayName(author) : "นักเขียน"} ตอบขอบคุณของขวัญของคุณ: ${thank_message}`,
        link_url: row.novel_id ? `/novels/${row.novel_id}` : null,
      },
    }),
  ]);
  return toInboxItem(updated);
}

export interface UpdateReceivedInput {
  read?: boolean;
  hidden?: boolean;
  report_reason?: string;
}

/** PATCH /me/gifts/:donation_id — นักเขียนทำเครื่องหมายอ่านแล้ว / ซ่อน / รายงานข้อความ */
export async function updateReceived(user_id: string, donation_id: string, input: UpdateReceivedInput) {
  const row = await findOwnReceived(user_id, donation_id);
  const data: Prisma.DonationUpdateInput = {};

  if (input.read !== undefined) data.read_at = input.read ? new Date() : null;
  if (input.hidden !== undefined) data.hidden_at = input.hidden ? new Date() : null;
  if (input.report_reason !== undefined) {
    if (row.reported_at) throw ApiError.conflict("This gift has already been reported");
    data.report_reason = sanitizeOrThrow(input.report_reason, REPORT_REASON_MAX, "report_reason") ?? "ไม่ระบุเหตุผล";
    data.reported_at = new Date();
    data.report_resolved_at = null;
  }

  const updated = await prisma.donation.update({ where: { donation_id }, data, select: donationListSelect });
  return toInboxItem(updated);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** GET /admin/gifts — ทุกชิ้นรวมที่ปิดขาย */
export function adminListGifts() {
  return prisma.giftItem.findMany({ orderBy: [{ sort_order: "asc" }, { price_coins: "asc" }] });
}

export type GiftItemInput = Omit<Prisma.GiftItemUncheckedCreateInput, "gift_id" | "created_at" | "updated_at">;

export function adminCreateGift(input: GiftItemInput) {
  return prisma.giftItem.create({ data: input });
}

export async function adminUpdateGift(gift_id: string, input: Partial<GiftItemInput>) {
  const exists = await prisma.giftItem.findUnique({ where: { gift_id }, select: { gift_id: true } });
  if (!exists) throw ApiError.notFound("Gift not found");
  return prisma.giftItem.update({ where: { gift_id }, data: { ...input, updated_at: new Date() } });
}

/** DELETE /admin/gifts/:gift_id — ถ้ามีคนเคยส่งชิ้นนี้แล้วลบไม่ได้ (ประวัติต้องอยู่) ปิดขายแทน */
export async function adminDeleteGift(gift_id: string) {
  const gift = await prisma.giftItem.findUnique({
    where: { gift_id },
    select: { gift_id: true, _count: { select: { donations: true } } },
  });
  if (!gift) throw ApiError.notFound("Gift not found");
  if (gift._count.donations > 0) {
    await prisma.giftItem.update({ where: { gift_id }, data: { is_active: false, updated_at: new Date() } });
    return { deleted: false, deactivated: true };
  }
  await prisma.giftItem.delete({ where: { gift_id } });
  return { deleted: true, deactivated: false };
}

/** GET /admin/gift-reports — การ์ดที่ถูกรายงานและยังไม่ได้ตัดสิน (แอดมินเห็นข้อความเต็ม + ผู้ส่งจริง) */
export async function adminListReports(cursor?: string) {
  const { rows, next_cursor } = await paginate({ reported_at: { not: null }, report_resolved_at: null }, cursor);
  return {
    items: rows.map((row) => ({
      ...toSentItem(row),
      sender: row.from_user,
      reported_at: row.reported_at,
      report_reason: row.report_reason,
      hidden_at: row.hidden_at,
    })),
    next_cursor,
  };
}

/** PATCH /admin/gift-reports/:donation_id — dismiss = ข้อความไม่ผิด, hide = ซ่อนจากทุกที่ */
export async function adminResolveReport(donation_id: string, action: "dismiss" | "hide") {
  const row = await prisma.donation.findUnique({ where: { donation_id }, select: { reported_at: true } });
  if (!row || !row.reported_at) throw ApiError.notFound("Report not found");
  const now = new Date();
  await prisma.donation.update({
    where: { donation_id },
    data: { report_resolved_at: now, ...(action === "hide" ? { hidden_at: now } : {}) },
  });
  return { donation_id, action };
}
