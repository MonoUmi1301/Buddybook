"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface PublishVisibilityChoiceProps {
  novelId: string;
  initialVisibility: "published" | "private" | "pending_review";
}

/** เพิ่มภายหลัง (audit fix) — นิยายที่เพิ่งสร้างเริ่มที่ visibility=private เสมอ (ดู
 *  novels.service.ts createNovel) หน้านี้เป็นจุดที่ผู้เขียนยืนยันจริงว่าจะเผยแพร่เลยหรือเก็บไว้ก่อน —
 *  ยังเปลี่ยนใจทีหลังได้เสมอจากหน้าจัดการนิยาย (ไม่ใช่ทางเลือกทางเดียว) */
export function PublishVisibilityChoice({ novelId, initialVisibility }: PublishVisibilityChoiceProps) {
  const [visibility, setVisibility] = useState<"published" | "private">(
    initialVisibility === "published" ? "published" : "private"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: "published" | "private") {
    if (next === visibility) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/novels/${novelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setVisibility(next);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 w-full rounded-card border border-neutral-200 bg-neutral-50 p-4 text-left">
      <p className="mb-3 text-sm font-semibold text-neutral-800">สถานะการเผยแพร่</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => choose("private")}
          className={cn(
            "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            visibility === "private"
              ? "border-primary-400 bg-primary-50"
              : "border-neutral-200 bg-white hover:border-primary-300"
          )}
        >
          <EyeOff className="h-5 w-5 shrink-0 text-neutral-500" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-neutral-900">เก็บเป็นส่วนตัวไว้ก่อน</span>
            <span className="block text-xs text-neutral-500">ยังไม่มีใครค้นหาเจอ แก้ไข/เผยแพร่ทีหลังได้</span>
          </span>
          {visibility === "private" && <Check className="h-4 w-4 shrink-0 text-primary-500" />}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => choose("published")}
          className={cn(
            "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            visibility === "published"
              ? "border-primary-400 bg-primary-50"
              : "border-neutral-200 bg-white hover:border-primary-300"
          )}
        >
          <Eye className="h-5 w-5 shrink-0 text-neutral-500" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-neutral-900">เผยแพร่เลย</span>
            <span className="block text-xs text-neutral-500">ผู้อ่านค้นหาและเข้าดูหน้านิยายได้ทันที</span>
          </span>
          {visibility === "published" && <Check className="h-4 w-4 shrink-0 text-primary-500" />}
        </button>
      </div>

      {saving && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังบันทึก...
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
