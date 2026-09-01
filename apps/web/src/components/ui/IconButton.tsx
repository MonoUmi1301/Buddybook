import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "dark" | "light";
  /** จุดแดงแจ้งเตือน (ดู icon กระดิ่งใน wf_empty_states.png) */
  showDot?: boolean;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "light", showDot, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
          variant === "dark"
            ? "text-zinc-100 hover:bg-white/10 active:bg-white/20"
            : "text-brand-brown hover:bg-neutral-100 active:bg-neutral-200",
          className
        )}
        {...props}
      >
        {children}
        {showDot && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-current" />
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
