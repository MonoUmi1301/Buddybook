import { describe, expect, it } from "vitest";
import { app } from "@/app";
import { buildOpenApiSpec, listRoutes } from "@/lib/openapi";

/** gap 4.5 — spec สร้างจาก router จริง: ตรวจว่าครอบทุก route และระดับสิทธิ์ถูกต้อง */
describe("OpenAPI spec", () => {
  const spec = buildOpenApiSpec(app);
  const access = (path: string, method: string) =>
    (spec.paths[path]?.[method] as { "x-access": string } | undefined)?.["x-access"];

  it("is a valid OpenAPI 3 document covering every API route", () => {
    expect(spec.openapi).toBe("3.0.3");
    const ops = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
    expect(ops).toBe(listRoutes(app).length);
    expect(ops).toBeGreaterThan(100);
  });

  it("derives access levels from the middleware chain", () => {
    expect(access("/api/v1/novels/search", "get")).toBe("optional-auth");
    expect(access("/api/v1/novels/{novel_id}", "delete")).toBe("user");
    expect(access("/api/v1/admin/tags", "get")).toBe("public");
    expect(access("/api/v1/admin/support/tickets", "get")).toBe("admin");
    expect(access("/api/v1/internal/nlp/sentiment-callback", "post")).toBe("internal");
    expect(access("/api/v1/auth/login", "post")).toBe("public");
    expect(access("/api/v1/recommendations", "get")).toBe("user");
    expect(Object.keys(spec.paths).some((p) => p.length > 1 && p.endsWith("/"))).toBe(false);
  });

  it("documents path parameters", () => {
    const op = spec.paths["/api/v1/support/tickets/{ticket_id}/messages"]?.post as { parameters: { name: string }[] };
    expect(op.parameters.map((p) => p.name)).toEqual(["ticket_id"]);
  });
});
