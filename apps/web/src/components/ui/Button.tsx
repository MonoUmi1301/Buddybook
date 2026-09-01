import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type ButtonVariant =
  | "primary"
  | "tan"
  | "outline"
  | "outline-dark"
  | "ghost"
  | "facebook"
  | "line"
  | "google";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

// Interactive state ตามที่ระบุ: hover (สีเข้มขึ้น/opacity), disabled (mute + cursor-not-allowed),
// loading (spinner จาก lucide + disable ปุ่มระหว่างรอ) — สีแต่ละ variant อ้างอิงจาก wf_login
// (ปุ่ม social เป็นแบรนด์คัลเลอร์จริงของ Facebook/Line/Google)
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300",
  tan: "bg-brand-tan text-white hover:bg-brand-tan-dark active:bg-brand-tan-dark disabled:bg-brand-tan/50",
  outline:
    "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100 disabled:text-neutral-400",
  "outline-dark":
    "border border-surface-border bg-transparent text-neutral-100 hover:bg-surface-muted active:bg-surface-border disabled:text-neutral-600",
  ghost: "bg-transparent text-neutral-200 hover:bg-white/10 active:bg-white/20 disabled:text-neutral-600",
  facebook: "bg-[#1877F2] text-white hover:bg-[#1568D6] active:bg-[#0E58BC] disabled:opacity-50",
  line: "bg-[#06C755] text-white hover:bg-[#05B04B] active:bg-[#049640] disabled:opacity-50",
  google:
    "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100 disabled:opacity-50",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading = false, fullWidth, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-pill font-medium transition-colors duration-150",
          "disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
