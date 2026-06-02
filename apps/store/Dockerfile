# ============================================================
# Dockerfile — apps/store
# Next.js 14 App Router — standalone output
# ============================================================

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json turbo.json ./
COPY packages/ui/package.json      packages/ui/package.json
COPY packages/theme/package.json   packages/theme/package.json
COPY packages/i18n/package.json    packages/i18n/package.json
COPY apps/store/package.json       apps/store/package.json

RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY packages/ui/    packages/ui/
COPY packages/theme/ packages/theme/
COPY packages/i18n/  packages/i18n/
COPY apps/store/     apps/store/

RUN mkdir -p apps/store/public

ARG NEXT_PUBLIC_API_URL=https://api.aurabr.app
ARG NEXT_PUBLIC_DEFAULT_TENANT_SLUG=demo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEFAULT_TENANT_SLUG=$NEXT_PUBLIC_DEFAULT_TENANT_SLUG
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/store
RUN npm run build

# ── Runner ────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# O monorepo standalone gera em .next/standalone com o path completo preservado
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/public              ./apps/store/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/.next/standalone    ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/.next/static        ./apps/store/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD wget -qO- http://0.0.0.0:3000/ || exit 1

# server.js fica em apps/store/server.js dentro do standalone
CMD ["node", "apps/store/server.js"]
