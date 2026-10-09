# ═══════════════════════════════════════════════════════════════════════════════
# IMG-VDO multi-stage production image
# Targets: api | worker
# Build examples:
#   docker build --target api -t img-vdo-api .
#   docker build --target worker -t img-vdo-worker .
# ═══════════════════════════════════════════════════════════════════════════════

ARG NODE_VERSION=20-alpine

# ─── Base: install workspace deps once ───────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Package manifests only (layer cache)
COPY package.json package-lock.json* turbo.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/video-generator/package.json ./packages/video-generator/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/

RUN npm install --omit=dev=false --no-audit --no-fund \
  || npm install --no-audit --no-fund

# ─── Build shared packages + apps ────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY packages/shared ./packages/shared
COPY packages/video-generator ./packages/video-generator
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# Prisma client generation needs schema present
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

RUN npm run build --workspace=@img-vdo/shared \
 && npm run build --workspace=@img-vdo/video-generator \
 && npm run build --workspace=@img-vdo/api \
 && npm run build --workspace=@img-vdo/worker

# ─── Production runtime base ─────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

# ─── API target ──────────────────────────────────────────────────────────────
FROM runtime AS api
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Local storage fallback directory
RUN mkdir -p /app/uploads && chown -R app:app /app
USER app

ENV API_PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]

# ─── Worker target ───────────────────────────────────────────────────────────
FROM runtime AS worker
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

RUN mkdir -p /app/uploads && chown -R app:app /app
USER app

ENV WORKER_PORT=3002
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)"

WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
