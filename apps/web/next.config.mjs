/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
