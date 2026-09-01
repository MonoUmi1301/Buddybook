import { Avatar } from "@/components/ui/Avatar";

export interface CharacterIntroItem {
  id: string;
  role: string;
  name: string;
  avatarUrl?: string;
}

/** การ์ดสีขาว "แนะนำตัวละคร" ใน wf_novel_detail.png */
export function CharacterIntro({ characters }: { characters: CharacterIntroItem[] }) {
  return (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-center text-h3 text-neutral-900">แนะนำตัวละคร</h2>
      <div className="flex flex-wrap justify-center gap-8">
        {characters.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1.5">
            <Avatar src={c.avatarUrl} alt={c.name} size="lg" />
            <span className="text-sm font-medium text-neutral-800">{c.role}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
