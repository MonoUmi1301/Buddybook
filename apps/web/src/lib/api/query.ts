/** ส่งต่อเฉพาะ query param ที่อนุญาต จาก request ของเบราว์เซอร์ไปยัง Express (ไม่ส่งทุกอย่างแบบตาบอด) */
export function pickSearchParams(request: Request, allowed: string[]): URLSearchParams {
  const incoming = new URL(request.url).searchParams;
  const out = new URLSearchParams();
  for (const key of allowed) {
    const v = incoming.get(key);
    if (v !== null && v !== "") out.set(key, v);
  }
  return out;
}
