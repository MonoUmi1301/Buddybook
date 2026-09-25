# Dev image ตัวเดียวใช้ร่วมกันทั้ง apps/api และ apps/web (npm workspaces ใช้ lockfile ตัวเดียวที่ root
# แยก Dockerfile ต่อแอปจะต้อง install ซ้ำสองรอบโดยไม่ได้อะไรเพิ่ม)
#
# - ไม่ COPY source code — ตอนรันจริง bind mount ./apps/* เข้ามาแทน (hot reload)
# - node_modules อยู่ใน image แล้ว compose เอาไปวางเป็น anonymous volume ทับ bind mount อีกชั้น
#   เพื่อไม่ให้ node_modules ของ Windows host (binary คนละ platform) หลุดเข้ามาใน container
FROM node:20-alpine

# openssl: Prisma query engine (linux-musl-openssl-3.0.x) ต้องใช้
# libc6-compat: บาง native binary ที่คาดหวัง glibc
RUN apk add --no-cache openssl libc6-compat

ENV NEXT_TELEMETRY_DISABLED=1 \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# package-lock.json ที่สร้างบน Windows ไม่มี entry ของ @next/swc-* (optional dependency ตาม platform)
# npm ci บน alpine จึงไม่ได้ SWC มาด้วย — ดึง musl build ให้ตรงเวอร์ชัน next แล้วแตกไฟล์ใส่ node_modules เอง
# ห้ามใช้ `npm install --no-save` ตรงนี้: มันจัดโครง node_modules ใหม่แล้วลิงก์ใน .bin (next/tsx) หายไป
# (next อาจถูก hoist ไว้ที่ root หรืออยู่ใน apps/web ก็ได้ แล้วแต่ lockfile — @next/swc ที่ root หาเจอทั้งสองแบบ)
RUN npm ci \
 && NEXT_VERSION=$(node -p "require(require.resolve('next/package.json', { paths: ['/app/apps/web'] })).version") \
 && cd /tmp && npm pack "@next/swc-linux-x64-musl@${NEXT_VERSION}" --silent \
 && mkdir -p /app/node_modules/@next/swc-linux-x64-musl \
 && tar -xzf next-swc-linux-x64-musl-*.tgz -C /app/node_modules/@next/swc-linux-x64-musl --strip-components=1 \
 && rm -f /tmp/*.tgz \
 && npm cache clean --force
