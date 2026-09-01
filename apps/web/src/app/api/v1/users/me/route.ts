import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { updateMeSchema, deleteMeSchema } from "@/lib/api/schemas";
import { requireAccessToken, clearAuthCookies } from "@/lib/api/auth";

// GET /api/v1/users/me
export async function GET() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  return forwardToApi({ method: "GET", path: "/users/me", token: auth.token });
}

// PATCH /api/v1/users/me
export async function PATCH(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, updateMeSchema);
  if ("error" in parsed) return parsed.error;

  return forwardToApi({
    method: "PATCH",
    path: "/users/me",
    token: auth.token,
    body: parsed.data,
  });
}

// DELETE /api/v1/users/me — ลบบัญชี (anonymize จริง ๆ ฝั่ง Express — ดู users.controller.ts)
// เคลียร์ auth cookie ทิ้งเสมอถ้า Express ตอบสำเร็จ เพื่อบังคับ log out ทันที ป้องกัน token เก่า
// ที่ยัง valid อยู่ (15 นาที) มาเรียก endpoint อื่นต่อได้ทั้งที่บัญชีถูกลบไปแล้ว
export async function DELETE(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, deleteMeSchema);
  if ("error" in parsed) return parsed.error;

  const response = await forwardToApi({
    method: "DELETE",
    path: "/users/me",
    token: auth.token,
    body: parsed.data,
  });

  return response.status === 204 ? clearAuthCookies(response) : response;
}
