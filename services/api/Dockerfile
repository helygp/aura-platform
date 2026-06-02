# ============================================================
# Dockerfile — services/api
# Node.js + Express + Prisma
#
# Usa node:22-bookworm-slim (Debian) porque o Prisma engine
# precisa de libssl — ausente no Alpine.
# ============================================================

FROM node:22-bookworm-slim AS builder

RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json turbo.json ./
COPY services/api/           services/api/
COPY packages/auth/          packages/auth/

RUN npm install --frozen-lockfile 2>/dev/null || npm install

WORKDIR /app/services/api
RUN npx prisma generate --schema=prisma/schema.prisma 2>/dev/null || true

# ── Runner ─────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

# bash necessário para executar provisionar.sh
# docker CLI será montado via bind mount do host em /usr/bin/docker
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl wget bash && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/services/api        ./services/api
COPY --from=builder /app/packages/auth       ./packages/auth
COPY scripts/                                ./scripts/
RUN chmod +x ./scripts/*.sh 2>/dev/null || true

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "services/api/src/index.js"]
