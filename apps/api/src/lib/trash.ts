import type { Prisma, TrashContentType } from "@prisma/client";

/**
 * ทำให้ object พร้อมเก็บใน column JSONB (แปลง Date -> ISO string ผ่าน JSON.stringify)
 * ใช้ก่อนส่งเข้า content_snapshot เสมอ — ห้ามส่ง object ที่มี Date/BigInt ดิบ ๆ เข้า Prisma Json field
 */
export function toJsonSnapshot<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

interface MoveToTrashInput {
  novel_id: string;
  content_type: TrashContentType;
  content_ref_id: string;
  content_snapshot: unknown;
  deleted_by: string;
}

/**
 * บันทึก snapshot ลง trash_bin (auto_delete_at = deleted_at + 30 วัน ตาม schema default)
 * ใช้ร่วมกับการลบ record ต้นทางจริงใน transaction เดียวกันเสมอ — ดู pattern ใน
 * chapters.service.ts / characters.service.ts / locations.service.ts / timeline.service.ts
 */
export async function moveToTrash(tx: Prisma.TransactionClient, input: MoveToTrashInput) {
  return tx.trashBin.create({
    data: {
      novel_id: input.novel_id,
      content_type: input.content_type,
      content_ref_id: input.content_ref_id,
      content_snapshot: toJsonSnapshot(input.content_snapshot),
      deleted_by: input.deleted_by,
    },
    select: { trash_id: true, content_type: true, auto_delete_at: true },
  });
}
