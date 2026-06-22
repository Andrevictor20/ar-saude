# Ar-Saúde Coletor — Multi-stage build otimizado

# ── Stage 1: Instalar todas as dependências (dev + prod) ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: Build do TypeScript ──
FROM deps AS builder
COPY . .
RUN npm run build

# ── Stage 3: Apenas dependências de produção ──
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── Stage 4: Runtime mínimo ──
FROM node:22-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001 -G nestjs

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
COPY --from=prod-deps --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=deps --chown=nestjs:nestjs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["node", "--max-old-space-size=256", "dist/main.js"]
