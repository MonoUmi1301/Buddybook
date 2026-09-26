"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";

interface ChapterUnlockPanelProps {
  chapterId: string;
  priceCoins: number;
  isLoggedIn: boolean;
}

/** เพิ่มภายหลัง (ตอนติดเหรียญ) — แสดงแทนเนื้อหาตอนที่ยังไม่ได้ซื้อ (API ส่ง content: null, locked: true) */
export function ChapterUnlockPanel({ chapterId, priceCoins, isLoggedIn }: ChapterUnlockPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<number | null>(null);

  async function unlock() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/chapters/${chapterId}/purchase`, { method: "POST" });
      const json = (await res.json().catch(() => null)) as { details?: { missing?: number } } | null;
      if (res.ok) {
        toast("ปลดล็อกตอนนี้แล้ว");
        router.refresh();
        return;
      }
      if (res.status === 422 && json?.details?.missing) {
        setMissing(json.details.missing);
        return;
      }
      toast("ปลดล็อกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-neutral-800">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-semibold">ตอนนี้เป็นตอนพิเศษ</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-sm text-neutral-600">
          ปลดล็อกด้วย <Coins className="h-4 w-4 text-amber-500" aria-hidden /> {priceCoins} คอยน์ ซื้อครั้งเดียวอ่านได้ตลอด
        </p>
      </div>

      {!isLoggedIn ? (
        <Link href="/login" className="text-sm font-medium text-primary-600 hover:underline">
          เข้าสู่ระบบเพื่อปลดล็อก
        </Link>
      ) : missing !== null ? (
        <div className="flex flex-col items-center gap-2 text-sm">
          <p className="text-red-600">คอยน์ไม่พอ ขาดอีก {missing} คอยน์</p>
          <Link href="/wallet" className="font-medium text-primary-600 hover:underline">
            ไปเติมคอยน์
          </Link>
        </div>
      ) : (
        <Button onClick={unlock} loading={loading}>
          ปลดล็อก {priceCoins} คอยน์
        </Button>
      )}
    </div>
  );
}
