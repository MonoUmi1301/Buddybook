/**
 * เพิ่มภายหลัง (Gift donations) — เช็คว่ารูปของขวัญทุกชิ้นมีไฟล์จริงใน apps/web/public
 *   npm run check:gift-assets --workspace=apps/api
 * ตรวจทั้งแคตตาล็อกตั้งต้น (prisma/gift-catalog.ts) และแถวใน gift_items (ที่แอดมินอาจเพิ่ม/แก้ image_url)
 * ถ้าต่อฐานข้อมูลไม่ได้ ตรวจแค่แคตตาล็อกตั้งต้นแล้วเตือน ใช้ร่วมกับ test/gift-assets.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { RETIRED_GIFT_SLUGS, giftCatalog, giftImageUrl } from "../prisma/gift-catalog";

export const WEB_PUBLIC_DIR = path.resolve(__dirname, "../../web/public");
export const MASCOT_IMAGE_URL = "/donate/mascot/mascot-bear.png";

export function publicFileExists(url: string): boolean {
  if (!url.startsWith("/") || url.includes("..")) return false;
  return fs.existsSync(path.join(WEB_PUBLIC_DIR, url));
}

export interface MissingAsset {
  source: "catalog" | "database" | "mascot";
  slug: string;
  image_url: string;
}

export function findMissingCatalogAssets(): MissingAsset[] {
  const missing: MissingAsset[] = giftCatalog
    .map((g) => ({ source: "catalog" as const, slug: g.slug, image_url: giftImageUrl(g.slug) }))
    .filter((a) => !publicFileExists(a.image_url));
  if (!publicFileExists(MASCOT_IMAGE_URL)) missing.push({ source: "mascot", slug: "mascot-bear", image_url: MASCOT_IMAGE_URL });
  return missing;
}

export async function findMissingDatabaseAssets(prisma: PrismaClient): Promise<MissingAsset[]> {
  const rows = await prisma.giftItem.findMany({ select: { slug: true, image_url: true } });
  return rows
    // slug ที่ถอดออกแล้วแต่มีประวัติการส่ง (ลบแถวไม่ได้) ไม่มีรูปโดยตั้งใจ — หน้าเว็บแสดงมาสคอตแทน
    .filter((r) => !RETIRED_GIFT_SLUGS.includes(r.slug))
    .filter((r) => !publicFileExists(r.image_url))
    .map((r) => ({ source: "database" as const, slug: r.slug, image_url: r.image_url }));
}

async function main() {
  const missing = findMissingCatalogAssets();

  const prisma = new PrismaClient();
  try {
    missing.push(...(await findMissingDatabaseAssets(prisma)));
  } catch (err) {
    console.warn(`ข้ามการตรวจ gift_items ในฐานข้อมูล (เชื่อมต่อไม่ได้): ${(err as Error).message.split("\n")[0]}`);
  } finally {
    await prisma.$disconnect();
  }

  if (missing.length === 0) {
    console.log(`OK: รูปของขวัญครบทุกชิ้น (${giftCatalog.length} ชิ้นในแคตตาล็อก + mascot)`);
    return;
  }
  console.error("ไม่พบไฟล์รูปต่อไปนี้ใน apps/web/public:");
  for (const m of missing) console.error(`  [${m.source}] ${m.slug} -> ${m.image_url}`);
  process.exit(1);
}

if (require.main === module) {
  void main();
}
