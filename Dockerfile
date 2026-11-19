# -------- Dependencies --------
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* turbo.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/video-generator/package.json ./packages/video-generator/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# -------- Runtime Base --------
FROM node:20-slim AS runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN groupadd -r app && useradd -r -g app app

# -------- Build --------
FROM deps AS build
COPY packages/shared ./packages/shared
COPY packages/video-generator ./packages/video-generator
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=@img-vdo/shared && npm run build --workspace=@img-vdo/video-generator && npm run build --workspace=@img-vdo/api && npm run build --workspace=@img-vdo/worker

# -------- API (Final Stage) --------
FROM runtime AS api
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
RUN mkdir -p /app/uploads && chown -R app:app /app
WORKDIR /app/apps/api
USER app
EXPOSE 10000
CMD ["node", "dist/index.js"]
