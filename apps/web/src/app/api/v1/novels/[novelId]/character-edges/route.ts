import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody, requireUuidParam } from "@/lib/api/validate";
import { createCharacterEdgeSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/http";

// POST /api/v1/novels/:novelId/character-edges
export async function POST(request: Request, { params }: { params: { novelId: string } }) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const id = requireUuidParam(params.novelId, "novel_id");
  if ("error" in id) return id.error;

  const parsed = await parseJsonBody(request, createCharacterEdgeSchema);
  if ("error" in parsed) return parsed.error;

  // ตรงตาม API_Endpoints.md: source = target -> 422 "A character cannot be linked to itself"
  if (parsed.data.source_node_id === parsed.data.target_node_id) {
    return jsonError("A character cannot be linked to itself", 422);
  }

  return forwardToApi({
    method: "POST",
    path: `/novels/${id.value}/character-edges`,
    token: auth.token,
    body: parsed.data,
  });
}
