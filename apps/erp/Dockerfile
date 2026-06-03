# ============================================================
# Dockerfile — apps/erp
# Multi-stage: build Node → serve Nginx
#
# Stage 1 (builder): instala deps do monorepo e gera dist/
# Stage 2 (runner):  Nginx slim apenas com os arquivos estáticos
#
# A API é um container separado (services/api).
# O Nginx faz reverse proxy de /auth/* e /api/* → api:3001.
# VITE_API_URL='' → URLs relativas → nginx faz o proxy (produção)
# ============================================================

# ── Stage 1: build ──────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifests do monorepo
COPY package.json turbo.json ./

# Copia os workspaces necessários para o build do ERP
COPY packages/ui/           packages/ui/
COPY packages/theme/        packages/theme/
COPY packages/i18n/         packages/i18n/
COPY packages/auth/         packages/auth/
COPY apps/erp/              apps/erp/

# Instala todas as deps (workspaces)
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# VITE_API_URL vazio = URLs relativas → nginx proxia /auth e /api para a API
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Build do ERP
WORKDIR /app/apps/erp
RUN npm run build

# ── Stage 2: serve ──────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove config padrão
RUN rm /etc/nginx/conf.d/default.conf

# Config customizada
COPY apps/erp/nginx.conf /etc/nginx/conf.d/erp.conf

# Copia artefatos do build
COPY --from=builder /app/apps/erp/dist /usr/share/nginx/html

# Porta interna
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
