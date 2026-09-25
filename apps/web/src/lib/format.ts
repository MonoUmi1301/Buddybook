/** ย่อตัวเลขใหญ่ให้อ่านง่ายบนการ์ด/สถิติ เช่น 25,400 → 25.4K, 1,800,000 → 1.8M */
export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** ปักเขตเวลาไทยเสมอ — วันที่ถูก render ทั้งฝั่ง server (container เป็น UTC) และ browser ถ้าปล่อยให้ใช้
 *  เขตเวลาของเครื่อง เวลาใกล้เที่ยงคืนจะได้คนละวัน (เช่น 23 vs 24 ก.ย.) → React hydration mismatch
 *  แล้ว Next ทิ้ง HTML จาก server ไป render ใหม่ทั้งหน้าฝั่ง client */
export const THAI_TIME_ZONE = "Asia/Bangkok";

/** วันที่แบบไทยสั้น เช่น 15 พ.ค. 2569 — ใช้กับรายการตอน/รีวิว */
export function formatThaiDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: THAI_TIME_ZONE });
}

/** เดือน-ปีแบบไทย เช่น พฤษภาคม 2569 — ใช้กับ "เข้าร่วมเมื่อ" */
export function formatThaiMonthYear(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: THAI_TIME_ZONE });
}

const relativeFormatter = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** เวลาแบบสัมพัทธ์ภาษาไทย เช่น "2 ชั่วโมงที่ผ่านมา", "เมื่อวาน" — ใช้กับ "อ่านล่าสุด" */
export function formatRelativeThai(iso: string | Date, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return relativeFormatter.format(Math.round(seconds / size), unit);
  }
  return "เมื่อสักครู่";
}
