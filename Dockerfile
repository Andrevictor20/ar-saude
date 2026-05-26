# =====================================================
# Dockerfile — Ar-Saúde Microsserviço 1 (Coletor)
# =====================================================
# Build multi-stage para imagem final leve e segura.

# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copia apenas os manifests primeiro para cache de dependências
COPY package*.json ./

# Instala dependências (incluindo devDependencies para o build)
RUN npm ci

# Copia o código-fonte
COPY . .

# Compila o TypeScript
RUN npm run build

# Remove devDependencies para produção
RUN npm prune --production

# ── Stage 2: Runtime ──
FROM node:20-alpine AS runtime

WORKDIR /app

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Copia apenas os artefatos necessários do stage de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expõe a porta do healthcheck
EXPOSE 3000

# Usa um usuário não-root por segurança
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001 -G nestjs

USER nestjs

# Healthcheck integrado ao Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Inicia a aplicação
CMD ["node", "dist/main.js"]
