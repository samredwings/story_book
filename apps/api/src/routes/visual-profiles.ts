import { Router, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const router = Router();

const visualProfileSchema = z.object({
  identityPrompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(2000).optional().nullable(),
  style: z.string().max(200).optional().nullable(),
  seed: z.number().int().optional().nullable(),
  referenceAssetIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  locked: z.boolean().optional(),
});

async function ownedCharacter(characterId: string, userId: string) {
  return prisma.character.findFirst({
    where: { id: characterId, userId },
    select: { id: true },
  });
}

/** GET /api/characters/:characterId/visual-profile */
router.get(
  "/:characterId/visual-profile",
  async (req: AuthRequest, res: Response) => {
    try {
      const characterId = req.params.characterId;
      const userId = req.userId!;

      const character = await ownedCharacter(characterId, userId);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const profile = await prisma.characterVisualProfile.findUnique({
        where: { characterId },
      });

      if (!profile) {
        return res.status(404).json({ error: "Visual profile not found" });
      }

      res.json({ success: true, profile });
    } catch (err) {
      logger.error({ err }, "get visual profile failed");
      res.status(500).json({ error: "Failed to fetch visual profile" });
    }
  },
);

/** PUT /api/characters/:characterId/visual-profile — upsert */
router.put(
  "/:characterId/visual-profile",
  async (req: AuthRequest, res: Response) => {
    try {
      const characterId = req.params.characterId;
      const userId = req.userId!;
      const data = visualProfileSchema.parse(req.body);

      const character = await ownedCharacter(characterId, userId);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const existing = await prisma.characterVisualProfile.findUnique({
        where: { characterId },
      });

      if (existing?.locked && data.locked !== false) {
        return res.status(403).json({
          error: "Visual profile is locked. Set locked=false to unlock first.",
          code: "PROFILE_LOCKED",
        });
      }

      const profile = await prisma.characterVisualProfile.upsert({
        where: { characterId },
        create: {
          characterId,
          identityPrompt: data.identityPrompt,
          negativePrompt: data.negativePrompt ?? null,
          style: data.style ?? null,
          seed: data.seed ?? null,
          referenceAssetIds: data.referenceAssetIds ?? [],
          locked: data.locked ?? true,
        },
        update: {
          identityPrompt: data.identityPrompt,
          negativePrompt: data.negativePrompt ?? null,
          style: data.style ?? null,
          seed: data.seed ?? null,
          referenceAssetIds: data.referenceAssetIds ?? [],
          ...(data.locked !== undefined ? { locked: data.locked } : {}),
        },
      });

      res.json({ success: true, profile });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid visual profile",
          details: err.flatten().fieldErrors,
        });
      }
      logger.error({ err }, "upsert visual profile failed");
      res.status(500).json({ error: "Failed to save visual profile" });
    }
  },
);

/** DELETE /api/characters/:characterId/visual-profile */
router.delete(
  "/:characterId/visual-profile",
  async (req: AuthRequest, res: Response) => {
    try {
      const characterId = req.params.characterId;
      const userId = req.userId!;

      const character = await ownedCharacter(characterId, userId);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      await prisma.characterVisualProfile.deleteMany({
        where: { characterId },
      });

      res.json({ success: true, message: "Visual profile deleted" });
    } catch (err) {
      logger.error({ err }, "delete visual profile failed");
      res.status(500).json({ error: "Failed to delete visual profile" });
    }
  },
);

export default router;
