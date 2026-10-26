import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "@/config/env";

// เพิ่มภายหลัง (audit fix) — ช่องทางส่งอีเมลมี 2 ทาง: Resend (หลัก — โดเมน buddybook.tech verify แล้ว)
// กับ Gmail SMTP (สำรอง — ส่งผ่านบัญชี Gmail จริงโดยตรง) ลองตามลำดับเฉพาะทางที่ตั้งค่าไว้ ทางแรกล้มค่อยลองทางถัดไป
// ไม่ต้องแก้โค้ดที่เรียกใช้ sendOtpEmail/sendPasswordResetEmail เลย
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

async function sendViaResend({ to, subject, html }: SendEmailInput): Promise<void> {
  // Resend SDK ไม่ throw เองตอน API error คืน { data, error } ธรรมดา ถ้าไม่เช็คจะเข้าใจผิดว่าส่งสำเร็จ
  // ทั้งที่จริง ๆ ไม่ถึงผู้รับเลย — เจอบั๊กนี้จริงตอนทดสอบครั้งแรก
  const { error } = await getResendClient().emails.send({ from: env.RESEND_FROM_EMAIL, to, subject, html });
  if (error) throw new EmailSendError(error.message);
}

async function sendViaGmail({ to, subject, html }: SendEmailInput): Promise<void> {
  await getGmailTransport().sendMail({ from: `"BuddyBook" <${env.GMAIL_USER}>`, to, subject, html });
}

/** ส่งอีเมลจริง — Resend ก่อน ล้ม (API error/เครือข่าย) ค่อยลอง Gmail SMTP ข้ามทางที่ไม่ได้ตั้งค่า
 *  throw ถ้าทุกทางล้มหรือไม่ได้ตั้งค่าเลย */
async function sendEmail(input: SendEmailInput): Promise<void> {
  const providers: Array<[name: string, send: (input: SendEmailInput) => Promise<void>]> = [];
  if (isResendConfigured()) providers.push(["Resend", sendViaResend]);
  if (isGmailConfigured()) providers.push(["Gmail SMTP", sendViaGmail]);
  if (providers.length === 0) throw new EmailSendError("No email provider configured");

  let lastError: unknown;
  for (const [name, send] of providers) {
    try {
      await send(input);
      return;
    } catch (err) {
      console.error(`[${name}] send failed:`, err);
      lastError = err;
    }
  }
  throw new EmailSendError(lastError instanceof Error ? lastError.message : "Email send failed");
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

const PROVIDER_LABEL: Record<string, string> = { google: "Google", facebook: "Facebook", line: "LINE", apple: "Apple" };

/** ผลทดสอบ #6 — บัญชีที่สมัครด้วย Google/Facebook/LINE ไม่มีรหัสผ่าน กด "ลืมรหัสผ่าน" แล้วเดิมเงียบไป
 *  ผู้ใช้รออีเมลที่ไม่มีวันมา — ส่งอีเมลบอกว่าให้เข้าสู่ระบบด้วยช่องทางไหนแทน (ไม่มีลิงก์ตั้งรหัส) */
export async function sendOAuthSignInHintEmail(to: string, provider: string, loginUrl: string): Promise<void> {
  const label = PROVIDER_LABEL[provider] ?? provider;
  await sendEmail({
    to,
    subject: "วิธีเข้าสู่ระบบบัญชีของคุณ — BuddyBook",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #5B3A29;">บัญชีนี้ไม่ได้ใช้รหัสผ่าน</h2>
        <p>มีคนขอตั้งรหัสผ่านใหม่ให้อีเมลนี้ แต่บัญชี BuddyBook ของคุณสมัครด้วย <b>${label}</b> จึงไม่มีรหัสผ่านให้ตั้งใหม่</p>
        <p>เข้าสู่ระบบได้โดยกดปุ่ม "เข้าสู่ระบบด้วย ${label}" ที่หน้าเข้าสู่ระบบ</p>
        <p style="margin: 24px 0;">
          <a href="${loginUrl}" style="background: #F0803C; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">ไปหน้าเข้าสู่ระบบ</a>
        </p>
        <p style="color: #737373; font-size: 13px;">หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้ บัญชีของคุณยังปลอดภัย</p>
      </div>
    `,
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** อีเมลที่สร้างจากข้อมูลทดสอบ/seed (เช่น *@test.buddybook.local) ไม่มีกล่องจดหมายจริง — ไม่ต้องส่ง */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return Boolean(email && !email.endsWith(".buddybook.local"));
}

interface NovelModerationEmailInput {
  kind: "suspended" | "reinstated" | "upheld";
  novelTitle: string;
  /** เหตุผลที่แอดมินระงับ (แสดงเสมอ) */
  reason: string;
  /** หมายเหตุจากแอดมินตอนตัดสินคำอุทธรณ์ */
  note?: string | null;
  /** ลิงก์ไปหน้าจัดการนิยายที่เปิดฟอร์มอุทธรณ์ให้ทันที */
  appealUrl: string;
}

const MODERATION_SUBJECT: Record<NovelModerationEmailInput["kind"], string> = {
  suspended: "นิยายของคุณถูกระงับการเผยแพร่",
  reinstated: "นิยายของคุณกลับมาเผยแพร่แล้ว",
  upheld: "ผลการพิจารณาคำอุทธรณ์: ยังคงระงับการเผยแพร่",
};

/** post-moderation — แจ้งนักเขียนเมื่อแอดมินระงับนิยาย / คืนสถานะ / ยืนยันการระงับหลังอุทธรณ์
 *  ข้อความจากผู้ใช้ (ชื่อเรื่อง เหตุผล) ถูก escape ก่อนใส่ใน HTML เสมอ */
export async function sendNovelModerationEmail(to: string, input: NovelModerationEmailInput): Promise<void> {
  const title = escapeHtml(input.novelTitle);
  const reason = escapeHtml(input.reason).replace(/\n/g, "<br>");
  const note = input.note ? escapeHtml(input.note).replace(/\n/g, "<br>") : null;
  const button = (label: string) => `
        <p style="margin: 24px 0;">
          <a href="${escapeHtml(input.appealUrl)}" style="background: #F0803C; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">${label}</a>
        </p>`;
  const reasonBlock = `
        <p style="margin: 16px 0 4px; font-weight: bold;">เหตุผลจากทีมงาน</p>
        <blockquote style="margin: 0; padding: 12px 16px; background: #FFF4EC; border-left: 4px solid #F0803C; border-radius: 4px;">${reason}</blockquote>`;

  let body: string;
  if (input.kind === "suspended") {
    body = `
        <h2 style="color: #5B3A29;">นิยายของคุณถูกระงับการเผยแพร่</h2>
        <p>ทีมงานตรวจพบว่านิยาย <b>"${title}"</b> ไม่เป็นไปตามแนวทางของแพลตฟอร์ม จึงซ่อนนิยายเรื่องนี้จากผู้อ่านชั่วคราว</p>
        ${reasonBlock}
        <p style="margin-top: 20px; font-weight: bold;">วิธียื่นอุทธรณ์</p>
        <ol style="padding-left: 20px; color: #404040;">
          <li>แก้ไขเนื้อหาตามเหตุผลข้างต้น (ถ้าจำเป็น)</li>
          <li>กดปุ่ม "ยื่นอุทธรณ์" ด้านล่าง แล้วอธิบายเหตุผลหรือสิ่งที่แก้ไขแล้ว</li>
          <li>ทีมงานจะตรวจซ้ำและแจ้งผลให้ทราบทางแจ้งเตือนและอีเมล</li>
        </ol>
        ${button("ยื่นอุทธรณ์ / ขอให้ตรวจซ้ำ")}`;
  } else if (input.kind === "reinstated") {
    body = `
        <h2 style="color: #5B3A29;">นิยายของคุณกลับมาเผยแพร่แล้ว</h2>
        <p>ทีมงานตรวจสอบนิยาย <b>"${title}"</b> อีกครั้งและยกเลิกการระงับแล้ว ผู้อ่านเห็นนิยายเรื่องนี้ได้ตามปกติ</p>
        ${note ? `<p style="margin: 16px 0 4px; font-weight: bold;">หมายเหตุจากทีมงาน</p><p>${note}</p>` : ""}
        ${button("ไปหน้าจัดการนิยาย")}`;
  } else {
    body = `
        <h2 style="color: #5B3A29;">ผลการพิจารณาคำอุทธรณ์</h2>
        <p>ทีมงานตรวจสอบคำอุทธรณ์ของนิยาย <b>"${title}"</b> แล้ว และยังคงระงับการเผยแพร่ไว้</p>
        ${reasonBlock}
        ${note ? `<p style="margin: 16px 0 4px; font-weight: bold;">ผลการพิจารณา</p><p>${note}</p>` : ""}
        <p>หากแก้ไขเนื้อหาแล้ว สามารถยื่นอุทธรณ์ใหม่ได้จากหน้าจัดการนิยาย</p>
        ${button("ยื่นอุทธรณ์อีกครั้ง")}`;
  }

  await sendEmail({
    to,
    subject: `${MODERATION_SUBJECT[input.kind]}: ${input.novelTitle} — BuddyBook`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        ${body}
        <p style="color: #737373; font-size: 13px;">อีเมลนี้ส่งอัตโนมัติจากระบบดูแลเนื้อหาของ BuddyBook</p>
      </div>
    `,
  });
}
