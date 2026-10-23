import { describe, expect, it } from "vitest";
import { toSafeRichText } from "@/lib/richText";

describe("toSafeRichText", () => {
  it("converts legacy plain text into escaped paragraphs", () => {
    expect(toSafeRichText("คำเตือน\nบรรทัด <b>สอง</b>\n\nสาม")).toBe(
      "<p>คำเตือน</p><p>บรรทัด &lt;b&gt;สอง&lt;/b&gt;</p><p><br /></p><p>สาม</p>"
    );
  });

  it("keeps Quill formatting and drops scripts, handlers and unsafe styles/links", () => {
    const out = toSafeRichText(
      '<p class="ql-align-center evil"><strong>หัว</strong> <span style="color: rgb(230, 0, 0); position: fixed">แดง</span></p>' +
        '<img src=x onerror=alert(1)><script>alert(1)</script>' +
        '<ol><li data-list="bullet">ข้อ</li></ol><a href="javascript:alert(1)">x</a>'
    )!;
    expect(out).toContain('<p class="ql-align-center"><strong>หัว</strong>');
    expect(out).toContain('style="color:rgb(230, 0, 0)"');
    expect(out).toContain('<li data-list="bullet">ข้อ</li>');
    expect(out).not.toMatch(/script|onerror|<img|position|javascript/);
  });

  it("returns null for empty editor output", () => {
    expect(toSafeRichText("<p><br></p>")).toBeNull();
    expect(toSafeRichText("")).toBeNull();
    expect(toSafeRichText(null)).toBeNull();
  });
});
