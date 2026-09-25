import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { findMissingCatalogAssets, findMissingDatabaseAssets } from "../scripts/check-gift-assets";
import { RETIRED_GIFT_SLUGS, giftCatalog } from "../prisma/gift-catalog";

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

describe("gift assets", () => {
  it("every seeded gift slug has a PNG in apps/web/public/donate/gifts", () => {
    expect(findMissingCatalogAssets()).toEqual([]);
  });

  it("every gift_items.image_url in the database points to an existing file", async () => {
    expect(await findMissingDatabaseAssets(prisma)).toEqual([]);
  });

  it("catalog has the 10 gifts that have images, with unique slugs and positive prices", () => {
    const slugs = giftCatalog.map((g) => g.slug);
    expect(slugs).toHaveLength(10);
    expect(slugs.filter((s) => RETIRED_GIFT_SLUGS.includes(s))).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(giftCatalog.every((g) => Number.isInteger(g.price_coins) && g.price_coins > 0)).toBe(true);
  });
});
