"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

const rules: { label: string; test: (pw: string) => boolean }[] = [
  { label: "อย่างน้อย 8 ตัวอักษร", test: (pw) => pw.length >= 8 },
  { label: "ตัวพิมพ์เล็ก (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "ตัวพิมพ์ใหญ่ (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "ตัวเลข (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "อักขระพิเศษ (!@#$%...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** เพิ่มภายหลัง (audit fix — ความปลอดภัยรหัสผ่าน) — ตัวเช็คสด ๆ ว่ารหัสผ่านที่พิมพ์อยู่ผ่านเงื่อนไข
 *  ไหนแล้วบ้าง มิเรอร์กฎเดียวกับ apps/api/src/lib/passwordPolicy.ts เป๊ะ ๆ (ถ้าแก้ policy ต้องแก้
 *  rules ในนี้คู่กันด้วย) — ให้ผู้ใช้เห็นก่อน submit ว่าต้องแก้ตรงไหน แทนที่จะรู้ทีหลังตอน error กลับมา */
export function PasswordRequirementsHint({ password }: { password: string }) {
  return (
    <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
      {rules.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              passed ? "text-emerald-600" : "text-neutral-400"
            )}
          >
            {passed ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
