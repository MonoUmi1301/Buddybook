import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/novels/:novelId/map-versions — บันทึกเวอร์ชันแผนที่ปัจจุบัน
export async function POST(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "POST", path: `/novels/${id.value}/map-versions`, token: auth.token });
}

// GET /api/v1/novels/:novelId/map-versions — ดูรายการเวอร์ชันแผนที่ที่บันทึกไว้
export async function GET(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  return forwardToApi({ method: "GET", path: `/novels/${id.value}/map-versions`, token: auth.token });
}
