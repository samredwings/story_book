import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import { generateVideo } from "@img-vdo/video-generator";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";

/**
 * Runs the BullMQ video-generation worker inside the API process.
 *
 * Why: free hosting tiers usually allow only ONE service. Running the worker
 * in-process means a single free web service hosts both the API and the queue
 * consumer. Set RUN_WORKER_INLINE=true to enable.
 *
 * For real production, run apps/worker separately and leave this off.
 */

export const VIDEO_QUEUE_NAME = "video-generation";
const MAX_ATTEMPTS = 3;

let connection: IORedis | null = null;
let worker: Worker | null = null;
let queue: Queue | null = null;

export function getQueueConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on("error", (err) => logger.error({ err }, "worker redis error"));
  }
  return connection;
}

/** Queue handle so API routes can enqueue jobs without opening a second connection. */
export function getVideoQueue(): Queue {
  if (!queue) {
    queue = new Queue(VIDEO_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export async function startInlineWorker(): Promise<void> {
  if (worker) return;

  worker = new Worker(
    VIDEO_QUEUE_NAME,
    async (job) => {
      const data = job.data as {
        jobId: string;
        sceneId: string;
        imageUrl: string;
        prompt: string;
        duration?: number;
        motionStrength?: number;
        provider: string;
        metadata?: { aspectRatio?: string; quality?: string };
      };

      logger.info(
        { jobId: job.id, sceneId: data.sceneId, provider: data.provider },
        "inline worker: processing job",
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
          duration: data.duration ?? 5,
          motionStrength: data.motionStrength ?? 0.7,
          provider: data.provider as never,
          aspectRatio: data.metadata?.aspectRatio,
          quality: data.metadata?.quality,
        } as never);

        if (!result.videoUrl) {
          throw new Error(`${result.provider} returned no video URL`);
        }
        if (result.videoUrl.startsWith("data:")) {
          throw new Error("Refusing to persist a data-URL video; storage upload required");
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
          data: { videoUrl: result.videoUrl, status: "COMPLETED" },
        });

        logger.info({ jobId: job.id, sceneId: data.sceneId }, "inline worker: job completed");
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

        logger.error({ jobId: job.id, error: message }, "inline worker: job failed");
        throw error;
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
    },
  );

  worker.on("completed", (job) => logger.info({ jobId: job?.id }, "inline worker: completed"));
  worker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, error: err.message }, "inline worker: failed"),
  );
  worker.on("stalled", (jobId) => logger.warn({ jobId }, "inline worker: stalled"));

  logger.info("inline worker started (queue: %s)", VIDEO_QUEUE_NAME);
}

export async function stopInlineWorker(): Promise<void> {
  if (worker) await worker.close();
  if (queue) await queue.close();
  if (connection) await connection.quit();
  worker = null;
  queue = null;
  connection = null;
}
