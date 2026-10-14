import dotenv from "dotenv";
dotenv.config();

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import pino from "pino";
import { createServer } from "http";
import { generateVideo } from "@img-vdo/video-generator";
import type { GenerationJobData } from "@img-vdo/shared";

const logger = pino({
  name: "img-vdo-worker",
  level: process.env.LOG_LEVEL || "info",
});
const prisma = new PrismaClient();

const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

const videoQueue = new Queue("video-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

const MAX_ATTEMPTS = 3;

const videoWorker = new Worker(
  "video-generation",
  async (job) => {
    const data = job.data as GenerationJobData;
    logger.info(
      { jobId: job.id, sceneId: data.sceneId, provider: data.provider },
      "Processing video generation job",
    );

    await prisma.generationJob.update({
      where: { id: data.jobId },
      data: { status: "PROCESSING", progress: 10 },
    });

    try {
      const result = await generateVideo({
        sceneId: data.sceneId,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        duration: data.duration,
        motionStrength: data.motionStrength,
        provider: data.provider,
        aspectRatio: data.metadata?.aspectRatio,
        quality: data.metadata?.quality,
      });

      if (!result.videoUrl) {
        throw new Error(`${result.provider} returned no video URL`);
      }

      if (result.videoUrl.startsWith("data:")) {
        throw new Error("Refusing to persist a data-URL video; storage upload is required");
      }

      await prisma.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: "COMPLETED",
          progress: 100,
          resultVideoUrl: result.videoUrl,
          resultThumbnail: result.thumbnail,
          completedAt: new Date(),
        },
      });

      await prisma.scene.update({
        where: { id: data.sceneId },
        data: {
          videoUrl: result.videoUrl,
          status: "COMPLETED",
        },
      });

      logger.info(
        { jobId: job.id, sceneId: data.sceneId },
        "Video generation completed successfully",
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isFinalAttempt = (job.attemptsMade ?? 0) + 1 >= MAX_ATTEMPTS;

      await prisma.generationJob.update({
        where: { id: data.jobId },
        data: {
          status: isFinalAttempt ? "FAILED" : "QUEUED",
          progress: isFinalAttempt ? 0 : 10,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });

      if (isFinalAttempt) {
        await prisma.scene.update({
          where: { id: data.sceneId },
          data: { status: "FAILED" },
        });
      }

      logger.error({ jobId: job.id, error: message }, "Video generation failed");
      throw error;
    }
  },
  { connection: redisConnection },
);

videoWorker.on("completed", (job) => {
  logger.info({ jobId: job?.id }, "Job completed");
});

videoWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Job failed");
});

videoWorker.on("stalled", (jobId) => {
  logger.warn({ jobId }, "Job stalled");
});

const PORT = parseInt(process.env.WORKER_PORT || "3002");

const healthServer = createServer(async (req, res) => {
  if (req.url === "/health") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redisConnection.ping();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    } catch (err) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "degraded", error: (err as Error).message }));
    }
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

healthServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`Worker health server listening on 0.0.0.0:${PORT}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker...");
  await videoWorker.close();
  await videoQueue.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  healthServer.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

logger.info("IMG-VDO Worker started");

export { videoQueue };
