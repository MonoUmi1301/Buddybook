import { BearPeek } from "@/components/gifts/BearPeek";
import type { CardTemplate } from "@/lib/donate-assets";
import { cn } from "@/lib/cn";

interface LetterCardProps {
  template: CardTemplate;
  recipientName: string;
  message: string;
  /** ชื่อลงท้ายที่จะแสดง (คำนวณมาแล้วว่าเป็นนิรนาม/ชื่อที่ตั้ง/ชื่อบัญชี) */
  signature: string;
  /** แสดงข้อความตัวอย่างจาง ๆ ตอนยังไม่ได้พิมพ์ (ใช้ในพรีวิวของ GiftDialog) */
  placeholder?: string;
  size?: "full" | "mini";
  className?: string;
}

/**
 * เพิ่มภายหลัง (Gift donations) — การ์ดจดหมาย 4 แม่แบบ สร้างจากโค้ดล้วน (CSS ใน app/gifts.css + SVG) ไม่ใช้ไฟล์รูป
 * ใช้ทั้งพรีวิวตอนเขียน, หน้ายืนยัน และ (เฟสถัดไป) กล่องจดหมายนักเขียน/การ์ดสาธารณะ
 * ข้อความแสดงเป็น plain text เท่านั้น (whitespace-pre-line) ไม่มี HTML
 */
export function LetterCard({ template, recipientName, message, signature, placeholder, size = "full", className }: LetterCardProps) {
  const mini = size === "mini";
  const body = message.trim();

  const content = (
    <div
      className={cn(
        "gift-card",
        `gift-card--${template}`,
        mini ? "text-[11px]" : "text-sm",
        template === "stamp" ? "" : mini ? "p-2.5" : "p-4 sm:p-5",
        className
      )}
    >
      <div className={cn("gift-card__inner relative", template === "stamp" || template === "navy" ? (mini ? "p-2" : "p-4") : "")}>
        {template === "matcha" && (
          <>
            <div
              aria-hidden
              className={cn("gift-gingham gift-gingham--corner absolute -right-4 -top-4", mini ? "h-10 w-10" : "h-16 w-16")}
            />
            <div aria-hidden className={cn("gift-gingham absolute inset-x-0 -bottom-1", mini ? "h-1.5" : "h-2.5")} />
          </>
        )}

        {template === "navy" && (
          <div aria-hidden className={cn("mx-auto", mini ? "-mt-1 mb-1 scale-50" : "-mt-1 mb-2")}>
            <div className="gift-bow mx-auto">
              <span className="gift-bow__knot" />
            </div>
          </div>
        )}

        {template === "stamp" && !mini && (
          <div
            aria-hidden
            className="gift-postmark absolute bottom-2 left-2 flex h-14 w-14 flex-col items-center justify-center rounded-full text-[8px] font-bold uppercase leading-tight tracking-wider"
          >
            <span>BuddyBook</span>
            <span className="mt-0.5 text-[7px] font-medium">with love</span>
          </div>
        )}

        <p className="font-semibold" style={{ color: "rgb(var(--card-accent))" }}>
          ถึง {recipientName}
        </p>

        <p
          className={cn(
            "gift-card__line mt-1 whitespace-pre-line break-words",
            mini ? "line-clamp-4 min-h-[3.5em]" : "min-h-[7em]",
            !body && "opacity-50"
          )}
        >
          {body || placeholder || ""}
        </p>

        <p
          className={cn(
            "mt-2 text-right font-medium",
            mini ? "text-[10px]" : "text-sm",
            // เว้นที่ให้ตราประทับมุมล่างซ้ายของแม่แบบแสตมป์ ไม่ให้ทับบรรทัดข้อความ
            template === "stamp" && !mini && "flex min-h-[3.5rem] items-end justify-end pl-16"
          )}
          style={{ color: "rgb(var(--card-muted))" }}
        >
          จาก {signature}
        </p>

        {template === "bear" && (
          // ชิดขอบล่างการ์ด (หักล้าง padding) ให้หัวหมีโผล่พ้นขอบล่างพอดี
          <div aria-hidden className={cn("flex justify-center", mini ? "-mb-2.5 mt-1" : "-mb-4 mt-1 sm:-mb-5")}>
            <BearPeek className={mini ? "w-14" : "w-24"} />
          </div>
        )}
      </div>
    </div>
  );

  return template === "stamp" ? <div className="gift-stamp-shadow">{content}</div> : content;
}
