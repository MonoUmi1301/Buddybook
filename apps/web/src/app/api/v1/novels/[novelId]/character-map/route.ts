import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { requireAccessToken } from "@/lib/api/auth";

// PUT /api/v1/novels/:novelId/character-map — เผยแพร่แผนผังตัวละคร (สำเนา ณ ตอนนี้) บนหน้านิยาย
export async function PUT(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method: "PUT", path: `/novels/${id.value}/character-map`, token: auth.token });
}

// DELETE /api/v1/novels/:novelId/character-map — ซ่อนแผนผังตัวละครจากหน้านิยาย
export async function DELETE(_request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method: "DELETE", path: `/novels/${id.value}/character-map`, token: auth.token });
}
