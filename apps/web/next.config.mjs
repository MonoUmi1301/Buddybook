/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // เพิ่มภายหลัง — ปิด client Router Cache ของหน้า dynamic (ค่าเดิมของ Next 14.2 = เก็บไว้ 30 วิ)
  // เดิมกลับเข้าหน้าจัดการนิยายหลังลบ/สร้าง/ตั้งเวลาตอน จะได้หน้าเก่าจาก cache ต้องกดรีเฟรชเองถึงจะอัปเดต
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  images: {
    // Next 16 รับเฉพาะ quality ที่ประกาศไว้ (ค่าเริ่มต้น [75]) — Avatar และหมุดแผนที่ใช้ 90 ให้ภาพคม
    qualities: [75, 90],
    remotePatterns: [
      {
        // Cloudinary — cover images / avatars (ตาม Tech Stack ใน spec)
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // Mock data สำหรับ UI ตอนยังไม่ต่อ API จริง — ลบออกได้เมื่อเปลี่ยนไปใช้ Cloudinary URL จริง
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        // รูปโปรไฟล์จาก Google OAuth (profile.picture ที่ googleOAuth.ts ดึงมา)
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // รูปโปรไฟล์จาก Facebook OAuth (profile.picture.data.url ที่ facebookOAuth.ts ดึงมา)
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
      {
        // รูปโปรไฟล์จาก LINE OAuth (claims.picture ที่ lineOAuth.ts ดึงมา)
        protocol: "https",
        hostname: "profile.line-scdn.net",
      },
    ],
  },
  // code audit H2 — header ที่ไม่ขึ้นกับ request (CSP ที่ต้องมี nonce ต่อ request อยู่ใน src/middleware.ts)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // ยืนยันตัวตน e-KYC ใช้กล้องบนหน้าของ Didit (redirect ออกไป) ไม่ใช่บนหน้าเรา
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
  async rewrites() {
    // Fallback เท่านั้น — endpoint ส่วนใหญ่มี Route Handler จริงใน src/app/api/v1/...
    // (validate + attach httpOnly cookie เป็น Authorization header ก่อนส่งต่อ Express)
    // สำคัญ: ต้องใช้ key "fallback" ไม่ใช่ return array เฉย ๆ — array เปล่าจะถูกตีความเป็น
    // "afterFiles" ซึ่งเช็คก่อน dynamic route ([novelId] ฯลฯ) เสมอ ทำให้ทุก endpoint ที่มี
    // dynamic segment โดนรีไรต์ตรงไป Express ก่อนจะถึง Route Handler ของตัวเอง — คำขอเลย
    // ไม่มี Authorization header ติดไปด้วย (Express เห็นแค่ cookie ที่มันไม่รู้จัก จึงตอบ 401
    // "Missing bearer token" แม้ล็อกอินอยู่จริง) "fallback" เท่านั้นที่เช็คหลัง pages/public
    // files และ dynamic route ทั้งหมดแล้ว ตรงตามเจตนาเดิมของ comment นี้
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${process.env.API_URL || "http://localhost:4000"}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
