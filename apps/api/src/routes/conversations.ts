import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const participantSchema = z.object({
  characterId: z.string().min(1),
  displayName: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

const conversationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  language: z.string().trim().min(2).max(20).default("en"),
  participants: z.array(participantSchema).max(20).default([]),
});

const messageSchema = z.object({
  content: z.string().trim().min(1).max(20000),
  role: z.enum(["USER", "CHARACTER", "SYSTEM"]).default("USER"),
  participantId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const messagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

async function ownedConversation(userId: string, conversationId: string) {
  return prisma.roleplayConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
}

async function ownedCharacter(userId: string, characterId: string) {
  return prisma.character.findFirst({
    where: { id: characterId, userId },
    select: { id: true, name: true },
  });
}

router.get("/", async (req: AuthRequest, res: Response) => {
  const conversations = await prisma.roleplayConversation.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      participants: { orderBy: { sortOrder: "asc" } },
      _count: { select: { messages: true } },
    },
  });
  return res.json(conversations);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = conversationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const characterIds = parsed.data.participants.map((participant) => participant.characterId);
  if (new Set(characterIds).size !== characterIds.length) {
    return res.status(400).json({ error: "A character can only appear once in a conversation" });
  }

  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId },
    select: { id: true, name: true },
  });
  if (characters.length !== characterIds.length) {
    return res.status(404).json({ error: "Character not found" });
  }
  const names = new Map(characters.map((character) => [character.id, character.name]));

  const conversation = await prisma.roleplayConversation.create({
    data: {
      userId,
      title: parsed.data.title,
      language: parsed.data.language,
      participants: {
        create: parsed.data.participants.map((participant) => ({
          type: "CHARACTER",
          characterId: participant.characterId,
          displayName: participant.displayName || names.get(participant.characterId)!,
          sortOrder: participant.sortOrder,
        })),
      },
    },
    include: { participants: { orderBy: { sortOrder: "asc" } } },
  });
  return res.status(201).json(conversation);
});

router.get("/:conversationId", async (req: AuthRequest, res: Response) => {
  if (!(await ownedConversation(req.userId!, req.params.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const conversation = await prisma.roleplayConversation.findUnique({
    where: { id: req.params.conversationId },
    include: {
      participants: { orderBy: { sortOrder: "asc" } },
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  return res.json(conversation);
});

router.patch("/:conversationId", async (req: AuthRequest, res: Response) => {
  const parsed = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    language: z.string().trim().min(2).max(20).optional(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
  if (!(await ownedConversation(req.userId!, req.params.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const conversation = await prisma.roleplayConversation.update({
    where: { id: req.params.conversationId },
    data: parsed.data,
  });
  return res.json(conversation);
});

router.delete("/:conversationId", async (req: AuthRequest, res: Response) => {
  if (!(await ownedConversation(req.userId!, req.params.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  await prisma.roleplayConversation.delete({ where: { id: req.params.conversationId } });
  return res.status(204).send();
});

router.post("/:conversationId/participants", async (req: AuthRequest, res: Response) => {
  const parsed = participantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
  const userId = req.userId!;
  const conversationId = req.params.conversationId;
  if (!(await ownedConversation(userId, conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const character = await ownedCharacter(userId, parsed.data.characterId);
  if (!character) return res.status(404).json({ error: "Character not found" });

  const participant = await prisma.roleplayParticipant.create({
    data: {
      conversationId,
      type: "CHARACTER",
      characterId: character.id,
      displayName: parsed.data.displayName || character.name,
      sortOrder: parsed.data.sortOrder,
    },
  });
  return res.status(201).json(participant);
});

router.get("/:conversationId/messages", async (req: AuthRequest, res: Response) => {
  const parsed = messagesQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
  if (!(await ownedConversation(req.userId!, req.params.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const messages = await prisma.roleplayMessage.findMany({
    where: {
      conversationId: req.params.conversationId,
      ...(parsed.data.before ? { createdAt: { lt: new Date(parsed.data.before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
  });
  return res.json(messages.reverse());
});

router.post("/:conversationId/messages", async (req: AuthRequest, res: Response) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
  const userId = req.userId!;
  const conversationId = req.params.conversationId;
  if (!(await ownedConversation(userId, conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (parsed.data.role === "CHARACTER" && !parsed.data.participantId) {
    return res.status(400).json({ error: "Character messages require a participant" });
  }
  if (parsed.data.participantId) {
    const participant = await prisma.roleplayParticipant.findFirst({
      where: { id: parsed.data.participantId, conversationId },
      select: { id: true, type: true },
    });
    if (!participant) return res.status(404).json({ error: "Participant not found" });
    if (parsed.data.role === "CHARACTER" && participant.type !== "CHARACTER") {
      return res.status(400).json({ error: "Character messages require a character participant" });
    }
  }

  const message = await prisma.roleplayMessage.create({
    data: {
      conversationId,
      role: parsed.data.role,
      content: parsed.data.content,
      participantId: parsed.data.participantId,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.status(201).json(message);
});

export default router;