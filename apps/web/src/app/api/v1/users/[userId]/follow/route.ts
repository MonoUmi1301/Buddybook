import { forwardToApi } from "@/lib/api/proxy";
import { requireUuidParam } from "@/lib/api/validate";
import { getAccessToken, requireAccessToken } from "@/lib/api/auth";

// เพิ่มภายหลัง (ติดตามนักเขียน) — GET (Public, แนบ token ถ้ามีเพื่อรู้ว่าติดตามอยู่ไหม) / POST / DELETE
export async function GET(_request: Request, { params }: { params: { userId: string } }) {
  const id = requireUuidParam(params.userId, "user_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method: "GET", path: `/users/${id.value}/follow`, token: getAccessToken() });
}

async function mutate(method: "POST" | "DELETE", userId: string) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  const id = requireUuidParam(userId, "user_id");
  if ("error" in id) return id.error;
  return forwardToApi({ method, path: `/users/${id.value}/follow`, token: auth.token });
}

export async function POST(_request: Request, { params }: { params: { userId: string } }) {
  return mutate("POST", params.userId);
}

export async function DELETE(_request: Request, { params }: { params: { userId: string } }) {
  return mutate("DELETE", params.userId);
}
