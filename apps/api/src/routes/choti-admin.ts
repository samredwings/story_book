import { NextFunction, Router, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const router = Router();

// Only allow admin (you can harden this later)
function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // Simple check – replace with real role check later
  if (!req.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const corpusSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(50),
  summary: z.string().optional(),
  relationshipType: z.string().optional(),
  actType: z.string().optional(),
  intensity: z.number().min(1).max(10).default(8),
  languageStyle: z.string().optional(),
  tags: z.array(z.string()).optional(),
  characters: z.array(z.string()).optional(),
  source: z.string().optional(),
  quality: z.number().min(1).max(10).default(6),
  isApproved: z.boolean().default(false),
});

const phraseSchema = z.object({
  bangla: z.string().min(1),
  meaning: z.string().optional(),
  category: z.enum([
    "dirty_talk",
    "body_part",
    "action",
    "orgasm",
    "degradation",
    "affection",
    "begging",
  ]),
  intensity: z.number().min(1).max(10).default(7),
});

// ─── Upload Story to Corpus ────────────────────────────────────────────────
router.post("/corpus", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = corpusSchema.parse(req.body);

    const entry = await prisma.chotiCorpus.create({
      data: {
        title: data.title,
        content: data.content,
        summary: data.summary,
        relationshipType: data.relationshipType,
        actType: data.actType,
        intensity: data.intensity,
        languageStyle: data.languageStyle,
        tags: data.tags || [],
        characters: data.characters || [],
        source: data.source || "manual",
        quality: data.quality,
        isApproved: data.isApproved,
      },
    });

    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create corpus entry" });
  }
});

// ─── List / Search Corpus ──────────────────────────────────────────────────
router.get("/corpus", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { relationshipType, actType, approved, limit = "20" } = req.query;

    const entries = await prisma.chotiCorpus.findMany({
      where: {
        ...(relationshipType ? { relationshipType: String(relationshipType) } : {}),
        ...(actType ? { actType: String(actType) } : {}),
        ...(approved !== undefined ? { isApproved: approved === "true" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 20, 100),
    });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch corpus" });
  }
});

// ─── Approve / Reject ──────────────────────────────────────────────────────
router.patch("/corpus/:id/approve", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const updated = await prisma.chotiCorpus.update({
      where: { id },
      data: { isApproved: Boolean(isApproved) },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update approval" });
  }
});

// ─── Add Dirty Phrase ──────────────────────────────────────────────────────
router.post("/phrases", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = phraseSchema.parse(req.body);

    const phrase = await prisma.chotiPhrase.create({
      data: {
        bangla: data.bangla,
        meaning: data.meaning,
        category: data.category,
        intensity: data.intensity,
      },
    });

    res.status(201).json(phrase);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create phrase" });
  }
});

// ─── Bulk Add Phrases ──────────────────────────────────────────────────────
router.post("/phrases/bulk", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items = z.array(phraseSchema).parse(req.body);

    const result = await prisma.chotiPhrase.createMany({
      data: items,
      skipDuplicates: true,
    });

    res.status(201).json({ count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to bulk create phrases" });
  }
});

// ─── List Phrases ──────────────────────────────────────────────────────────
router.get("/phrases", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const phrases = await prisma.chotiPhrase.findMany({
      orderBy: { usageCount: "desc" },
      take: 100,
    });
    res.json(phrases);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch phrases" });
  }
});

export default router;
