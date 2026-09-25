import { forwardToApi } from "@/lib/api/proxy";

// GET /api/v1/gifts/catalog — Public (ของขวัญที่เปิดขายอยู่ + fee/เพดานต่อครั้งจาก config)
export async function GET() {
  return forwardToApi({ method: "GET", path: "/gifts/catalog" });
}
