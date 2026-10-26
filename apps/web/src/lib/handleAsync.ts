/**
 * ห่อ async function ให้ใช้เป็น event handler (onClick/onSubmit/...) ที่ React คาดว่าคืน void ได้
 * (code audit M1 — @typescript-eslint/no-misused-promises) error ที่หลุดจาก handler จะถูก log ไว้
 * แทนที่จะเป็น unhandled rejection เงียบ ๆ — handler ที่ต้องแสดงข้อความให้ผู้ใช้ยังต้อง try/catch เอง
 */
export function handleAsync<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return (...args: A): void => {
    fn(...args).catch((err: unknown) => {
      console.error(err);
    });
  };
}
