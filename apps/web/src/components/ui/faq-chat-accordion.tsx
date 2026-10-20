"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export interface FAQItem {
  id: number | string;
  question: string;
  answer: string;
  /** ลิงก์ต่อท้ายคำตอบ เช่น ไปหน้าเติม coin */
  link?: { href: string; label: string };
  /** อีโมจิเล็ก ๆ แปะมุมบับเบิลคำถาม */
  icon?: string;
  iconPosition?: "left" | "right";
}

interface FaqAccordionProps {
  data: FAQItem[];
  className?: string;
  /** ข้อความเล็กด้านบนสุดแบบเวลาในห้องแชท — ส่ง null เพื่อซ่อน */
  timestamp?: string | null;
  questionClassName?: string;
  answerClassName?: string;
  /** รูปผู้ตอบ (มาสคอตหมี) ข้างบับเบิลคำตอบ — ส่ง null เพื่อซ่อน */
  avatarSrc?: string | null;
}

/**
 * FAQ แบบห้องแชท — กดคำถาม (บับเบิลซ้าย) แล้วคำตอบเด้งเป็นบับเบิลสีส้มฝั่งขวา
 * ดัดแปลงจาก faq-chat-accordion (shadcn) ให้เข้ากับโปรเจกต์:
 * - ไม่ใช้ framer-motion / @radix-ui/react-accordion (ไม่ต้องติดตั้งแพ็กเกจเพิ่ม) — ยืด/หดด้วย CSS grid-rows แทน
 * - cn มาจาก @/lib/cn (โปรเจกต์นี้ไม่มี @/lib/utils) และใช้สี primary-* / neutral-* ของเว็บ
 */
export function FaqAccordion({
  data,
  className,
  timestamp = "ทีมงาน BuddyBook · ตอบทุกวัน",
  questionClassName,
  answerClassName,
  avatarSrc = "/donate/mascot/mascot-bear.png",
}: FaqAccordionProps) {
  const [openItem, setOpenItem] = React.useState<string | null>(null);
  const baseId = React.useId();

  return (
    <div className={cn("p-4", className)}>
      {timestamp && <div className="mb-4 text-center text-xs text-neutral-400">{timestamp}</div>}

      <ul className="space-y-2.5">
        {data.map((item) => {
          const key = String(item.id);
          const open = openItem === key;
          const panelId = `${baseId}-faq-${key}`;
          return (
            <li key={key}>
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenItem(open ? null : key)}
                  className="group flex w-full items-center justify-start gap-x-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <span
                    className={cn(
                      "relative rounded-2xl rounded-bl-md px-3.5 py-2 text-sm font-medium transition-colors",
                      open
                        ? "bg-primary-500/15 text-primary-700 dark:text-primary-300"
                        : "bg-neutral-100 text-neutral-800 group-hover:bg-primary-500/10",
                      questionClassName
                    )}
                  >
                    {item.icon && (
                      <span
                        aria-hidden
                        className={cn("absolute -top-3 text-base", item.iconPosition === "right" ? "-right-1" : "-left-1")}
                        style={{ transform: item.iconPosition === "right" ? "rotate(7deg)" : "rotate(-4deg)" }}
                      >
                        {item.icon}
                      </span>
                    )}
                    {item.question}
                  </span>
                  <span className={cn("shrink-0 text-neutral-400 transition-colors", open && "text-primary-500")}>
                    {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-hidden={!open}
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex items-end justify-end gap-2 pl-7 pt-2 md:pl-16">
                    <div
                      className={cn(
                        "max-w-sm rounded-2xl rounded-br-md bg-primary-500 px-4 py-2 text-sm leading-relaxed text-white",
                        answerClassName
                      )}
                    >
                      {item.answer}
                      {item.link && (
                        <Link href={item.link.href} className="mt-1 block font-semibold underline underline-offset-2 hover:opacity-90">
                          {item.link.label} →
                        </Link>
                      )}
                    </div>
                    {avatarSrc && (
                      <Image
                        src={avatarSrc}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-full bg-primary-50"
                      />
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
