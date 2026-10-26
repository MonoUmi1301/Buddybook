/**
 * ล้างอีเมลปลอมของบัญชี LINE เดิม (line_<LINE user id>@line.buddybook.local — สร้างตอน LINE ไม่ส่งอีเมลมา)
 * รันหลัง migration 20261027090000_line_user_id_nullable_email
 *
 *   cd apps/api && npm run db:line-emails              ← เขียนจริง
 *   cd apps/api && npm run db:line-emails -- --dry-run ← แสดงสิ่งที่จะเปลี่ยน แล้ว rollback
 *
 * ต่อบัญชี: ดึง LINE user id จากอีเมล → ใส่ users.line_user_id (ถ้ายังว่าง และไม่มีบัญชีอื่นใช้ id นี้อยู่)
 * แล้วตั้ง email = null — ล็อกอินด้วย LINE ครั้งถัดไปจะเจอบัญชีเดิมจาก line_user_id และถูกพาไป /complete-profile
 * (refresh token ที่ยังใช้อยู่ก็ได้ access token ที่มี email_required ภายใน ~15 นาที)
 * รันซ้ำได้ปลอดภัย — รอบถัดไปไม่เหลืออีเมลแบบนี้ให้แก้ (0 แถว)
 *
 * สำรองฐานข้อมูลก่อนรันบนเครื่องจริง: npm run db:backup (จาก root)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const FAKE_LINE_EMAIL = /^line_(.+)@line\.buddybook\.local$/i;

class DryRunRollback extends Error {}

/** อีเมลถูกเก็บเป็นตัวพิมพ์เล็ก (normalizeEmail) แต่ LINE user id เป็น "U" + hex 32 ตัว — คืนตัว U ให้ถูก
 *  ใช้ oauth_id เดิม (ตัวพิมพ์ถูกต้องแน่นอน) ถ้าตรงกัน */
function lineIdFromEmail(raw: string, oauth: { oauth_provider: string | null; oauth_id: string | null }): string {
  if (oauth.oauth_provider === "line" && oauth.oauth_id?.toLowerCase() === raw.toLowerCase()) return oauth.oauth_id;
  return /^u[0-9a-f]{32}$/.test(raw) ? `U${raw.slice(1)}` : raw;
}

async function main() {
  const report: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { email: { startsWith: "line_", mode: "insensitive" } },
        select: { user_id: true, username: true, email: true, line_user_id: true, oauth_provider: true, oauth_id: true },
      });

      for (const user of users) {
        const raw = user.email?.match(FAKE_LINE_EMAIL)?.[1];
        if (!raw) continue; // อีเมลจริงที่บังเอิญขึ้นต้นด้วย line_ — ไม่แตะ
        const sub = lineIdFromEmail(raw, user);

        let line_user_id = user.line_user_id;
        if (!line_user_id) {
          const owner = await tx.user.findUnique({ where: { line_user_id: sub }, select: { user_id: true } });
          if (owner && owner.user_id !== user.user_id) {
            report.push(`! ${user.username}: LINE id ${sub} ผูกกับบัญชีอื่นอยู่แล้ว — ล้างอีเมลแต่ไม่ใส่ line_user_id`);
          } else {
            line_user_id = sub;
          }
        } else if (line_user_id !== sub) {
          report.push(`! ${user.username}: line_user_id เดิม (${line_user_id}) ไม่ตรงกับอีเมล (${sub}) — คงค่าเดิม`);
        }

        await tx.user.update({
          where: { user_id: user.user_id },
          data: { email: null, line_user_id, updated_at: new Date() },
        });
        report.push(`- ${user.username}: email → null, line_user_id = ${line_user_id ?? "(ว่าง)"}`);
      }

      if (dryRun) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  const changed = report.filter((line) => line.startsWith("- ")).length;
  console.log(`${dryRun ? "[dry-run — rollback แล้ว ไม่มีอะไรถูกเขียน] " : ""}line-email-backfill: ${changed} บัญชี`);
  for (const line of report) console.log(line);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
