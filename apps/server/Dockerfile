# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
# Prereqs for native modules (node-gyp)
RUN apk add --no-cache python3 make g++ pkgconf linux-headers libc6-compat libusb-dev eudev-dev
ENV npm_config_python=python3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN corepack enable && pnpm install --frozen-lockfile --prod=false && \
    mkdir -p apps/server/node_modules packages/shared/node_modules

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN corepack enable && pnpm --filter @memeplace/shared build && pnpm --filter server build && \
    pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S fastify && adduser -S fastify -G fastify

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/scripts ./apps/server/scripts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

USER fastify
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
