import type { Express, Router } from "express";

/**
 * gap 4.5 — OpenAPI 3.0 spec ที่สร้างจาก router ของ Express ตอนรันจริง (Proposal 3.4.2 "API Specification ตามมาตรฐาน OpenAPI")
 * ไม่ต้องเขียน yaml เองแล้วคอยตามแก้ — เพิ่ม/ลบ route เมื่อไหร่ spec เปลี่ยนตามเอง ไม่มีทาง drift
 * ระดับสิทธิ์อ่านจากชื่อ middleware ที่ครอบ route (requireAuth / requireAdmin / requireInternalService)
 * รายละเอียด body/response ดูได้จาก zod schema ใน controller แต่ละตัว และ API_Endpoints.md
 */

type Access = "public" | "optional-auth" | "user" | "admin" | "internal";

export interface RouteInfo {
  method: string;
  path: string;
  access: Access;
}

interface Layer {
  name: string;
  regexp: RegExp & { fast_slash?: boolean };
  route?: { path: string; methods: Record<string, boolean>; stack: { name: string }[] };
  handle: Router & { stack?: Layer[] };
}

const ACCESS_RANK: Record<Access, number> = { public: 0, "optional-auth": 1, user: 2, admin: 3, internal: 4 };

function accessFromNames(names: string[], inherited: Access): Access {
  let access = inherited;
  const bump = (a: Access) => {
    if (ACCESS_RANK[a] > ACCESS_RANK[access]) access = a;
  };
  for (const n of names) {
    if (n === "requireInternalService") bump("internal");
    else if (n === "requireAdmin") bump("admin");
    else if (n === "requireAuth") bump("user");
    else if (n === "attachUserIfPresent") bump("optional-auth");
  }
  return access;
}

/** "^\/novels\/?(?=\/|$)" → "/novels" (Express 4 เก็บ mount path ของ sub-router ไว้เป็น regexp) */
function mountPath(layer: Layer): string {
  if (layer.regexp.fast_slash) return "";
  const src = layer.regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\//g, "/");
  return src === "/" ? "" : src;
}

function walk(stack: Layer[], prefix: string, inherited: Access, out: RouteInfo[]) {
  let access = inherited;
  for (const layer of stack) {
    if (layer.route) {
      const routeAccess = accessFromNames(layer.route.stack.map((s) => s.name), access);
      for (const method of Object.keys(layer.route.methods)) {
        // router.get("/") ใต้ mount "/recommendations" → "/recommendations" (ไม่มี / ต่อท้าย)
        const full = (prefix + layer.route.path).replace(/(.)\/$/, "$1");
        out.push({ method: method.toUpperCase(), path: full, access: routeAccess });
      }
    } else if (layer.name === "router" && layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), access, out);
    } else {
      // router.use(requireAuth) — มีผลกับทุก route ที่ประกาศหลังจากนี้ใน router เดียวกัน
      access = accessFromNames([layer.name], access);
    }
  }
}

export function listRoutes(app: Express): RouteInfo[] {
  const stack = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  const out: RouteInfo[] = [];
  walk(stack, "", "public", out);
  // ตัด route ที่ไม่ใช่ API (เช่น 404 handler) ออก, เรียงให้อ่านง่ายและ diff นิ่ง
  return out
    .filter((r) => r.path.startsWith("/api/v1") || r.path === "/health" || r.path.startsWith("/health/"))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

const ACCESS_LABEL: Record<Access, string> = {
  public: "สาธารณะ",
  "optional-auth": "สาธารณะ (ล็อกอินแล้วได้ข้อมูลเพิ่ม)",
  user: "ต้องล็อกอิน",
  admin: "แอดมินเท่านั้น",
  internal: "บริการภายใน (x-internal-token)",
};

export function buildOpenApiSpec(app: Express, version = "1.0.0") {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of listRoutes(app)) {
    const oaPath = r.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const params = [...r.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string", ...(m[1].endsWith("_id") && m[1] !== "tag_id" ? { format: "uuid" } : {}) },
    }));
    const segments = r.path.replace(/^\/api\/v1\//, "").split("/");
    const tag = segments[0] === "me" || segments[0] === "admin" || segments[0] === "internal" ? `${segments[0]}/${segments[1] ?? ""}` : segments[0];
    const security =
      r.access === "user" || r.access === "admin"
        ? [{ bearerAuth: [] }]
        : r.access === "internal"
          ? [{ internalToken: [] }]
          : r.access === "optional-auth"
            ? [{}, { bearerAuth: [] }]
            : [];
    paths[oaPath] ??= {};
    paths[oaPath][r.method.toLowerCase()] = {
      tags: [tag || "system"],
      summary: `${r.method} ${r.path}`,
      description: ACCESS_LABEL[r.access],
      ...(params.length ? { parameters: params } : {}),
      security,
      "x-access": r.access,
      responses: {
        "200": { description: "สำเร็จ" },
        ...(r.access !== "public" ? { "401": { description: "ไม่ได้ล็อกอิน / token ไม่ถูกต้อง" } } : {}),
        ...(r.access === "admin" ? { "403": { description: "ไม่ใช่แอดมิน" } } : {}),
        "400": { description: "ข้อมูลไม่ผ่านการตรวจสอบ (zod)" },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "BuddyBook API",
      version,
      description:
        "สร้างอัตโนมัติจาก router ของ Express (apps/api/src/lib/openapi.ts) — รายละเอียด body ดู zod schema ใน controller และ API_Endpoints.md",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        internalToken: { type: "apiKey", in: "header", name: "x-internal-token" },
      },
    },
    paths,
  };
}

/** หน้า Swagger UI — โหลดสคริปต์จาก CDN เฉพาะหน้านี้ (CSP ของหน้านี้ตั้งแยกใน app.ts) */
export const SWAGGER_HTML = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BuddyBook API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
<script>window.ui = SwaggerUIBundle({ url: "/api/v1/openapi.json", dom_id: "#swagger", deepLinking: true });</script>
</body></html>`;
