import { describe, expect, it } from "vitest";
import { buildTeaser } from "@/modules/chapters/chapters.service";

describe("buildTeaser (ตัวอย่างของตอนติดเหรียญ)", () => {
  it("never gives away a short paid chapter in full", () => {
    const full = "เนื้อหาลับเฉพาะคนที่ปลดล็อก";
    const teaser = buildTeaser(`<p>${full}</p>`);
    expect(teaser).not.toBe(full);
    expect(teaser.replace("…", "").length).toBeLessThanOrEqual(Math.floor(full.length * 0.3));
  });

  it("caps long chapters at 200 characters", () => {
    const teaser = buildTeaser(`<p>${"ก".repeat(5000)}</p>`);
    expect(teaser.replace("…", "").length).toBeLessThanOrEqual(200);
    expect(teaser.endsWith("…")).toBe(true);
  });

  it("returns empty for empty content", () => {
    expect(buildTeaser("")).toBe("");
    expect(buildTeaser("<p></p>")).toBe("");
  });
});
