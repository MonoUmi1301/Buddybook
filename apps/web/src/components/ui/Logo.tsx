import { PawPrint } from "lucide-react";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  /** ธีมมืด (หน้า Home) ใช้สีแทนอ่อน, ธีมสว่าง (login/detail) ใช้สีน้ำตาลเข้ม — ดู wf_home_dark vs wf_login */
  variant?: "dark" | "light";
  /** เล็กลงบนจอมือถือ (ต่ำกว่า sm) และเหลือแค่รูปอุ้งเท้าบนจอแคบกว่า 360px (ชื่อยังอ่านได้ด้วย screen reader)
   *  — ใช้ใน Navbar ที่ต้องแบ่งความกว้างกับปุ่มด้านขวา */
  responsive?: boolean;
}

// วาดใหม่แบบ text-based ให้ใกล้เคียง wordmark จริงใน Logo.pdf ที่สุดเท่าที่ทำได้ด้วย
// Tailwind ล้วน (ตัวจริงเป็นฟอนต์ตัวอักษรมีหูหมี/รอยอุ้งเท้าวาดมือ ซึ่งไม่มีไฟล์ font นั้นในโปรเจกต์)
export function Logo({ className, variant = "light", responsive = false }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold tracking-tight",
        responsive ? "text-xl sm:text-h3" : "text-h3",
        variant === "dark" ? "text-brand-tan" : "text-brand-brown",
        className
      )}
    >
      <PawPrint
        className={cn("h-5 w-5 -rotate-12", variant === "dark" ? "text-brand-tan" : "text-brand-brown")}
        fill="currentColor"
      />
      <span className={responsive ? "max-[359px]:sr-only" : undefined}>BuddyBook</span>
    </span>
  );
}
