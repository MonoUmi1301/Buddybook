"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

// เพิ่มภายหลัง (audit fix) — ปุ่มรูปตาเปิด/ปิดดูรหัสผ่านที่พิมพ์ กันพิมพ์ผิดโดยไม่รู้ตัว ดีไซน์
// ก็อปสไตล์จาก Input.tsx มาแทนที่จะห่อ <Input> ตรง ๆ เพราะปุ่มตาต้องวางซ้อนในกรอบ input เป๊ะ ๆ
// (ไม่ใช่ซ้อนทั้ง label+input ถ้าห่อ Input ทั้งก้อนจะจัดตำแหน่งแนวตั้งของปุ่มผิด)
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, disabled, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            disabled={disabled}
            className={cn(
              "h-11 w-full rounded-lg border border-neutral-300 bg-white py-2 pl-4 pr-11 text-sm text-neutral-900 placeholder:text-neutral-400",
              "transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
              "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400",
              error && "border-red-400 focus:border-red-400 focus:ring-red-100",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-600"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
