import { withNeo4jSession } from "@/lib/neo4j";
import { prisma } from "@/lib/prisma";

interface GraphRow {
  novel_id: string;
}

interface HydratedNovel {
  novel_id: string;
  title: string;
  cover_image_url: string | null;
  view_count: number;
  author: { username: string; pen_name: string | null };
}

async function hydrate(rows: GraphRow[]): Promise<HydratedNovel[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.novel_id);

  const novels = await prisma.novel.findMany({
    where: { novel_id: { in: ids }, visibility: "published" },
    select: {
      novel_id: true,
      title: true,
      cover_image_url: true,
      view_count: true,
      author: { select: { username: true, pen_name: true } },
    },
  });
  const novelMap = new Map(novels.map((n) => [n.novel_id, { ...n, view_count: Number(n.view_count) }]));

  // รักษาลำดับตามที่ query จาก Neo4j คืนมา (ตัด id ที่ไม่พบใน Postgres ทิ้ง — เช่น unpublish ไปแล้ว)
  return ids.map((id) => novelMap.get(id)).filter((n): n is HydratedNovel => Boolean(n));
}

const EMPTY_RECOMMENDATIONS = { content_based: [], collaborative: [], underrated: [] } as const;

/**
 * Reference implementation — GET /recommendations
 * รัน 3 กลยุทธ์ตาม recommendation_graph_import.cql (Q1/Q2/Q3) พร้อมกัน แล้ว hydrate ด้วยข้อมูล
 * เต็มจาก PostgreSQL (Neo4j เก็บแค่ id/title แบบ denormalized ตาม System Architecture doc)
 *
 * audit fix — Neo4j เป็น derived store แยกต่างหาก (ดู lib/neo4j.ts) ถ้าล่ม/ต่อไม่ได้ไม่ควรทำให้
 * endpoint นี้ 500 ทั้งที่ Postgres (source of truth) ยังปกติดี — degrade เป็นผลลัพธ์ว่างแทน ซึ่ง
 * หน้าแรกฝั่ง frontend มี empty-state ที่เป็นมิตรรองรับอยู่แล้ว (ไม่ต้องเพิ่ม UI ใหม่)
 */
export async function getRecommendations(user_id: string) {
  let graphRows: { contentBasedRows: GraphRow[]; collaborativeRows: GraphRow[]; underratedRows: GraphRow[] };
  try {
    graphRows = await withNeo4jSession(async (session) => {
    // Q1 — Content-based: แท็กที่ user สนใจ ตรงกับนิยายที่ยังไม่เคยอ่าน
    const contentBased = await session.run(
      `MATCH (u:User {user_id: $user_id})-[:INTERESTED_IN]->(t:Tag)<-[:HAS_TAG]-(n:Novel)
       WHERE NOT (u)-[:READ]->(n)
       RETURN DISTINCT n.novel_id AS novel_id
       LIMIT 10`,
      { user_id }
    );

    // Q2 — Collaborative + Sentiment-weighted: หา user (a) ที่ให้คะแนนนิยายเรื่องเดียวกับเรา
    // ใกล้เคียงกัน (±0.05) แล้วแนะนำเรื่องอื่นที่ a ให้คะแนนบวก (>0.5) และมีแท็กร่วมกับเรื่องที่
    // อ่านด้วยกัน — เป็นหัวใจของระบบตาม Proposal_montira.docx (ลด popularity bias ด้วย sentiment)
    const collaborative = await session.run(
      `MATCH (a:User)-[r1:READ]->(shared:Novel)<-[r2:READ]-(b:User {user_id: $user_id})
       WHERE a <> b AND r1.sentiment_score IS NOT NULL AND r2.sentiment_score IS NOT NULL
         AND abs(r1.sentiment_score - r2.sentiment_score) <= 0.05
       MATCH (a)-[r3:READ]->(candidate:Novel)
       WHERE r3.sentiment_score > 0.5
         AND candidate <> shared
         AND NOT (b)-[:READ]->(candidate)
       MATCH (shared)-[:HAS_TAG]->(tag:Tag)<-[:HAS_TAG]-(candidate)
       RETURN DISTINCT candidate.novel_id AS novel_id
       LIMIT 10`,
      { user_id }
    );

    // Q3 — Popularity Bias Reduction: นิยายที่คะแนนความรู้สึกเฉลี่ยสูงแต่มีคนอ่านน้อย
    // (ไม่นับเรื่องที่ user นี้อ่านไปแล้ว) — ตรงกับ "แก้ปัญหา popularity bias" ที่เป็นแก่นของ thesis
    const underrated = await session.run(
      `MATCH (u:User)-[r:READ]->(n:Novel)
       WHERE r.sentiment_score IS NOT NULL
         AND NOT (:User {user_id: $user_id})-[:READ]->(n)
       WITH n, count(r) AS read_count, avg(r.sentiment_score) AS avg_sentiment
       WHERE avg_sentiment >= 0.5
       RETURN n.novel_id AS novel_id
       ORDER BY avg_sentiment DESC, read_count ASC
       LIMIT 10`,
      { user_id }
    );

      return {
        contentBasedRows: contentBased.records.map((r) => ({ novel_id: r.get("novel_id") as string })),
        collaborativeRows: collaborative.records.map((r) => ({ novel_id: r.get("novel_id") as string })),
        underratedRows: underrated.records.map((r) => ({ novel_id: r.get("novel_id") as string })),
      };
    });
  } catch (err) {
    console.error("Neo4j recommendations query failed, degrading to empty result:", err);
    return EMPTY_RECOMMENDATIONS;
  }

  const { contentBasedRows, collaborativeRows, underratedRows } = graphRows;
  const [content_based, collaborative, underrated] = await Promise.all([
    hydrate(contentBasedRows),
    hydrate(collaborativeRows),
    hydrate(underratedRows),
  ]);

  return { content_based, collaborative, underrated };
}

/**
 * Reference implementation — POST /internal/recommendations/sync
 * รี-sync ข้อมูลทั้งหมดจาก PostgreSQL เข้า Neo4j ใหม่ทั้งกราฟ (ใช้ตอน backfill/seed ครั้งแรก
 * หรือซ่อม drift ระหว่างสอง store) endpoint ที่ mutation จริงเรียก sync เฉพาะจุดของตัวเองอยู่แล้ว
 * (ดู users.controller.ts setInterests, novels.service.ts createNovel/updateNovel/createReview)
 * อันนี้จึงเป็นแค่ fallback ให้ครบทั้งระบบ ไม่ต้องเรียกบ่อย
 */
export async function fullResync() {
  const { syncUserNode, syncInterestedIn, syncNovelTags, syncReadEdge } = await import("@/lib/graphSync");

  const users = await prisma.user.findMany({ select: { user_id: true, username: true } });
  for (const u of users) await syncUserNode(u.user_id, u.username);

  const interests = await prisma.userInterest.findMany({
    select: { user_id: true, tag: { select: { name: true } } },
  });
  const interestsByUser = new Map<string, string[]>();
  for (const i of interests) {
    const list = interestsByUser.get(i.user_id) ?? [];
    list.push(i.tag.name);
    interestsByUser.set(i.user_id, list);
  }
  for (const [user_id, tagNames] of interestsByUser) {
    const username = users.find((u) => u.user_id === user_id)?.username ?? "";
    await syncInterestedIn(user_id, username, tagNames);
  }

  const novels = await prisma.novel.findMany({
    where: { visibility: "published" },
    select: { novel_id: true, title: true, novel_tags: { select: { tag: { select: { name: true } } } } },
  });
  for (const n of novels) {
    await syncNovelTags(
      n.novel_id,
      n.title,
      n.novel_tags.map((nt) => nt.tag.name)
    );
  }

  const reviews = await prisma.review.findMany({
    select: { user_id: true, novel_id: true, sentiment_score: true },
  });
  for (const r of reviews) {
    await syncReadEdge(r.user_id, r.novel_id, r.sentiment_score);
  }

  return {
    users_synced: users.length,
    novels_synced: novels.length,
    reviews_synced: reviews.length,
  };
}
