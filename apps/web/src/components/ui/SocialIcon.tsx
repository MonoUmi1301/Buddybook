// ไอคอนแบรนด์ Facebook/Line/Google วาดเป็น inline SVG เอง (lucide-react ไม่มีโลโก้แบรนด์)
// ใช้เฉพาะปุ่ม "เข้าสู่ระบบด้วย..." ตาม wf_login.png

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

export function LineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3 0 .7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.4 5.9-3.5 8-6C21.4 13.7 22 12.4 22 11c0-4.4-4.5-8-10-8Zm-4.7 9.9H5.6a.3.3 0 0 1-.3-.3V8.4a.4.4 0 0 1 .8 0v3.8h1.2c.2 0 .4.2.4.4 0 .2-.2.3-.4.3Zm1.8-.3a.4.4 0 0 1-.8 0V8.4a.4.4 0 0 1 .8 0v4.2Zm4.7 0a.4.4 0 0 1-.7.3l-2-2.8v2.5a.4.4 0 0 1-.8 0V8.4c0-.2.1-.3.3-.4a.4.4 0 0 1 .4.1l2 2.8V8.4a.4.4 0 0 1 .8 0v4.2Zm3.4-2.5a.4.4 0 0 1 0 .8h-1.5v1h1.5a.4.4 0 0 1 0 .8h-1.9a.3.3 0 0 1-.3-.3V8.4c0-.2.1-.3.3-.3h1.9a.4.4 0 0 1 0 .8h-1.5V10h1.5Z" />
    </svg>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.2v2.8A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.2a6.6 6.6 0 0 1 0-4.4V7H2.2a11 11 0 0 0 0 10l3.6-2.8Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1a11 11 0 0 0-9.8 6l3.6 2.8c.9-2.7 3.3-4.4 6.2-4.4Z"
      />
    </svg>
  );
}
