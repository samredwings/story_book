import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

const httpImageUrl = z
  .string()
  .url()
  .max(2000)
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return (
          (parsed.protocol === "http:" || parsed.protocol === "https:") &&
          !u.toLowerCase().startsWith("data:")
        );
      } catch {
        return false;
      }
    },
    { message: "imageUrl must be an http(s) URL (data: URLs are not allowed)" },
  );

const createCharacterSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  imageUrl: httpImageUrl,
  personality: z.record(z.any()).optional(),
  appearance: z.record(z.any()).optional(),
  background: z.string().max(3000).optional(),
  traits: z.array(z.string()).optional(),

  // Explicit adult fields
  sexualRole: z
    .enum([
      "dominant",
      "submissive",
      "switch",
      "slut",
      "prey",
      "predator",
      "other",
    ])
    .optional(),
  kinks: z.array(z.string()).optional(),
  bodyDetails: z.string().max(1500).optional(),
  voiceStyle: z.string().max(500).optional(),
  limits: z.array(z.string()).optional(),
  preferredActs: z.array(z.string()).optional(),
});

// ─── GET /api/characters ────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const characters = await prisma.character.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(characters);
  } catch (error) {
    console.error("Failed to fetch characters:", error);
    res.status(500).json({ error: "Failed to fetch characters" });
  }
});

// ─── POST /api/characters ───────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const data = createCharacterSchema.parse(req.body);

    const character = await prisma.character.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        personality: data.personality
          ? JSON.stringify(data.personality)
          : null,
        appearance: data.appearance
          ? JSON.stringify(data.appearance)
          : null,
        traits: data.traits ? JSON.stringify(data.traits) : null,
        background: data.background,

        // Explicit adult fields
        sexualRole: data.sexualRole ?? null,
        kinks: data.kinks ? JSON.stringify(data.kinks) : null,
        bodyDetails: data.bodyDetails ?? null,
        voiceStyle: data.voiceStyle ?? null,
        limits: data.limits ? JSON.stringify(data.limits) : null,
        preferredActs: data.preferredActs
          ? JSON.stringify(data.preferredActs)
          : null,

        userId,
      },
    });

    res.status(201).json(character);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Failed to create character:", error);
    res.status(500).json({ error: "Failed to create character" });
  }
});

// ─── GET /api/characters/:id ────────────────────────────────────────────────
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const character = await prisma.character.findUnique({
      where: { id },
    });

    if (!character || character.userId !== userId) {
      return res.status(404).json({ error: "Character not found" });
    }

    res.json(character);
  } catch (error) {
    console.error("Failed to fetch character:", error);
    res.status(500).json({ error: "Failed to fetch character" });
  }
});

// ─── PUT /api/characters/:id ────────────────────────────────────────────────
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const data = createCharacterSchema.partial().parse(req.body);

    const existing = await prisma.character.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Character not found" });
    }

    const updated = await prisma.character.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        background: data.background,
        personality: data.personality
          ? JSON.stringify(data.personality)
          : undefined,
        appearance: data.appearance
          ? JSON.stringify(data.appearance)
          : undefined,
        traits: data.traits ? JSON.stringify(data.traits) : undefined,

        // Explicit adult fields
        sexualRole: data.sexualRole,
        kinks: data.kinks ? JSON.stringify(data.kinks) : undefined,
        bodyDetails: data.bodyDetails,
        voiceStyle: data.voiceStyle,
        limits: data.limits ? JSON.stringify(data.limits) : undefined,
        preferredActs: data.preferredActs
          ? JSON.stringify(data.preferredActs)
          : undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Failed to update character:", error);
    res.status(500).json({ error: "Failed to update character" });
  }
});

// ─── DELETE /api/characters/:id ─────────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const character = await prisma.character.findUnique({
      where: { id },
    });

    if (!character || character.userId !== userId) {
      return res.status(404).json({ error: "Character not found" });
    }

    await prisma.character.delete({
      where: { id },
    });

    res.json({ message: "Character deleted" });
  } catch (error) {
    console.error("Failed to delete character:", error);
    res.status(500).json({ error: "Failed to delete character" });
  }
});

export default router;
