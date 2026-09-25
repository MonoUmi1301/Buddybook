import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";
import { GiftsManager, type AdminGiftRow } from "@/components/admin/GiftsManager";

// เพิ่มภายหลัง (Gift donations) — GET /admin/gifts (แคตตาล็อกทั้งหมดรวมที่ปิดขาย)
export default async function AdminGiftsPage() {
  const result = await callApi({ method: "GET", path: "/admin/gifts", token: getAccessToken() });
  const gifts: AdminGiftRow[] =
    !("error" in result) && result.status === 200 ? (result.json as { items: AdminGiftRow[] }).items : [];

  return <GiftsManager initialGifts={gifts} />;
}
