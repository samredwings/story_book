/**
 * User API Key Management (BYOK — Bring Your Own Key)
 *
 * Keys are encrypted at rest with AES-256-GCM when ENCRYPTION_KEY (or JWT_SECRET) is set.
 */

import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { encryptSecret } from "../lib/crypto";

const router = Router();

const SUPPORTED_PROVIDERS = [
  "openai",
  "runway",
  "pika",
  "elevenlabs",
  "replicate",
] as const;

const upsertKeysSchema = z.object({
  keys: z.record(
    z.enum(SUPPORTED_PROVIDERS),
    z.string().min(1).max(2000).nullable(),
  ),
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const userKeys = await prisma.userApiKey.findMany({
      where: { userId },
      select: { provider: true },
    });

    const configured = new Set(userKeys.map((k) => k.provider));
    const keys: Record<string, string | null> = {};

    for (const provider of SUPPORTED_PROVIDERS) {
      keys[provider] = configured.has(provider) ? "configured" : null;
    }

    res.json({
      success: true,
      keys,
      serverDefaults: {
        openai: !!process.env.OPENAI_API_KEY,
        runway: !!process.env.RUNWAY_API_KEY,
        pika: !!process.env.PIKA_API_KEY,
        elevenlabs: !!process.env.ELEVENLABS_API_KEY,
        replicate: !!process.env.REPLICATE_API_KEY,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch user API keys");
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

router.put("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const data = upsertKeysSchema.parse(req.body);

    for (const [provider, key] of Object.entries(data.keys)) {
      if (key === null) {
        await prisma.userApiKey.deleteMany({
          where: { userId, provider },
        });
      } else {
        const stored = encryptSecret(key);
        await prisma.userApiKey.upsert({
          where: {
            userId_provider: { userId, provider },
          },
          update: { key: stored, updatedAt: new Date() },
          create: { userId, provider, key: stored },
        });
      }
    }

    res.json({
      success: true,
      message: "API keys updated successfully",
      note: "Keys are encrypted at rest when ENCRYPTION_KEY is configured.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.flatten().fieldErrors });
    }
    logger.error({ err: error }, "Failed to update API keys");
    res.status(500).json({ error: "Failed to update API keys" });
  }
});

export default router;
