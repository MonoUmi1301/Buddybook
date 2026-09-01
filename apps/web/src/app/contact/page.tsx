import { InfoPage } from "@/components/info/InfoPage";
import { getCurrentUser } from "@/lib/api/session";

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <InfoPage title="ติดต่อเรา" user={user}>
      <p>ช่องทางติดต่อทีมงานอย่างเป็นทางการกำลังอยู่ระหว่างจัดเตรียม</p>
      <p className="text-neutral-500">กลับมาตรวจสอบหน้านี้อีกครั้งในภายหลัง</p>
    </InfoPage>
  );
}
