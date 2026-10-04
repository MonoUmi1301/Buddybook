/**
 * เขียน OpenAPI spec ลงไฟล์ (สำหรับแนบรายงาน/นำเข้า Postman) — ตัวที่เสิร์ฟสดอยู่ที่ GET /api/v1/openapi.json
 *   npx tsx scripts/generate-openapi.ts [out=../../docs/openapi.json]
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "../src/app";
import { buildOpenApiSpec } from "../src/lib/openapi";

const out = path.resolve(process.argv[2] ?? path.join(__dirname, "../../../docs/openapi.json"));
const spec = buildOpenApiSpec(app);
fs.writeFileSync(out, JSON.stringify(spec, null, 2) + "\n");
const ops = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0);
console.log(`OpenAPI: ${ops} operations, ${Object.keys(spec.paths).length} paths → ${out}`);
process.exit(0);
