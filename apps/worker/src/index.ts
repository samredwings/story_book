import dotenv from "dotenv";
dotenv.config();

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import pino from "pino";
import { generateVideo } from "@img-vdo/video-generator";
import type { GenerationJobData } from "@img-vdo/shared";

const logger = pino({
  name: "img-vdo-worker",
  level: process.env.LOG_LEVEL || "info",
});
const prisma = new PrismaClient();

// ─── Video Generation Queue ───────────────────────────────────────────────────

const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);
const videoQueue = new Queue<GenerationJobData>("video-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
const MAX_ATTEMPTS = 3;

// ─── Queue Processor ──────────────────────────────────────────────────────────

const videoWorker = new Worker<GenerationJobData>("video-generation", async (job) => {
  const data = job.data;
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
    const isFinalAttempt = job.attemptsMade + 1 >= MAX_ATTEMPTS;

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
}, { connection: redisConnection });

videoWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});

videoWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Job failed");
});

videoWorker.on("stalled", (jobId) => {
  logger.warn({ jobId }, "Job stalled");
});

async function shutdown() {
  logger.info("Shutting down worker...");
  await videoWorker.close();
  await videoQueue.close();
  await redisConnection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const PORT = parseInt(process.env.WORKER_PORT || "3002");

logger.info("╔══════════════════════════════════════════════════════╗");
logger.info("║     IMG-VDO Worker — Background Job Processor     ║");
logger.info("╠══════════════════════════════════════════════════════╣");
logger.info(
  `║  Redis:      ${process.env.REDIS_URL || "redis://localhost:6379"}  ║`,
);
logger.info("║  Queues:     video-generation                       ║");
logger.info("║  Mode:       UNRESTRICTED — no content filters      ║");
logger.info("╚══════════════════════════════════════════════════════╝");

export { videoQueue };
