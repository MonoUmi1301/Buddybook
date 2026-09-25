import { describe, expect, it } from "vitest";
import { sanitizeCardText, stripUnsafeText } from "@/modules/gifts/gift-sanitize";
import { splitGiftFee } from "@/modules/gifts/gift-fee";
import { startOfThaiMonth } from "@/modules/gifts/gifts.service";

function rejectReason(text: string) {
  const r = sanitizeCardText(text, 500);
  return r.ok ? null : r.reason;
}

function cleaned(text: string) {
  const r = sanitizeCardText(text, 500);
  if (!r.ok) throw new Error(`unexpectedly rejected: ${r.reason}`);
  return r.value;
}

describe("sanitizeCardText", () => {
  it("strips HTML tags, script bodies and comments", () => {
    expect(cleaned("<b>สู้ ๆ</b> นะคะ<script>alert(1)</script><!-- x -->")).toBe("สู้ ๆ นะคะ");
    expect(cleaned('<img src=x onerror="alert(1)">ขอบคุณ')).toBe("ขอบคุณ");
  });

  it("strips emoji including ZWJ sequences, flags, skin tones and keycaps", () => {
    expect(cleaned("ชอบมาก\u{1F60D}\u{1F44D}\u{1F3FD}")).toBe("ชอบมาก");
    expect(cleaned("family \u{1F468}\u200D\u{1F469}\u200D\u{1F467} flag \u{1F1F9}\u{1F1ED} 1\uFE0F\u20E3")).toBe("family flag 1");
    expect(cleaned("\u2764\uFE0F")).toBeNull();
  });

  it("keeps Thai text, numbers and normal punctuation", () => {
    expect(cleaned("ตอนที่ 12 สนุกมาก! รอตอน 13 นะ (ขอบคุณค่ะ)")).toBe("ตอนที่ 12 สนุกมาก! รอตอน 13 นะ (ขอบคุณค่ะ)");
  });

  it("blocks links, including bare domains", () => {
    expect(rejectReason("ไปที่ https://evil.example")).toBe("link");
    expect(rejectReason("ดูที่ www.example.org นะ")).toBe("link");
    expect(rejectReason("แวะ mysite.com ได้")).toBe("link");
    expect(rejectReason("แวะ mysite . com ได้")).toBe("link");
  });

  it("blocks email addresses", () => {
    expect(rejectReason("ติดต่อ fan@example.com")).toBe("email");
    expect(rejectReason("ติดต่อ fan (at) example.com")).toBe("email");
  });

  it("blocks phone numbers in several formats, including Thai digits", () => {
    expect(rejectReason("โทร 0812345678")).toBe("phone");
    expect(rejectReason("โทร 081-234-5678")).toBe("phone");
    expect(rejectReason("+66 81 234 5678")).toBe("phone");
    expect(rejectReason("โทร ๐๘๑๒๓๔๕๖๗๘")).toBe("phone");
    expect(rejectReason("อ่านมา 300 ตอนแล้ว ปี 2026")).toBeNull();
  });

  it("masks profanity in Thai and English without touching innocent words", () => {
    expect(cleaned("what the fuck")).toBe("what the ****");
    expect(cleaned("Fucking good")).toBe("******* good");
    expect(cleaned("เหี้ยมาก")).toBe("*****มาก");
    expect(cleaned("หีบสมบัติ สัดส่วนดี Dickens")).toBe("หีบสมบัติ สัดส่วนดี Dickens");
  });

  it("enforces max length after cleaning, counted in characters", () => {
    expect(sanitizeCardText("ก".repeat(500), 500).ok).toBe(true);
    const tooLong = sanitizeCardText("ก".repeat(501), 500);
    expect(tooLong.ok ? null : tooLong.reason).toBe("too_long");
    // emoji ที่ถูกลบไม่นับรวมเพดาน
    expect(sanitizeCardText("ก".repeat(500) + "\u{1F600}".repeat(20), 500).ok).toBe(true);
  });

  it("collapses whitespace and returns null for empty input", () => {
    expect(stripUnsafeText("  a   b \n\n\n\n c  ")).toBe("a b\n\nc");
    expect(cleaned("   ")).toBeNull();
    expect(sanitizeCardText(undefined, 10)).toEqual({ ok: true, value: null, masked: false });
  });
});

describe("splitGiftFee", () => {
  it("rounds the fee down so the author keeps the remainder", () => {
    expect(splitGiftFee(10, 10)).toEqual({ fee: 1, net: 9 });
    expect(splitGiftFee(15, 10)).toEqual({ fee: 1, net: 14 });
    expect(splitGiftFee(9, 10)).toEqual({ fee: 0, net: 9 });
  });

  it("handles fractional percentages without float drift", () => {
    expect(splitGiftFee(200, 10.5)).toEqual({ fee: 21, net: 179 });
    expect(splitGiftFee(1000, 33.33)).toEqual({ fee: 333, net: 667 });
  });

  it("supports 0% and 100%", () => {
    expect(splitGiftFee(500, 0)).toEqual({ fee: 0, net: 500 });
    expect(splitGiftFee(500, 100)).toEqual({ fee: 500, net: 0 });
  });

  it("fee + net always equals gross", () => {
    for (let gross = 1; gross <= 3000; gross += 7) {
      for (const pct of [0, 5, 10, 12.5, 30, 99]) {
        const { fee, net } = splitGiftFee(gross, pct);
        expect(fee + net).toBe(gross);
        expect(fee).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rejects invalid input", () => {
    expect(() => splitGiftFee(0, 10)).toThrow(RangeError);
    expect(() => splitGiftFee(1.5, 10)).toThrow(RangeError);
    expect(() => splitGiftFee(10, 101)).toThrow(RangeError);
  });
});

describe("startOfThaiMonth", () => {
  it("uses the Thai calendar, not UTC", () => {
    // 1 ต.ค. 01:00 เวลาไทย = 30 ก.ย. 18:00 UTC — ต้องนับเป็นเดือนตุลาคมแล้ว
    expect(startOfThaiMonth(new Date("2026-09-30T18:00:00Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    // 30 ก.ย. 23:00 เวลาไทย = ยังเป็นเดือนกันยายน
    expect(startOfThaiMonth(new Date("2026-09-30T16:00:00Z")).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });
});
