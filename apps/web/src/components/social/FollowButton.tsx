"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toaster";

interface FollowStatus {
  follower_count: number;
  following: boolean;
}

interface FollowButtonProps {
  authorId: string;
  isLoggedIn: boolean;
  className?: string;
}

/** เพิ่มภายหลัง (ติดตามนักเขียน) — ติดตามแล้วได้แจ้งเตือนตอนใหม่ของทุกเรื่องของนักเขียนคนนี้ */
export function FollowButton({ authorId, isLoggedIn, className }: FollowButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/users/${authorId}/follow`)
      .then((res) => (res.ok ? (res.json() as Promise<FollowStatus>) : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authorId]);

  async function toggle() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (!status) return;
    setPending(true);
    try {
      const res = await fetch(`/api/v1/users/${authorId}/follow`, { method: status.following ? "DELETE" : "POST" });
      if (res.ok) setStatus((await res.json()) as FollowStatus);
      else toast("ทำรายการไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setPending(false);
    }
  }

  const following = status?.following ?? false;
  const Icon = following ? UserCheck : UserPlus;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending || (isLoggedIn && !status)}
      aria-pressed={following}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-pill px-4 text-sm font-medium transition-colors disabled:opacity-60",
        following
          ? "border border-neutral-300 bg-white text-neutral-700 hover:border-red-300 hover:text-red-600"
          : "bg-primary-500 text-white hover:bg-primary-600",
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {following ? "กำลังติดตาม" : "ติดตาม"}
      {status && status.follower_count > 0 && (
        <span className={cn("text-xs", following ? "text-neutral-400" : "text-white/80")}>
          {status.follower_count.toLocaleString()}
        </span>
      )}
    </button>
  );
}
