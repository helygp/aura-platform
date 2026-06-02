# ============================================================
# Dockerfile — apps/master
# Painel master Aura Platform — Sprint 4 Tarefa 7
# Multi-stage: build Node → serve Nginx
# API_HOST configurável em runtime via env (default: api-acme)
# ============================================================

# ── Stage 1: build ──────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Manifests do monorepo
COPY package.json turbo.json ./

# Workspaces necessários para o build do master
COPY packages/ui/     packages/ui/
COPY packages/theme/  packages/theme/
COPY apps/master/     apps/master/

# Instala deps
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Build — VITE_MASTER_SECRET injetado em build-time via ARG
ARG VITE_MASTER_SECRET
ARG VITE_API_URL=""
ARG VITE_DOMAIN=aurabr.app

ENV VITE_MASTER_SECRET=${VITE_MASTER_SECRET}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_DOMAIN=${VITE_DOMAIN}

WORKDIR /app/apps/master
RUN npm run build

# ── Stage 2: serve ──────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf

# nginx.conf usa $API_HOST — substituído pelo envsubst no entrypoint
COPY apps/master/nginx.conf /etc/nginx/templates/master.conf.template

COPY --from=builder /app/apps/master/dist /usr/share/nginx/html

# API_HOST: nome do container da API na rede Docker (default: api-acme)
ENV API_HOST=api-acme

EXPOSE 80

# nginx official image roda envsubst automaticamente em /etc/nginx/templates/*.template
CMD ["nginx", "-g", "daemon off;"]
