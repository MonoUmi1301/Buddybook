import { cn } from "@/lib/cn";

/**
 * เพิ่มภายหลัง (Gift donations) — หมีมาสคอตโผล่จากขอบล่างของการ์ดแบบ "หมีน้อย" วาดด้วย SVG ล้วน
 * (การ์ดทั้งใบสร้างจากโค้ด ไม่ใช้ไฟล์รูป) หน้าตาตามมาสคอต: หมีกลมสีน้ำตาล แก้มแดง ใส่แว่นกลม
 * วาดเฉพาะครึ่งบนของหัว — viewBox ตัดส่วนล่างทิ้ง ให้ดูเหมือนแอบมองจากขอบการ์ด
 * สีทั้งหมดมาจากตัวแปร --bear-* ใน app/gifts.css (มีชุดโหมดมืด)
 */
export function BearPeek({ className }: { className?: string }) {
  const fur = "rgb(var(--bear-fur))";
  const furLight = "rgb(var(--bear-fur-light))";
  const ink = "rgb(var(--bear-ink))";
  const muzzle = "rgb(var(--bear-muzzle))";
  const blush = "rgb(var(--gift-blush))";

  return (
    <svg viewBox="0 0 100 62" aria-hidden className={cn("block", className)} fill="none">
      {/* หู */}
      <circle cx="24" cy="24" r="12" fill={fur} stroke={ink} strokeWidth="2.2" />
      <circle cx="76" cy="24" r="12" fill={fur} stroke={ink} strokeWidth="2.2" />
      <circle cx="24" cy="24" r="6" fill={furLight} />
      <circle cx="76" cy="24" r="6" fill={furLight} />

      {/* หัว (ส่วนล่างเลยขอบ viewBox ไป) */}
      <circle cx="50" cy="66" r="40" fill={fur} stroke={ink} strokeWidth="2.2" />

      {/* แก้ม */}
      <ellipse cx="24" cy="58" rx="6" ry="3.5" fill={blush} opacity="0.85" />
      <ellipse cx="76" cy="58" rx="6" ry="3.5" fill={blush} opacity="0.85" />

      {/* ปาก-จมูก */}
      <ellipse cx="50" cy="64" rx="11" ry="8" fill={muzzle} />
      <ellipse cx="50" cy="58.5" rx="3.4" ry="2.5" fill={ink} />

      {/* ตา + แว่นกลม */}
      <circle cx="36" cy="48" r="2.4" fill={ink} />
      <circle cx="64" cy="48" r="2.4" fill={ink} />
      <circle cx="36" cy="48" r="8.5" stroke={ink} strokeWidth="2.2" fill={muzzle} fillOpacity="0.25" />
      <circle cx="64" cy="48" r="8.5" stroke={ink} strokeWidth="2.2" fill={muzzle} fillOpacity="0.25" />
      <path d="M44.5 47.5 Q50 44.5 55.5 47.5" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27.5 46 L20 43" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M72.5 46 L80 43" stroke={ink} strokeWidth="2" strokeLinecap="round" />

      {/* ประกายบนหัว */}
      <path d="M40 34 Q43 30 47 31" stroke={furLight} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
