# ---------- deps ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM deps AS build
WORKDIR /app

COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# API URL is baked in here and must be reachable from the browser, not from
# inside the compose network.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ---------- production ----------
FROM node:22-bookworm-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r nodejs && useradd -r -g nodejs nodejs

# The standalone output already contains the minimal server and its
# dependencies; public/ and .next/static are served alongside it.
COPY --from=build --chown=nodejs:nodejs /app/public ./public
COPY --from=build --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/.next/static ./.next/static

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -fsS http://localhost:3000/login || exit 1

CMD ["node", "server.js"]
