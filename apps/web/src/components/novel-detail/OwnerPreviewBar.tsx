import Link from "next/link";
import { Eye, Pencil, Settings2 } from "lucide-react";

interface OwnerPreviewBarProps {
  novelId: string;
  /** แจ้งเตือนเพิ่ม เช่น "นิยายยังไม่เผยแพร่" / "ตอนนี้เป็นฉบับร่าง" */
  notice?: string | null;
  /** หน้าอ่านตอน — ลิงก์ไปแก้ไขตอนนี้ได้ทันที */
  editChapterId?: string;
}

/** แถบ "โหมดทดลองอ่าน" — ขึ้นเฉพาะตอนเจ้าของนิยายเปิดหน้านิยาย/หน้าอ่านของตัวเอง
 *  (เจ้าของอ่านตอนที่ยังไม่เผยแพร่ได้ และยอดวิวไม่ถูกนับ — backend เช็ก isOwner อยู่แล้ว) */
export function OwnerPreviewBar({ novelId, notice, editChapterId }: OwnerPreviewBarProps) {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-2 text-sm text-amber-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0">
            <span className="font-semibold">โหมดทดลองอ่าน</span>
            <span className="text-amber-800"> — หน้านี้คือสิ่งที่ผู้อ่านเห็น การเปิดอ่านของคุณไม่นับยอดวิว</span>
            {notice && <span className="mt-0.5 block font-medium text-amber-700">{notice}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editChapterId && (
            <Link
              href={`/write/${novelId}/chapters/${editChapterId}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              <Pencil className="h-3.5 w-3.5" /> แก้ไขตอนนี้
            </Link>
          )}
          <Link
            href={`/write/${novelId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-amber-500 px-3 text-xs font-semibold text-white hover:bg-amber-600"
          >
            <Settings2 className="h-3.5 w-3.5" /> กลับไปหน้าจัดการ
          </Link>
        </div>
      </div>
    </div>
  );
}
