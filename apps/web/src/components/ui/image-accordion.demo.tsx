"use client";

import { ImageAccordion, type ImageAccordionItem } from "@/components/ui/image-accordion";

/** ตัวอย่างการใช้งาน ImageAccordion (รูป placeholder จาก picsum) — ไม่ได้ถูก import ในหน้าไหน */
const demoItems: ImageAccordionItem[] = [
  { id: 1, title: "เรื่องตัวอย่างที่หนึ่ง", subtitle: "ผู้เขียน ก", imageUrl: "https://picsum.photos/seed/acc-1/600/900", badge: "#1" },
  { id: 2, title: "เรื่องตัวอย่างที่สอง", subtitle: "ผู้เขียน ข", imageUrl: "https://picsum.photos/seed/acc-2/600/900" },
  { id: 3, title: "เรื่องตัวอย่างที่สาม", subtitle: "ผู้เขียน ค", imageUrl: "https://picsum.photos/seed/acc-3/600/900" },
  { id: 4, title: "เรื่องตัวอย่างที่สี่", subtitle: "ผู้เขียน ง", imageUrl: "https://picsum.photos/seed/acc-4/600/900" },
  { id: 5, title: "เรื่องตัวอย่างที่ห้า", subtitle: "ผู้เขียน จ", imageUrl: "https://picsum.photos/seed/acc-5/600/900" },
];

export function ImageAccordionDemo() {
  return (
    <div className="mx-auto max-w-[1400px] p-8">
      <ImageAccordion items={demoItems} onActivate={(item) => console.log("open", item.id)} />
    </div>
  );
}
