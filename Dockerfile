FROM node:22-alpine AS deps
WORKDIR /app
# Native modules (e.g. bufferutil from ws) need a compiler on Alpine.
RUN apk add --no-cache libc6-compat python3 make g++
# Lockfile is written by npm 11. Alpine's npm 10 rejects `npm ci` without this.
RUN npm install -g npm@11.12.1
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders for `next build` only. Runtime secrets (Privy, session, DB) come from Compose.
RUN SESSION_SECRET=docker-build-session-secret-min-32-chars \
    APP_ORIGIN=http://localhost:3000 \
    NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=8 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
