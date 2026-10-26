# syntax=docker/dockerfile:1
# BuddyBook Web (Next.js) — production image (build context: repo root)
#   docker build -f docker/web.Dockerfile \
#     --build-arg API_URL=http://api:4000 \
#     --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... -t buddybook-web .
#
# build arg สองตัวนี้ถูกฝังตอน `next build`:
#   API_URL — fallback rewrite /api/:path* ใน next.config.mjs (อยู่ใน routes-manifest ไม่อ่านใหม่ตอน runtime)
#   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — ฝังลง bundle ฝั่ง browser
# API_URL / APP_URL ยังต้องตั้งตอน runtime ด้วย (Route Handler กับ proxy.ts อ่านจาก process.env)

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false \
    npm_config_fetch_retries=5 npm_config_fetch_retry_maxtimeout=120000 npm_config_fetch_timeout=600000 npm_config_maxsockets=4
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=apps/web --include-workspace-root=false
COPY apps/web apps/web
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
ENV API_URL=$API_URL NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RUN npm run build --workspace=apps/web

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# standalone ของ monorepo วาง server.js ไว้ที่ apps/web/ — static กับ public ต้อง copy เพิ่มเอง
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
