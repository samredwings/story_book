import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { createClient } from "redis";

import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";
import { requireAdultConsent } from "./middleware/adultConsent";
import { globalRateLimiter } from "./middleware/rateLimit";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { startInlineWorker, stopInlineWorker } from "./inline-worker";

import authRoutes from "./routes/auth";
import storyboardRoutes from "./routes/storyboards";
import characterRoutes from "./routes/characters";
import storyRoutes from "./routes/stories";
import sceneRoutes from "./routes/scenes";
import dashboardRoutes from "./routes/dashboard";
import modelsRoutes from "./routes/models";
import creativeRoutes from "./routes/creative";
import videosRoutes from "./routes/videos";
import publishingRoutes from "./routes/publishing";
import roleplayRoutes from "./routes/roleplay";
import offlineRoutes from "./routes/offline";
import unrestrictedRoutes from "./routes/unrestricted";
import userKeysRoutes from "./routes/user-keys";
import mediaAssetsRoutes from "./routes/media-assets";
import buildStoryRoutes from "./routes/build-story";
import sexGameRoutes from "./routes/sex-game";
import gdprRoutes from "./routes/gdpr";
import memoriesRoutes from "./routes/memories";
import lorebookRoutes from "./routes/lorebook";
import relationshipsRoutes from "./routes/relationships";
import sceneStateRoutes from "./routes/scene-state";
import visualProfileRoutes from "./routes/visual-profiles";
import videoCallRoutes from "./routes/video-calls";
import conversationsRoutes from "./routes/conversations";
import { localStorageRoot } from "@img-vdo/video-generator";

const app = express();

app.set("trust proxy", config.trustProxy);
app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (config.cors.origins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: config.cors.credentials,
    maxAge: 600,
  }),
);

app.use(pinoHttp({ logger }));
app.use(globalRateLimiter);
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ limit: config.bodyLimit, extended: true }));

let redisCheck: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (redisCheck) return redisCheck;
  redisCheck = createClient({ url: config.redis.url });
  redisCheck.on("error", (err) => logger.error({ err }, "redis"));
  await redisCheck.connect();
  return redisCheck;
}

app.get("/health", async (_req, res) => {
  const result: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    worker: process.env.RUN_WORKER_INLINE === "true" ? "inline" : "external",
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database = "ok";
  } catch (err) {
    result.status = "degraded";
    result.database = "down";
  }
  try {
    const r = await getRedis();
    await r.ping();
    result.redis = "ok";
  } catch {
    result.status = "degraded";
    result.redis = "down";
  }
  res.status(result.status === "ok" ? 200 : 503).json(result);
});

app.use("/api/auth", authRoutes);
app.use("/api/models", modelsRoutes);
app.use("/api/offline", offlineRoutes);

const adult = [authMiddleware, requireAdultConsent] as const;

app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/storyboards", ...adult, storyboardRoutes);
app.use("/api/characters", ...adult, characterRoutes);
app.use("/api/stories", ...adult, storyRoutes);
app.use("/api/stories", ...adult, buildStoryRoutes);
app.use("/api/scenes", ...adult, sceneRoutes);
app.use("/api/creative", ...adult, creativeRoutes);
app.use("/api/videos", ...adult, videosRoutes);
app.use("/api/publish", ...adult, publishingRoutes);
app.use("/api/export", ...adult, publishingRoutes);
app.use("/api/roleplay", ...adult, roleplayRoutes);
app.use("/api/roleplay/conversations", ...adult, conversationsRoutes);
app.use("/api/roleplay/memories", ...adult, memoriesRoutes);
app.use("/api/roleplay/lorebook", ...adult, lorebookRoutes);
app.use("/api/roleplay/relationships", ...adult, relationshipsRoutes);
app.use("/api/roleplay/scene-state", ...adult, sceneStateRoutes);
app.use("/api/characters/:id/visual-profile", ...adult, visualProfileRoutes);
app.use("/api/video-calls", ...adult, videoCallRoutes);
app.use("/api/unrestricted", ...adult, unrestrictedRoutes);
app.use("/api/user/keys", authMiddleware, userKeysRoutes);
app.use("/api/media-assets", ...adult, mediaAssetsRoutes);
app.use("/api/sex-game", ...adult, sexGameRoutes);
app.use("/api/me", authMiddleware, gdprRoutes);

app.use(
  "/media",
  express.static(localStorageRoot(), {
    fallthrough: false,
    index: false,
    maxAge: "1y",
    immutable: true,
  }),
);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

const PORT = config.port;
const HOST = process.env.API_HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  logger.info(
    { port: PORT, host: HOST, env: config.nodeEnv, corsOrigins: config.cors.origins },
    `API listening on ${HOST}:${PORT}`,
  );
});

// Free single-service hosting: consume the video queue inside this process.
if (process.env.RUN_WORKER_INLINE === "true") {
  startInlineWorker().catch((err) => {
    logger.error({ err }, "failed to start inline worker");
  });
}

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close(async () => {
    try {
      if (process.env.RUN_WORKER_INLINE === "true") await stopInlineWorker();
      await prisma.$disconnect();
      if (redisCheck) await redisCheck.quit();
    } catch (err) {
      logger.error({ err }, "shutdown cleanup error");
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandled rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  shutdown("uncaughtException");
});

export default app;
