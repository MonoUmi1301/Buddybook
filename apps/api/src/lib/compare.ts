/** เรียง string ตาม UTF-16 code unit (= ลำดับเดียวกับ `.sort()` เปล่า ๆ) แต่เขียน comparator ให้ชัด
 *  ใช้ตรงที่ลำดับต้องคงที่ไม่ขึ้นกับ locale — ลำดับล็อก wallet (กัน deadlock), key ของ payload ที่ต้องเซ็น
 *  ห้ามเปลี่ยนเป็น localeCompare ตรงนั้น: collation ของ ICU ไม่ได้เรียงแบบ code unit */
export function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
