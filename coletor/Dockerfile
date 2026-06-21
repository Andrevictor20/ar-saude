# Ar-Saúde Coletor — Multi-stage build

# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Cache de dependências
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --production

# ── Stage 2: Runtime ──
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Usuário não-root
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001 -G nestjs

USER nestjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

CMD ["node", "--max-old-space-size=256", "dist/main.js"]
