import { forwardToApi } from "@/lib/api/proxy";
import { parseJsonBody } from "@/lib/api/validate";
import { interestsSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/auth";

// POST /api/v1/users/me/interests — เลือก tag ความสนใจตอน Onboarding
export async function POST(request: Request) {
  const auth = requireAccessToken();
  if ("error" in auth) return auth.error;

  const parsed = await parseJsonBody(request, interestsSchema);
  if ("error" in parsed) return parsed.error;

  const response = await forwardToApi({
    method: "POST",
    path: "/users/me/interests",
    token: auth.token,
    body: parsed.data,
  });

  // เพิ่มภายหลัง (Phase R) — จุดที่รู้แน่ชัดที่สุดว่า user เพิ่งตอบ onboarding จบจริง ตั้ง cookie
  // ให้ middleware.ts เช็คแบบเร็ว (ไม่ต้องยิง API เช็ค DB ทุก request) — ไม่ใช่ httpOnly เพราะแค่
  // preference ฝั่ง UI ไม่ใช่ auth เหมือนแพทเทิร์นเดิมของ bb_onboarding_skipped ที่ถูกลบไปแล้ว
  //
  // audit fix — เดิมเช็ค === 200 แต่ POST /users/me/interests (users.controller.ts setInterests)
  // ตอบ 201 จริง (สร้าง resource ใหม่) ทำให้เงื่อนไขนี้เป็น false เสมอ cookie ไม่เคยถูกตั้งเลยสักครั้ง
  // ผลคือ middleware.ts บังคับ redirect กลับ /onboarding ทุก request ที่ไม่มี cookie นี้ (รวม "/" ด้วย)
  // แม้ user เพิ่งตอบจบไปหมาด ๆ ก็ตาม → ชน onboarding/page.tsx ที่เห็น has_interests=true จริงจาก DB
  // แล้ว redirect กลับ "/" → วนลูปไม่รู้จบสำหรับผู้ใช้ที่ล็อกอินทุกคน — ใช้ < 400 กันไว้ ทนทานกว่าเช็ค
  // status code ตัวเดียวเป๊ะ ๆ ถ้ามีการเปลี่ยน status สำเร็จในอนาคต
  if (response.status < 400) {
    response.cookies.set("bb_has_interests", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}
