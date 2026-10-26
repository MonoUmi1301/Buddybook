import { describe, expect, it } from "vitest";
import { toSafeChapterHtml, toSafeRichText } from "@/lib/richText";

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

describe("toSafeChapterHtml", () => {
  it("keeps what the chapter editor produces", () => {
    const html =
      '<p class="ql-align-center"><strong>หัว</strong> <span style="color: rgb(230, 0, 0);">แดง</span></p>' +
      '<hr class="scene-break"><p><img src="https://res.cloudinary.com/demo/image/upload/a.png"></p>' +
      '<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/abc"></iframe>' +
      '<ol><li data-list="bullet" class="ql-indent-1">ข้อ</li></ol>';
    const out = toSafeChapterHtml(html);
    expect(out).toContain('<p class="ql-align-center"><strong>หัว</strong>');
    expect(out).toContain('<hr class="scene-break" />');
    expect(out).toContain('<img src="https://res.cloudinary.com/demo/image/upload/a.png" />');
    expect(out).toContain('<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/abc">');
    expect(out).toContain('<li data-list="bullet" class="ql-indent-1">ข้อ</li>');
  });

  it("strips scripts, event handlers and javascript: URLs", () => {
    const out = toSafeChapterHtml(
      '<p onclick="alert(1)">a</p><img src=x onerror=alert(1)><script>alert(1)</script>' +
        '<svg onload=alert(1)></svg><a href="javascript:alert(1)">x</a><img src="javascript:alert(1)">' +
        '<style>body{display:none}</style><p style="position:fixed">b</p>'
    );
    expect(out).not.toMatch(/onclick|onerror|onload|<script|<svg|<style|javascript:|position/i);
    expect(out).toContain("<p>a</p>");
  });

  it("only allows YouTube/Vimeo iframes", () => {
    expect(toSafeChapterHtml('<iframe class="ql-video" src="https://evil.example/x"></iframe>')).not.toContain("evil.example");
    expect(toSafeChapterHtml('<iframe src="javascript:alert(1)"></iframe>')).not.toContain("javascript");
  });

  it("keeps legacy base64 images but leaves plain text as text", () => {
    expect(toSafeChapterHtml('<img src="data:image/png;base64,AAAA">')).toBe('<img src="data:image/png;base64,AAAA" />');
    expect(toSafeChapterHtml("a < b & c")).toBe("a &lt; b &amp; c");
    expect(toSafeChapterHtml("")).toBe("");
    expect(toSafeChapterHtml(null)).toBeNull();
  });
});
