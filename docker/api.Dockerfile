# syntax=docker/dockerfile:1
# BuddyBook API — production image (build context: repo root)
#   docker build -f docker/api.Dockerfile --target runtime -t buddybook-api .
#
# stage "build" มี devDependencies ครบ (prisma CLI, tsx) — docker-compose.prod.yml ใช้ stage นี้เป็น
# service "migrate" สำหรับ `prisma migrate deploy` / create-admin ส่วน stage "runtime" มีแค่ dist + deps จริง
# ใช้ Debian (glibc) ไม่ใช่ alpine — engine ของ Prisma กับ native module ไม่ต้องแก้เรื่อง musl

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false \
    npm_config_fetch_retries=5 npm_config_fetch_retry_maxtimeout=120000 npm_config_fetch_timeout=600000 npm_config_maxsockets=4
WORKDIR /app

# ---- build: deps ทั้งหมด + prisma generate + tsc ----
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=apps/api --include-workspace-root=false
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# ---- runtime: production deps + client ที่ generate แล้ว ----
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=apps/api --include-workspace-root=false --omit=dev
# client + query engine ที่ generate ใน stage build (base image เดียวกัน = engine ตรง platform)
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
