import { GuideLayout } from "@/components/guide/Guide";
import { FaqAccordion } from "@/components/ui/faq-chat-accordion";
import { getCurrentUser } from "@/lib/api/session";
import { FAQ_GROUPS } from "@/lib/faq";

export const metadata = { title: "คำถามที่พบบ่อย · BuddyBook" };

export default async function FaqPage() {
  const user = await getCurrentUser();
  return (
    <GuideLayout
      user={user}
      current="/faq"
      title="คำถามที่พบบ่อย"
      toc={FAQ_GROUPS.map((g) => ({ id: g.id, label: g.title }))}
      intro={<>กดที่คำถามเพื่อดูคำตอบ คำตอบไหนมีวิธีทำละเอียด จะมีลิงก์พาไปคู่มือ</>}
    >
      {FAQ_GROUPS.map((group) => (
        <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-24">
          <h2 id={`${group.id}-title`} className="text-h3 text-neutral-900">
            {group.title}
          </h2>
          <div className="mt-4 rounded-3xl border border-primary-200 bg-primary-50/50 dark:bg-transparent">
            <FaqAccordion data={group.items} timestamp={null} className="py-4" />
          </div>
        </section>
      ))}
    </GuideLayout>
  );
}
