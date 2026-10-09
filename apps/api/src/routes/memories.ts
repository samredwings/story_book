import { Router, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const memorySchema = z.object({
  conversationId: z.string().min(1),
  characterId: z.string().min(1).optional(),
  type: z.enum(["SHORT_TERM", "EPISODIC", "FACT", "RELATIONSHIP", "CHARACTER", "WORLD"]),
  scope: z.enum(["CONVERSATION", "CHARACTER", "SHARED", "PRIVATE"]),
  content: z.string().trim().min(1).max(10000),
  importance: z.number().min(0).max(1).default(0.5),
  metadata: z.record(z.unknown()).optional(),
});

const listSchema = z.object({
  conversationId: z.string().min(1),
  characterId: z.string().min(1).optional(),
  type: z.enum(["SHORT_TERM", "EPISODIC", "FACT", "RELATIONSHIP", "CHARACTER", "WORLD"]).optional(),
  scope: z.enum(["CONVERSATION", "CHARACTER", "SHARED", "PRIVATE"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

async function ownedConversation(userId: string, conversationId: string) {
  return prisma.roleplayConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
}

router.get("/", async (req: AuthRequest, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const filters = parsed.data;
  if (!(await ownedConversation(userId, filters.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const memories = await prisma.roleplayMemory.findMany({
    where: {
      userId,
      conversationId: filters.conversationId,
      characterId: filters.characterId,
      type: filters.type,
      scope: filters.scope,
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: filters.limit,
  });

  return res.json(memories);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = memorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const data = parsed.data;
  if (!(await ownedConversation(userId, data.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (data.characterId) {
    const character = await prisma.character.findFirst({
      where: { id: data.characterId, userId },
      select: { id: true },
    });
    if (!character) return res.status(404).json({ error: "Character not found" });
  }

  const memory = await prisma.roleplayMemory.create({
    data: {
      ...data,
      userId,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.status(201).json(memory);
});

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const parsed = memorySchema.partial().omit({ conversationId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const memory = await prisma.roleplayMemory.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!memory) return res.status(404).json({ error: "Memory not found" });

  if (parsed.data.characterId) {
    const character = await prisma.character.findFirst({
      where: { id: parsed.data.characterId, userId: req.userId! },
      select: { id: true },
    });
    if (!character) return res.status(404).json({ error: "Character not found" });
  }

  const updated = await prisma.roleplayMemory.update({
    where: { id: memory.id },
    data: {
      ...parsed.data,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const memory = await prisma.roleplayMemory.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    select: { id: true },
  });
  if (!memory) return res.status(404).json({ error: "Memory not found" });

  await prisma.roleplayMemory.delete({ where: { id: memory.id } });
  return res.status(204).send();
});

export default router;