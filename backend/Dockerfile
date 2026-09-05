# ---------- deps: full dependency tree, reused by the build stage ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Prisma's query engine needs OpenSSL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---------- build: generate the Prisma client, then compile ----------
FROM deps AS build
WORKDIR /app

COPY . .

# tsconfig.json must be present before generate: Prisma reads it to decide
# whether the generated client uses .js or .ts relative import extensions.
# Generating without it produces a client that fails to resolve at runtime.
RUN npx prisma generate --config prisma7.config.ts
RUN npm run build

# ---------- prod-deps: runtime dependencies only ----------
FROM deps AS prod-deps
WORKDIR /app
RUN npm ci --omit=dev

# ---------- production ----------
FROM node:22-bookworm-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# curl backs the container healthcheck below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r nodejs && useradd -r -g nodejs nodejs

COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --chown=nodejs:nodejs prisma7.config.ts package.json ./

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:3001/ || exit 1

# The Prisma CLI is a runtime dependency precisely so this can run here.
CMD ["sh", "-c", "npx prisma migrate deploy --config prisma7.config.ts && node dist/main.js"]
