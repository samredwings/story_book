import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const sceneStateSchema = z.object({
  description: z.string().trim().min(1).max(20000),
  location: z.string().trim().max(500).optional(),
  cameraMode: z.enum(["FIRST_PERSON", "THIRD_PERSON", "OVER_SHOULDER", "CINEMATIC"]).default("THIRD_PERSON"),
  participantIds: z.array(z.string().min(1)).max(100).default([]),
  variables: z.record(z.unknown()).default({}),
});

async function ownedConversation(userId: string, conversationId: string) {
  return prisma.roleplayConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
}

async function validParticipants(conversationId: string, participantIds: string[]) {
  if (new Set(participantIds).size !== participantIds.length) return false;
  const participants = await prisma.roleplayParticipant.findMany({
    where: { id: { in: participantIds }, conversationId },
    select: { id: true },
  });
  return participants.length === participantIds.length;
}

router.get("/:conversationId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!(await ownedConversation(userId, req.params.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const state = await prisma.roleplaySceneState.findUnique({
    where: { conversationId: req.params.conversationId },
  });
  return res.json(state);
});

router.put("/:conversationId", async (req: AuthRequest, res: Response) => {
  const parsed = sceneStateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const conversationId = req.params.conversationId;
  if (!(await ownedConversation(userId, conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  if (!(await validParticipants(conversationId, parsed.data.participantIds))) {
    return res.status(400).json({ error: "All participants must belong to the conversation" });
  }

  const state = await prisma.roleplaySceneState.upsert({
    where: { conversationId },
    create: {
      ...parsed.data,
      userId,
      conversationId,
      variables: parsed.data.variables as Prisma.InputJsonValue,
    },
    update: {
      ...parsed.data,
      variables: parsed.data.variables as Prisma.InputJsonValue,
    },
  });
  return res.json(state);
});

router.delete("/:conversationId", async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  if (!(await ownedConversation(userId, req.params.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await prisma.roleplaySceneState.deleteMany({
    where: { conversationId: req.params.conversationId, userId },
  });
  return res.status(204).send();
});

export default router;