"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatApiError } from "@/lib/formatApiError";

export interface TrashedNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  chapter_count: number;
  deleted_at: string;
  auto_delete_at: string;
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/**
 * gap 2.4 — Userflow "หน้านิยายที่ถูกลบ": แสดงนิยายในถังขยะ → กู้คืน หรือ ลบถาวร (ยืนยันอีกครั้ง
 * พร้อมคำเตือนว่ากู้คืนไม่ได้) ครบ 30 วันระบบลบให้อัตโนมัติ
 */
export function NovelTrashList({ novels, retentionDays }: { novels: TrashedNovel[]; retentionDays: number }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingPermanent, setPendingPermanent] = useState<TrashedNovel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function act(novel: TrashedNovel, kind: "restore" | "permanent") {
    setBusyId(novel.novel_id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        kind === "restore" ? `/api/v1/novels/${novel.novel_id}/restore` : `/api/v1/novels/${novel.novel_id}/permanent`,
        { method: kind === "restore" ? "POST" : "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(formatApiError(json, kind === "restore" ? "กู้คืนนิยายไม่สำเร็จ" : "ลบนิยายถาวรไม่สำเร็จ"));
        return;
      }
      setNotice(kind === "restore" ? `กู้คืน "${novel.title}" แล้ว กลับไปอยู่ในผลงานของฉัน` : `ลบ "${novel.title}" ถาวรแล้ว`);
      setPendingPermanent(null);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-neutral-500">
        นิยายที่ลบจะอยู่ที่นี่ {retentionDays} วัน กู้คืนได้ทุกเมื่อก่อนครบกำหนด หลังจากนั้นระบบจะลบถาวรอัตโนมัติ
      </p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

      {novels.length === 0 ? (
        <div className="rounded-card border border-dashed border-neutral-300 px-6 py-16 text-center text-sm text-neutral-400">
          ถังขยะว่างเปล่า
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-card border border-neutral-200">
          {novels.map((n) => {
            const left = daysLeft(n.auto_delete_at);
            return (
              <li key={n.novel_id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {n.cover_image_url ? (
                    <Image src={n.cover_image_url} alt={n.title} fill sizes="56px" className="object-cover opacity-70" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-neutral-300">ไม่มีปก</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-1 text-sm font-semibold text-neutral-900">{n.title}</h2>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {n.chapter_count} ตอน · ลบเมื่อ {new Date(n.deleted_at).toLocaleDateString("th-TH")}
                  </p>
                  <p className={left <= 3 ? "mt-0.5 text-xs font-medium text-red-500" : "mt-0.5 text-xs text-neutral-400"}>
                    จะถูกลบถาวรในอีก {left} วัน
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act(n, "restore")}
                    loading={busyId === n.novel_id && !pendingPermanent}
                    className="flex-1 sm:flex-none"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> กู้คืน
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingPermanent(n)}
                    className="flex-1 !border-red-200 !text-red-600 hover:!bg-red-50 sm:flex-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ลบถาวร
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingPermanent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl">
            <h2 className="text-h3 text-neutral-900">ลบนิยายถาวร?</h2>
            <p className="mt-2 text-sm text-neutral-500">
              &quot;{pendingPermanent.title}&quot; และทุกตอน ประวัติเวอร์ชัน และข้อมูลพล็อตทั้งหมดจะถูกลบ
              <strong className="block text-red-600">หากลบจะไม่สามารถกู้คืนได้อีกครั้ง</strong>
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setPendingPermanent(null)}>
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="!bg-red-500 hover:!bg-red-600"
                onClick={() => act(pendingPermanent, "permanent")}
                loading={busyId === pendingPermanent.novel_id}
              >
                ยืนยันลบถาวร
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
