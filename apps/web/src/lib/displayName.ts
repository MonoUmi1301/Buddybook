/** นามปากกาคือชื่อที่นักอ่านเห็นบนหน้านิยาย/ตอน — ถ้ายังไม่ได้ตั้งไว้ ให้ใช้ username แทน
 *  (username เอาไว้ใช้กับคอมเมนต์/รีวิวเท่านั้น ไม่ควรใช้เป็นชื่อผู้แต่งที่แสดงต่อสาธารณะ) */
export function getPenName(author: { username: string; pen_name?: string | null }): string {
  return author.pen_name?.trim() || author.username;
}
