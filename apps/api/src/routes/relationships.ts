import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const relationshipSchema = z.object({
  conversationId: z.string().min(1),
  characterAId: z.string().min(1),
  characterBId: z.string().min(1),
  type: z.string().trim().min(1).max(100),
  score: z.number().min(-1).max(1).default(0),
  facts: z.array(z.string().trim().min(1).max(1000)).max(100).default([]),
  metadata: z.record(z.unknown()).optional(),
}).refine((data) => data.characterAId !== data.characterBId, {
  message: "A relationship requires two different characters",
  path: ["characterBId"],
});

const listSchema = z.object({
  conversationId: z.string().min(1),
  characterId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

async function ownedCharacters(userId: string, characterIds: string[]) {
  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId },
    select: { id: true },
  });
  return characters.length === new Set(characterIds).size;
}

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

  const relationships = await prisma.roleplayRelationship.findMany({
    where: {
      userId,
      conversationId: filters.conversationId,
      ...(filters.characterId
        ? { OR: [{ characterAId: filters.characterId }, { characterBId: filters.characterId }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: filters.limit,
  });
  return res.json(relationships);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = relationshipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const data = parsed.data;
  if (!(await ownedConversation(userId, data.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  if (!(await ownedCharacters(userId, [data.characterAId, data.characterBId]))) {
    return res.status(404).json({ error: "Character not found" });
  }

  const relationship = await prisma.roleplayRelationship.upsert({
    where: {
      conversationId_characterAId_characterBId: {
        conversationId: data.conversationId,
        characterAId: data.characterAId,
        characterBId: data.characterBId,
      },
    },
    create: {
      ...data,
      userId,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      type: data.type,
      score: data.score,
      facts: data.facts,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.status(200).json(relationship);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const relationship = await prisma.roleplayRelationship.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    select: { id: true },
  });
  if (!relationship) return res.status(404).json({ error: "Relationship not found" });

  await prisma.roleplayRelationship.delete({ where: { id: relationship.id } });
  return res.status(204).send();
});

export default router;