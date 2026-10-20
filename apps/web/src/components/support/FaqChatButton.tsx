"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { FaqAccordion } from "@/components/ui/faq-chat-accordion";
import { FAQ_DATA } from "@/lib/faq";
import { cn } from "@/lib/cn";

/** หน้าที่ไม่ควรมีปุ่มลอย — หน้าอ่าน (มีปุ่ม Aa มุมเดียวกัน) / หน้าเขียน / หลังบ้าน / ศูนย์ช่วยเหลือ (มี FAQ ในหน้าอยู่แล้ว) */
function hiddenOn(pathname: string) {
  return (
    /^\/novels\/[^/]+\/chapters\//.test(pathname) ||
    pathname.startsWith("/write") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/onboarding")
  );
}

/** ปุ่มแชทลอยมุมขวาล่าง — กดแล้วเปิด "น้องหมีตอบคำถาม" (FAQ แบบแชท) */
export function FaqChatButton() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // เปลี่ยนหน้าแล้วปิดหน้าต่างแชท
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hiddenOn(pathname)) return null;

  return (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-3 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="คำถามที่พบบ่อย"
          className="flex max-h-[min(70vh,560px)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-primary-200 bg-white shadow-2xl duration-200 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="flex items-center gap-3 bg-primary-500 px-4 py-3 text-white">
            <Image
              src="/donate/mascot/mascot-bear.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full bg-white/90 p-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">น้องหมีตอบคำถาม</p>
              <p className="text-xs text-white/85">กดคำถามที่อยากรู้ได้เลย</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-primary-50/40 dark:bg-transparent">
            <FaqAccordion data={FAQ_DATA} />
          </div>

          <div className="border-t border-neutral-200 px-4 py-3 text-center text-xs text-neutral-500">
            ไม่เจอคำตอบ?{" "}
            <Link href="/support#ticket" className="font-semibold text-primary-600 hover:underline">
              คุยกับทีมงาน
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "ปิดคำถามที่พบบ่อย" : "เปิดคำถามที่พบบ่อย"}
        aria-expanded={open}
        title="คำถามที่พบบ่อย"
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 transition-transform",
          "hover:scale-105 hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
