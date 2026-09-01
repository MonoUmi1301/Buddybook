import { InfoPage } from "@/components/info/InfoPage";
import { getCurrentUser } from "@/lib/api/session";

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  return (
    <InfoPage title="นโยบายความเป็นส่วนตัว" user={user}>
      <p>เอกสารนโยบายความเป็นส่วนตัวฉบับทางการยังอยู่ระหว่างจัดเตรียมและตรวจสอบทางกฎหมาย</p>
      <p className="text-neutral-500">
        หน้านี้จะได้รับการอัปเดตก่อนเปิดให้บริการจริง เนื้อหาปัจจุบันยังไม่มีผลผูกพันใด ๆ
      </p>
    </InfoPage>
  );
}
