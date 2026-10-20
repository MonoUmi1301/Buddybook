import Link from "next/link";
import { GuideLayout, GuideNote, GuideSection, GuideShot, GuideStep, Ui } from "@/components/guide/Guide";
import { getCurrentUser } from "@/lib/api/session";

export const metadata = { title: "วิธีเติม coin · BuddyBook" };

const toc = [
  { id: "what", label: "coin คืออะไร" },
  { id: "topup", label: "เติม coin ทีละขั้น" },
  { id: "history", label: "ตรวจยอดและประวัติ" },
  { id: "unlock", label: "ใช้ coin ปลดล็อกตอน" },
  { id: "trouble", label: "เติมแล้วมีปัญหา" },
];

// แพ็กเกจตรงกับ components/wallet/WalletContent.tsx
const packages = [
  { coins: 25, price: "25 บาท" },
  { coins: 50, price: "50 บาท" },
  { coins: 100, price: "99 บาท" },
  { coins: 259, price: "250 บาท" },
  { coins: 410, price: "400 บาท" },
  { coins: 825, price: "800 บาท" },
];

export default async function CoinGuidePage() {
  const user = await getCurrentUser();
  return (
    <GuideLayout
      user={user}
      current="/guide/coin"
      title="วิธีเติม coin"
      toc={toc}
      intro={<>เติม coin ด้วย PromptPay (สแกน QR จากแอปธนาคาร) หรือบัตรเดบิต/เครดิต ยืนยันอัตโนมัติ ไม่ต้องแนบสลิป</>}
    >
      <GuideSection id="what" title="coin คืออะไร">
        <GuideStep step={1} title="ใช้ทำอะไรได้บ้าง">
          <p>coin เป็นเหรียญในเว็บ ใช้ปลดล็อกตอนติดเหรียญ และส่งของขวัญให้นักเขียน</p>
        </GuideStep>
        <GuideStep step={2} title="แพ็กเกจและราคา">
          <p>ยิ่งเติมเยอะยิ่งคุ้ม แพ็กเกจที่มีตอนนี้:</p>
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    ได้ coin
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    ราคา
                  </th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.coins} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-semibold text-neutral-900">{p.coins.toLocaleString()} coin</td>
                    <td className="px-4 py-2 text-neutral-700">{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GuideStep>
      </GuideSection>

      <GuideSection id="topup" title="เติม coin ทีละขั้น" lead="ต้องเข้าสู่ระบบก่อน">
        <GuideStep step={1} title="เปิดหน้าเติม coin">
          <p>
            กดรูปโปรไฟล์มุมขวาบน แล้วเลือก <Ui>เติม coin</Ui> (หรือกด{" "}
            <Link href="/wallet" className="font-medium text-primary-600 hover:underline">
              ลิงก์นี้
            </Link>
            )
          </p>
          <GuideShot name="coin-menu" alt="เมนูบัญชีที่เปิดจากรูปโปรไฟล์ ลูกศรชี้เมนูเติม coin" legend={[<>เมนู เติม coin</>]} narrow />
        </GuideStep>
        <GuideStep step={2} title="เลือกแพ็กเกจ">
          <p>ด้านขวาบนแสดง coin ที่มีอยู่ตอนนี้ กดปุ่มราคาของแพ็กเกจที่ต้องการ</p>
          <GuideShot
            name="coin-wallet"
            alt="หน้าเติม coin แสดงยอด coin ของฉันและรายการแพ็กเกจพร้อมปุ่มราคา"
            legend={[<>coin ที่มีอยู่ตอนนี้</>, <>กดปุ่มราคาของแพ็กเกจที่ต้องการ (ตัวอย่าง: 100 coin ราคา 99 บาท)</>]}
          />
        </GuideStep>
        <GuideStep step={3} title="เลือกวิธีชำระเงิน">
          <p>
            หน้าต่างชำระเงินของ Stripe จะเปิดขึ้น กรอกอีเมล (ใช้ส่งใบเสร็จ) แล้วเลือกวิธีจ่าย ข้อมูลการชำระเงินส่งตรงถึง Stripe ผ่านการเข้ารหัส
            BuddyBook ไม่เห็นและไม่เก็บเลขบัตรของคุณ
          </p>
          <GuideShot
            name="coin-checkout"
            alt="หน้าต่างชำระเงินของ Stripe มีช่องอีเมล ตัวเลือก PromptPay และบัตร และปุ่มชำระเงิน"
            legend={[
              <>อีเมลสำหรับรับใบเสร็จ</>,
              <>
                <Ui>PromptPay</Ui> สแกน QR ด้วยแอปธนาคาร
              </>,
              <>
                <Ui>บัตร</Ui> เดบิต/เครดิต
              </>,
              <>
                <Ui>ชำระเงิน</Ui>
              </>,
            ]}
            narrow
          />
        </GuideStep>
        <GuideStep step={4} title="ชำระเงิน">
          <p>
            <span className="font-semibold">จ่ายด้วย PromptPay:</span> เลือก PromptPay แล้วกด <Ui>ชำระเงิน</Ui> จะขึ้น QR Code เปิดแอปธนาคาร
            เลือกสแกนจ่าย สแกน QR แล้วยืนยันยอด จ่ายบนมือถืออยู่แล้ว กดบันทึกรูป QR แล้วเลือกรูปจากอัลบั้มในแอปธนาคารได้
          </p>
          <p>
            <span className="font-semibold">จ่ายด้วยบัตร:</span> เลือก บัตร กรอกหมายเลขบัตร วันหมดอายุ รหัส CVC และชื่อบนบัตร แล้วกด{" "}
            <Ui>ชำระเงิน</Ui>
          </p>
          <GuideNote tone="warn">
            ถ้าธนาคารขอยืนยันตัวตน (OTP / 3D Secure) ให้ยืนยันในหน้าต่างที่เด้งขึ้นให้เสร็จ อย่าปิดหน้าต่างหรือกดย้อนกลับระหว่างรอ
          </GuideNote>
        </GuideStep>
        <GuideStep step={5} title="รอยืนยัน แล้ว coin เข้าทันที">
          <p>
            จ่ายเสร็จระบบจะพากลับมาหน้าเติม coin ขึ้นข้อความ <Ui>กำลังตรวจสอบการชำระเงิน...</Ui> สักครู่ แล้วเปลี่ยนเป็น{" "}
            <Ui>ชำระเงินสำเร็จ!</Ui> พร้อมจำนวน coin ที่ได้ ยอด coin มุมขวาบนจะอัปเดตเอง
          </p>
          <GuideNote>
            ถ้าขึ้น <Ui>รอยืนยันการชำระเงิน</Ui> แปลว่าธนาคารยังยืนยันไม่เสร็จ ปิดหน้านี้ได้เลย coin จะเข้าเองเมื่อยืนยันแล้ว
          </GuideNote>
        </GuideStep>
      </GuideSection>

      <GuideSection id="history" title="ตรวจยอดและประวัติ">
        <GuideStep step={1} title="ดูประวัติการซื้อ">
          <p>
            เลื่อนลงในหน้าเติม coin จะเจอ <Ui>ประวัติการซื้อ</Ui> รวมรายการเติม ใช้ และรับ coin ทั้งหมด กรองได้ด้วยแท็บ <Ui>ทั้งหมด</Ui>{" "}
            <Ui>เข้า</Ui> <Ui>ออก</Ui> ทุกรายการบอกยอดคงเหลือหลังทำรายการ
          </p>
          <GuideShot name="coin-history" alt="ส่วนประวัติการซื้อในหน้าเติม coin" legend={[<>ประวัติการซื้อ: ทุกรายการเติม ใช้ และรับ coin</>, <>กรองรายการ: ทั้งหมด / เข้า / ออก</>]} />
        </GuideStep>
      </GuideSection>

      <GuideSection id="unlock" title="ใช้ coin ปลดล็อกตอน">
        <GuideStep step={1} title="เปิดตอนที่ติดเหรียญ">
          <p>
            ตอนติดเหรียญจะแสดงตัวอย่างเนื้อหาช่วงแรก และบอกราคาเป็น coin ถ้า coin พอ กด <Ui>ใช้ ... เพื่อปลดล็อก</Ui> แล้วกด{" "}
            <Ui>ยืนยัน</Ui> อีกครั้ง ถ้าไม่พอ จะบอกว่าขาดอีกเท่าไร พร้อมปุ่ม <Ui>ไปเติมคอยน์</Ui>
          </p>
          <GuideShot name="coin-unlock" alt="ตอนติดเหรียญ แสดงราคาและปุ่มไปเติมคอยน์" legend={[<>ปุ่มปลดล็อก หรือ ไปเติมคอยน์ (เมื่อ coin ไม่พอ)</>]} />
        </GuideStep>
        <GuideStep step={2} title="ซื้อครั้งเดียว อ่านได้ตลอด">
          <p>ตอนที่ปลดล็อกแล้วอ่านซ้ำได้ไม่จำกัด ไม่ต้องจ่ายอีก ตราบใดที่เข้าสู่ระบบด้วยบัญชีเดิม</p>
        </GuideStep>
      </GuideSection>

      <GuideSection id="trouble" title="เติมแล้วมีปัญหา">
        <GuideStep step={1} title="จ่ายเงินแล้วแต่ coin ไม่เข้า">
          <p>
            รอ 2-3 นาทีแล้วรีเฟรชหน้าเติม coin ดูใน <Ui>ประวัติการซื้อ</Ui> ก่อน ถ้ายังไม่เข้า{" "}
            <Link href="/support#ticket" className="font-medium text-primary-600 hover:underline">
              แจ้งทีมงาน
            </Link>{" "}
            โดยบอกวันเวลาที่จ่ายและจำนวนเงิน ไม่ต้องส่งเลขบัตร
          </p>
        </GuideStep>
        <GuideStep step={2} title="ขึ้น ทำรายการไม่สำเร็จ">
          <p>การชำระเงินไม่ผ่าน coin ยังไม่เข้า ลองใหม่อีกครั้งหรือใช้บัตรใบอื่น ถ้าธนาคารปฏิเสธซ้ำ ให้ติดต่อธนาคารของบัตร ถ้าเห็นยอดถูกตัดแต่ coin ไม่เข้า แจ้งทีมงานตามข้อบน</p>
        </GuideStep>
      </GuideSection>
    </GuideLayout>
  );
}
