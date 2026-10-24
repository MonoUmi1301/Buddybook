import { forwardToApi } from "@/lib/api/proxy";
import { requireAccessToken } from "@/lib/api/auth";

// DELETE /api/v1/kyc — ถอนความยินยอม: ลบข้อมูลการยืนยันตัวตนและยกเลิกอายุที่ได้จากบัตร (PDPA)
export async function DELETE() {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;
  return forwardToApi({ method: "DELETE", path: "/kyc", token: auth.token });
}
