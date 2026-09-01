import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "@/config/env";

// เพิ่มภายหลัง (audit fix) — Resend sandbox mode (ยังไม่ verify โดเมน) ส่งได้แค่หาอีเมลเจ้าของ
// บัญชี Resend เองเท่านั้น ใช้จริงกับผู้ใช้ทั่วไปไม่ได้ จึงเพิ่ม Gmail SMTP เป็นทางเลือกที่ส่งได้
// จริงกับทุกอีเมลทันทีโดยไม่ต้อง verify โดเมน (ส่งผ่านบัญชี Gmail จริงโดยตรง) — ลอง Gmail ก่อนเสมอ
// ถ้าตั้งค่าไว้ (isGmailConfigured) แล้วค่อย fallback ไป Resend เผื่อวันหลัง verify โดเมนแล้วอยากสลับ
// กลับมาใช้ Resend เป็นหลัก ไม่ต้องแก้โค้ดที่เรียกใช้ sendOtpEmail/sendPasswordResetEmail เลย
function isGmailConfigured(): boolean {
  return Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
}

function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

export function isEmailConfigured(): boolean {
  return isGmailConfigured() || isResendConfigured();
}

let gmailTransport: Transporter | null = null;
function getGmailTransport(): Transporter {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
  }
  return gmailTransport;
}

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

class EmailSendError extends Error {}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/** ส่งอีเมลจริง — ลอง Gmail SMTP ก่อนเสมอถ้าตั้งค่าไว้ (ส่งได้ทุกอีเมล ไม่ต้อง verify โดเมน)
 *  ไม่งั้น fallback ไป Resend (ตอนนี้ยังอยู่ sandbox mode ส่งได้แค่อีเมลเจ้าของบัญชี Resend เอง
 *  จนกว่าจะ verify โดเมน) — throw เองถ้าส่งไม่สำเร็จทั้งสองทาง (Resend SDK ไม่ throw เองตอน API
 *  error คืน { data, error } ธรรมดา ถ้าไม่เช็คจะเข้าใจผิดว่าส่งสำเร็จทั้งที่จริง ๆ ไม่ถึงผู้รับเลย —
 *  เจอบั๊กนี้จริงตอนทดสอบครั้งแรก) */
async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  if (isGmailConfigured()) {
    try {
      await getGmailTransport().sendMail({
        from: `"BuddyBook" <${env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
      return;
    } catch (err) {
      console.error("[Gmail SMTP] send failed:", err);
      throw new EmailSendError(err instanceof Error ? err.message : "Gmail send failed");
    }
  }

  if (isResendConfigured()) {
    const { error } = await getResendClient().emails.send({ from: env.RESEND_FROM_EMAIL, to, subject, html });
    if (error) {
      console.error("[Resend] send failed:", error);
      throw new EmailSendError(error.message);
    }
    return;
  }

  throw new EmailSendError("No email provider configured");
}

/** ส่งรหัส OTP 6 หลักไปยืนยันอีเมลตอนสมัครสมาชิก — หมดอายุใน 10 นาที (ตรงกับ OTP_TTL_MS ใน auth.service.ts) */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendEmail({
    to,
    subject: `${code} คือรหัสยืนยันของคุณ — BuddyBook`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #5B3A29;">ยืนยันอีเมลของคุณ</h2>
        <p>กรอกรหัสด้านล่างนี้เพื่อยืนยันการสมัครสมาชิก BuddyBook</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #F0803C; margin: 24px 0;">${code}</p>
        <p style="color: #737373; font-size: 13px;">รหัสนี้จะหมดอายุใน 10 นาที หากคุณไม่ได้เป็นผู้ขอสมัครสมาชิก สามารถละเว้นอีเมลนี้ได้</p>
      </div>
    `,
  });
}

/** ส่งลิงก์ตั้งรหัสผ่านใหม่ — token เซ็นด้วย JWT_REFRESH_SECRET หมดอายุ 30 นาที (ดู auth.service.ts) */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  await sendEmail({
    to,
    subject: "ตั้งรหัสผ่านใหม่ — BuddyBook",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #5B3A29;">ตั้งรหัสผ่านใหม่</h2>
        <p>กดลิงก์ด้านล่างนี้เพื่อตั้งรหัสผ่านใหม่ของบัญชี BuddyBook</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background: #F0803C; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">ตั้งรหัสผ่านใหม่</a>
        </p>
        <p style="color: #737373; font-size: 13px;">ลิงก์นี้จะหมดอายุใน 30 นาที หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้</p>
      </div>
    `,
  });
}
