"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface TrashItem {
  trash_id: string;
  content_type: "chapter" | "character_node" | "character_edge" | "location" | "location_edge" | "timeline_event";
  content_snapshot: Record<string, unknown>;
  deleted_at: string;
  auto_delete_at: string;
}

const contentTypeLabel: Record<TrashItem["content_type"], string> = {
  chapter: "ตอนนิยาย",
  character_node: "ตัวละคร",
  character_edge: "ความสัมพันธ์ตัวละคร",
  location: "สถานที่",
  location_edge: "เส้นทางบนแผนที่",
  timeline_event: "เหตุการณ์ไทม์ไลน์",
};

function snapshotTitle(item: TrashItem): string {
  const s = item.content_snapshot;
  return (
    (s.title as string | undefined) ??
    (s.character_name as string | undefined) ??
    (s.name as string | undefined) ??
    (s.edge_label as string | undefined) ??
    "(ไม่มีชื่อ)"
  );
}

function daysRemaining(autoDeleteAt: string): number {
  return Math.max(0, Math.ceil((new Date(autoDeleteAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/** จัดการถังขยะของนิยาย — กู้คืน/ลบถาวร ดู wireframe screen 21-22 */
export function TrashBinManager({ items: initialItems }: { items: TrashItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pendingDelete, setPendingDelete] = useState<TrashItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore(item: TrashItem) {
    setBusyId(item.trash_id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/trash-bin/${item.trash_id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "กู้คืนไม่สำเร็จ");
        return;
      }
      setItems((prev) => prev.filter((i) => i.trash_id !== item.trash_id));
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePermanentDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.trash_id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/trash-bin/${pendingDelete.trash_id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "ลบถาวรไม่สำเร็จ");
        return;
      }
      setItems((prev) => prev.filter((i) => i.trash_id !== pendingDelete.trash_id));
      setPendingDelete(null);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">ถังขยะว่างเปล่า ไม่มีรายการที่ถูกลบ</p>;
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <ul className="divide-y divide-neutral-200 rounded-card border border-neutral-200">
        {items.map((item) => (
          <li key={item.trash_id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{snapshotTitle(item)}</p>
              <p className="text-xs text-neutral-500">{contentTypeLabel[item.content_type]}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-xs text-amber-600">
              <Clock3 className="h-3.5 w-3.5" />
              เหลือ {daysRemaining(item.auto_delete_at)} วัน
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(item)}
              loading={busyId === item.trash_id && !pendingDelete}
            >
              <RotateCcw className="h-3.5 w-3.5" /> กู้คืน
            </Button>
            <button
              type="button"
              onClick={() => setPendingDelete(item)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50"
              aria-label="ลบถาวร"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-xl">
            <h2 className="text-h3 text-neutral-900">ต้องการลบถาวรใช่ไหม?</h2>
            <p className="mt-2 text-sm text-neutral-500">
              &quot;{snapshotTitle(pendingDelete)}&quot; จะถูกลบถาวรและไม่สามารถกู้คืนได้อีก
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="!bg-red-500 hover:!bg-red-600"
                onClick={handlePermanentDelete}
                loading={busyId === pendingDelete.trash_id}
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
