import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, resendSend, gmailSend } = vi.hoisted(() => ({
  env: { RESEND_API_KEY: "", RESEND_FROM_EMAIL: "BuddyBook <no-reply@buddybook.tech>", GMAIL_USER: "", GMAIL_APP_PASSWORD: "" },
  resendSend: vi.fn(),
  gmailSend: vi.fn(),
}));

vi.mock("@/config/env", () => ({ env }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: gmailSend }) } }));

import { sendOtpEmail } from "@/lib/email";

function configure({ resend, gmail }: { resend: boolean; gmail: boolean }) {
  env.RESEND_API_KEY = resend ? "re_test" : "";
  env.GMAIL_USER = gmail ? "buddybook@gmail.com" : "";
  env.GMAIL_APP_PASSWORD = gmail ? "app-password" : "";
}

describe("sendEmail provider order", () => {
  beforeEach(() => {
    resendSend.mockReset().mockResolvedValue({ data: { id: "1" }, error: null });
    gmailSend.mockReset().mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("uses Resend first and does not touch Gmail when it succeeds", async () => {
    configure({ resend: true, gmail: true });
    await sendOtpEmail("reader@example.com", "123456");
    expect(resendSend).toHaveBeenCalledOnce();
    expect(resendSend.mock.calls[0][0]).toMatchObject({ from: env.RESEND_FROM_EMAIL, to: "reader@example.com" });
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("falls back to Gmail when Resend returns an API error", async () => {
    configure({ resend: true, gmail: true });
    resendSend.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    await sendOtpEmail("reader@example.com", "123456");
    expect(gmailSend).toHaveBeenCalledOnce();
  });

  it("falls back to Gmail when the Resend call throws", async () => {
    configure({ resend: true, gmail: true });
    resendSend.mockRejectedValue(new Error("fetch failed"));
    await sendOtpEmail("reader@example.com", "123456");
    expect(gmailSend).toHaveBeenCalledOnce();
  });

  it("fails when Resend fails and Gmail is not configured", async () => {
    configure({ resend: true, gmail: false });
    resendSend.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    await expect(sendOtpEmail("reader@example.com", "123456")).rejects.toThrow("domain not verified");
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("fails with the last error when every provider fails", async () => {
    configure({ resend: true, gmail: true });
    resendSend.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    gmailSend.mockRejectedValue(new Error("Invalid login"));
    await expect(sendOtpEmail("reader@example.com", "123456")).rejects.toThrow("Invalid login");
  });

  it("uses Gmail alone when Resend is not configured", async () => {
    configure({ resend: false, gmail: true });
    await sendOtpEmail("reader@example.com", "123456");
    expect(resendSend).not.toHaveBeenCalled();
    expect(gmailSend).toHaveBeenCalledOnce();
  });
});
