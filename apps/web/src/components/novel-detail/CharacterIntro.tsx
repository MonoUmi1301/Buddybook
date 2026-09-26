import { Avatar } from "@/components/ui/Avatar";

export interface CharacterIntroItem {
  id: string;
  role: string;
  name: string;
  avatarUrl?: string;
}

/** ส่วน "แนะนำตัวละคร" ในแท็บเรื่องย่อ — ต่อกับ character_nodes จาก GET /novels/:id (สูงสุด 8 ตัว)
 *  รูปวงกลม 80px (มือถือ) / 96px (sm ขึ้นไป) ถ้าไม่มีรูป Avatar จะแสดงไอคอนแทน */
export function CharacterIntro({ characters }: { characters: CharacterIntroItem[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900">แนะนำตัวละคร</h2>
      <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 xl:grid-cols-6">
        {characters.map((c) => (
          <li key={c.id} className="flex min-w-0 flex-col items-center text-center">
            <Avatar src={c.avatarUrl} alt={c.name} size="xl" className="shadow-sm ring-1 ring-neutral-200" />
            <p className="mt-2 line-clamp-2 w-full break-words text-sm font-medium text-neutral-800">{c.name}</p>
            <p className="text-xs text-neutral-500">{c.role}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
