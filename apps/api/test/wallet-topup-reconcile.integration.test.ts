import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBalance, fulfillStripeTopup } from "@/modules/wallet/wallet.service";
import { createHarness } from "./helpers";

/** Stripe ปลอม — retrieve คืน session ตามที่เทสต์ตั้งไว้ใน sessions */
const sessions = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    checkout: {
      sessions: {
        retrieve: async (id: string) => {
          const s = sessions.get(id);
          if (!s) throw new Error(`no such session ${id}`);
          return s;
        },
      },
    },
  }),
}));

const h = createHarness("topup");
let user: { id: string; token: string };

async function createOrder(sessionState: { status: string; payment_status: string }) {
  const order_id = crypto.randomUUID();
  const stripe_session_id = `cs_test_${crypto.randomBytes(8).toString("hex")}`;
  await prisma.topupOrder.create({
    data: {
      order_id,
      user_id: user.id,
      stripe_session_id,
      package_id: "p25",
      coins: 25,
      amount_thb: 25,
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const session = {
    id: stripe_session_id,
    amount_total: 2500,
    metadata: { user_id: user.id, package_id: "p25", order_id },
    ...sessionState,
  };
  sessions.set(stripe_session_id, session);
  return { order_id, session };
}

beforeAll(async () => {
  await h.start();
});

beforeEach(async () => {
  user = await h.createUser("buyer");
});

afterAll(async () => {
  await prisma.topupOrder.deleteMany({ where: { user_id: { in: h.userIds } } });
  await h.stop();
});

describe("top-up status reconciles with Stripe when the webhook never arrives", () => {
  it("credits a paid session exactly once even with concurrent polls and a late webhook", async () => {
    const { order_id, session } = await createOrder({ status: "complete", payment_status: "paid" });

    const polls = await Promise.all(
      Array.from({ length: 3 }, () => h.api("GET", `/wallet/topup/orders/${order_id}/status`, user.token))
    );
    // webhook มาถึงทีหลัง — ต้องไม่เติมซ้ำ
    await fulfillStripeTopup(session as never);

    expect(polls.some((p) => p.json?.status === "PAID")).toBe(true);
    expect(await getBalance(user.id)).toBe(25);
    expect(await prisma.walletTransaction.count({ where: { user_id: user.id, type: "topup" } })).toBe(1);
    const order = await prisma.topupOrder.findUnique({ where: { order_id } });
    expect(order?.status).toBe("paid");
  });

  it("keeps an open session pending and does not credit", async () => {
    const { order_id } = await createOrder({ status: "open", payment_status: "unpaid" });
    const res = await h.api("GET", `/wallet/topup/orders/${order_id}/status`, user.token);
    expect(res.json.status).toBe("PENDING");
    expect(await getBalance(user.id)).toBe(0);
  });

  it("marks an expired session failed", async () => {
    const { order_id } = await createOrder({ status: "expired", payment_status: "unpaid" });
    const res = await h.api("GET", `/wallet/topup/orders/${order_id}/status`, user.token);
    expect(res.json.status).toBe("FAILED");
    expect((await prisma.topupOrder.findUnique({ where: { order_id } }))?.status).toBe("failed");
  });

  it("does not let another user read or reconcile someone else's order", async () => {
    const { order_id } = await createOrder({ status: "complete", payment_status: "paid" });
    const other = await h.createUser("other");
    const res = await h.api("GET", `/wallet/topup/orders/${order_id}/status`, other.token);
    expect(res.status).toBe(404);
    expect(await getBalance(user.id)).toBe(0);
  });
});
