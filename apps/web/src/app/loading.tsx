import { BearLoader } from "@/components/ui/BearLoader";

// หน้าโหลดของทั้งเว็บ — Next แสดงทันทีที่กดเปลี่ยนหน้า ระหว่างรอ Server Component ของหน้าใหม่
// หน้าไหนอยากได้ skeleton เฉพาะตัว ให้วาง loading.tsx ในโฟลเดอร์ของหน้านั้นทับได้
export default function Loading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <BearLoader />
    </div>
  );
}
