import { Avatar } from "@/components/ui/Avatar";

export interface CharacterIntroItem {
  id: string;
  role: string;
  name: string;
  avatarUrl?: string;
}

/** ส่วน "แนะนำตัวละคร" ในแท็บเรื่องย่อ — ต่อกับ character_nodes จาก GET /novels/:id (สูงสุด 8 ตัว)
 *  มือถือ: แถวเดียวเลื่อนแนวนอน (snap) ชิดขอบการ์ด / md ขึ้นไป: flex-wrap
 *  ไม่มีรูป → วงกลมสีธีม + ตัวอักษรแรกของชื่อ ผู้เรียกต้องซ่อน section เองถ้าไม่มีตัวละคร */
export function CharacterIntro({ characters }: { characters: CharacterIntroItem[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">แนะนำตัวละคร</h2>
      <ul className="-mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:flex-wrap md:gap-6 md:overflow-visible md:px-0 md:pb-0">
        {characters.map((c) => (
          <li key={c.id} className="flex w-20 shrink-0 snap-start flex-col items-center md:w-24">
            <Avatar src={c.avatarUrl} alt={c.name} size="xl" initialFallback className="ring-1 ring-neutral-200" />
            <p className="mt-2 line-clamp-2 w-full break-words text-center text-sm font-medium text-neutral-800">{c.name}</p>
            <p className="w-full truncate text-center text-xs text-neutral-500">{c.role}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
