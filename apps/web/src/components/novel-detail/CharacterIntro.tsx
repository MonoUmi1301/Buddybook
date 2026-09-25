import { Avatar } from "@/components/ui/Avatar";

export interface CharacterIntroItem {
  id: string;
  role: string;
  name: string;
  avatarUrl?: string;
}

/** การ์ด "แนะนำตัวละคร" — ต่อกับ character_nodes จาก GET /novels/:id (สูงสุด 8 ตัว) */
export function CharacterIntro({ characters }: { characters: CharacterIntroItem[] }) {
  return (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">แนะนำตัวละคร</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {characters.map((c) => (
          <li key={c.id} className="flex flex-col items-center gap-2 rounded-lg bg-neutral-50 px-2 py-4 text-center">
            <Avatar src={c.avatarUrl} alt={c.name} size="lg" />
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-medium text-neutral-800">{c.name}</p>
              <p className="text-xs text-primary-600">{c.role}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
