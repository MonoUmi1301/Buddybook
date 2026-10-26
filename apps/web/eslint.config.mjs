import nextVitals from "eslint-config-next/core-web-vitals";

// Next 16 เลิกใช้ `next lint` / .eslintrc — ใช้ ESLint 9 flat config แทน
const config = [
  ...nextVitals,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    // eslint-plugin-react-hooks 7 (มากับ eslint-config-next 16) เพิ่มกฎของ React Compiler — โปรเจกต์นี้ยังไม่เปิด
    // React Compiler จึงปิดไว้ให้เท่ากับ lint เดิมของ Next 14 ; เปิดกลับเมื่อจะย้ายไปใช้ compiler (มี 72 จุดที่ต้องแก้)
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
    },
  },
  {
    // code audit M1 — promise ที่ไม่ถูกจัดการ (ต้องมี type info จาก tsconfig)
    // ปลั๊กอิน @typescript-eslint ลงทะเบียนไว้แล้วใน eslint-config-next
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
];

export default config;
