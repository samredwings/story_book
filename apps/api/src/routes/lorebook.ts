import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const entrySchema = z.object({
  conversationId: z.string().min(1).optional(),
  characterId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
  keywords: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  priority: z.number().int().min(-100).max(100).default(0),
  enabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const listSchema = z.object({
  conversationId: z.string().min(1).optional(),
  characterId: z.string().min(1).optional(),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

async function assertScopeOwnership(userId: string, conversationId?: string, characterId?: string) {
  if (conversationId) {
    const conversation = await prisma.roleplayConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) return "Conversation not found";
  }

  if (characterId) {
    const character = await prisma.character.findFirst({
      where: { id: characterId, userId },
      select: { id: true },
    });
    if (!character) return "Character not found";
  }
}

router.get("/", async (req: AuthRequest, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const filters = parsed.data;
  const scopeError = await assertScopeOwnership(userId, filters.conversationId, filters.characterId);
  if (scopeError) return res.status(404).json({ error: scopeError });

  const entries = await prisma.roleplayLorebookEntry.findMany({
    where: {
      userId,
      conversationId: filters.conversationId,
      characterId: filters.characterId,
      enabled: filters.enabled,
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: filters.limit,
  });

  return res.json(entries);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const data = parsed.data;
  const scopeError = await assertScopeOwnership(userId, data.conversationId, data.characterId);
  if (scopeError) return res.status(404).json({ error: scopeError });

  const entry = await prisma.roleplayLorebookEntry.create({
    data: {
      ...data,
      userId,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.status(201).json(entry);
});

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const parsed = entrySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const entry = await prisma.roleplayLorebookEntry.findFirst({
    where: { id: req.params.id, userId },
  });
  if (!entry) return res.status(404).json({ error: "Lorebook entry not found" });

  const scopeError = await assertScopeOwnership(userId, parsed.data.conversationId, parsed.data.characterId);
  if (scopeError) return res.status(404).json({ error: scopeError });

  const updated = await prisma.roleplayLorebookEntry.update({
    where: { id: entry.id },
    data: {
      ...parsed.data,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const entry = await prisma.roleplayLorebookEntry.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    select: { id: true },
  });
  if (!entry) return res.status(404).json({ error: "Lorebook entry not found" });

  await prisma.roleplayLorebookEntry.delete({ where: { id: entry.id } });
  return res.status(204).send();
});

export default router;