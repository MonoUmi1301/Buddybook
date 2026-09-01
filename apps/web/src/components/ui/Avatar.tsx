import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "@/lib/cn";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const sizePx = { sm: 32, md: 40, lg: 56 };

export function Avatar({ src, alt, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tan/30",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${sizePx[size]}px`} className="object-cover" />
      ) : (
        <User className="h-1/2 w-1/2 text-brand-tan-dark" />
      )}
    </div>
  );
}
