/**
 * ตารางสำหรับเล่มรายงาน: ขั้วความรู้สึกของรีวิว "ค่าดิบ" (จากข้อความ/โมเดล) เทียบ "หลังผสมดาว" แยกตามดาว
 * และจำนวนข้อความต่อป้ายเป้าหมาย — อ่านอย่างเดียว พิมพ์เป็นตาราง Markdown
 *
 *   cd apps/api && npm run report:sentiment
 *
 * หน้าหลังบ้าน /admin/sentiment แสดงตัวเลขชุดเดียวกัน (ไม่นับข้อความของนักเขียนบนนิยายตัวเอง)
 */
import { prisma } from "@/lib/prisma";

const f2 = (v: number | null) => (v === null ? "-" : (v >= 0 ? "+" : "") + v.toFixed(3));

async function main() {
  const byRating = await prisma.$queryRaw<
    { rating: number | null; n: number; pos: number; neutral: number; neg: number; raw: number | null; blended: number | null; raw_sd: number | null; blended_sd: number | null }[]
  >`
    SELECT r.rating::int AS rating, count(*)::int AS n,
           count(*) FILTER (WHERE r.sentiment_label = 'pos')::int AS pos,
           count(*) FILTER (WHERE r.sentiment_label = 'neutral')::int AS neutral,
           count(*) FILTER (WHERE r.sentiment_label = 'neg')::int AS neg,
           avg(r.sentiment_polarity)::float AS raw, avg(r.blended_polarity)::float AS blended,
           stddev_samp(r.sentiment_polarity)::float AS raw_sd, stddev_samp(r.blended_polarity)::float AS blended_sd
      FROM reviews r JOIN novels n ON n.novel_id = r.novel_id
     WHERE r.user_id <> n.author_id AND r.sentiment_polarity IS NOT NULL
     GROUP BY r.rating ORDER BY r.rating DESC NULLS LAST`;

  // ความสอดคล้องกับดาว: ข้อความบวก (ค่าดิบ > 0.5) แต่ให้ ≤ 3 ดาว — เคสที่การผสมดาวช่วยแก้
  const [mismatch] = await prisma.$queryRaw<{ n: number; raw: number | null; blended: number | null }[]>`
    SELECT count(*)::int AS n, avg(sentiment_polarity)::float AS raw, avg(blended_polarity)::float AS blended
      FROM reviews WHERE rating <= 3 AND sentiment_polarity > 0.5`;

  const tags = await prisma.$queryRaw<{ source: string; target: string; n: number; multi: number }[]>`
    SELECT source, coalesce(tag, 'none') AS target, count(*)::int AS n,
           count(*) FILTER (WHERE cardinality(targets) > 1)::int AS multi
      FROM (
        SELECT 'comment' AS source, sentiment_targets::text[] AS targets FROM comments WHERE sentiment_label IS NOT NULL
        UNION ALL
        SELECT 'review', sentiment_targets::text[] FROM reviews WHERE sentiment_label IS NOT NULL
      ) x LEFT JOIN LATERAL unnest(targets) AS t(tag) ON true
     GROUP BY source, coalesce(tag, 'none') ORDER BY 1, 2`;

  console.log("## รีวิวแยกตามดาว: ค่าดิบ vs หลังผสมดาว\n");
  console.log("blended = 0.5 × ค่าดิบ + 0.5 × (ดาว − 3) / 2 (ไม่มีดาว = ค่าดิบ)\n");
  console.log("| ดาว | รีวิว | pos | neutral | neg | ค่าดิบเฉลี่ย (SD) | หลังผสมดาว (SD) |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of byRating) {
    console.log(
      `| ${r.rating ?? "ไม่ให้ดาว"} | ${r.n} | ${r.pos} | ${r.neutral} | ${r.neg} | ${f2(r.raw)} (${r.raw_sd?.toFixed(3) ?? "-"}) | ${f2(r.blended)} (${r.blended_sd?.toFixed(3) ?? "-"}) |`
    );
  }
  console.log(
    `\nข้อความบวก (ค่าดิบ > 0.5) แต่ให้ ≤ 3 ดาว: ${mismatch.n} รีวิว — ค่าดิบเฉลี่ย ${f2(mismatch.raw)} → หลังผสมดาว ${f2(mismatch.blended)}\n`
  );
  console.log("## ป้ายเป้าหมาย (ข้อความเดียวมีได้หลายป้าย จึงนับซ้ำได้)\n");
  console.log("| แหล่ง | ป้าย | ข้อความ | ในนั้นมีหลายป้าย |");
  console.log("|---|---|---|---|");
  for (const t of tags) console.log(`| ${t.source} | ${t.target} | ${t.n} | ${t.multi} |`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
