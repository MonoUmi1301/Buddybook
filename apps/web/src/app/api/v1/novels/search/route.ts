import { forwardToApi } from "@/lib/api/proxy";
import { parseSearchParams } from "@/lib/api/validate";
import { novelsSearchQuerySchema } from "@/lib/api/schemas";
import { getAccessToken } from "@/lib/api/auth";

// GET /api/v1/novels/search?q=&genre_ids=&pairing_ids=&fandom_ids=&tag_ids=&author=&workType=&page=&mine=
// — Public (personalized ถ้าล็อกอิน)
export async function GET(request: Request) {
  const parsed = parseSearchParams(request, novelsSearchQuerySchema);
  if ("error" in parsed) return parsed.error;

  const searchParams = new URLSearchParams();
  if (parsed.data.q) searchParams.set("q", parsed.data.q);
  if (parsed.data.field) searchParams.set("field", parsed.data.field);
  if (parsed.data.genre_ids) searchParams.set("genre_ids", parsed.data.genre_ids);
  if (parsed.data.sub_genre_ids) searchParams.set("sub_genre_ids", parsed.data.sub_genre_ids);
  if (parsed.data.pairing_ids) searchParams.set("pairing_ids", parsed.data.pairing_ids);
  if (parsed.data.fandom_ids) searchParams.set("fandom_ids", parsed.data.fandom_ids);
  if (parsed.data.tag_ids) searchParams.set("tag_ids", parsed.data.tag_ids);
  if (parsed.data.author) searchParams.set("author", parsed.data.author);
  if (parsed.data.status) searchParams.set("status", parsed.data.status);
  if (parsed.data.legal_status) searchParams.set("legal_status", parsed.data.legal_status);
  if (parsed.data.workType) searchParams.set("workType", parsed.data.workType);
  if (parsed.data.sort) searchParams.set("sort", parsed.data.sort);
  searchParams.set("page", String(parsed.data.page));
  if (parsed.data.mine) searchParams.set("mine", "true");

  return forwardToApi({ method: "GET", path: "/novels/search", token: getAccessToken(), searchParams });
}
