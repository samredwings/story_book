import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const router = Router();

const createSchema = z.object({
  conversationId: z.string().min(1),
  provider: z.string().trim().min(1).max(50).default("webrtc"),
  audioEnabled: z.boolean().default(true),
  videoEnabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  status: z.enum(["CREATED", "CONNECTING", "ACTIVE", "ENDED", "FAILED"]).optional(),
  audioEnabled: z.boolean().optional(),
  videoEnabled: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

async function ownedConversation(userId: string, conversationId: string) {
  return prisma.roleplayConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
}

async function ownedSession(userId: string, sessionId: string) {
  return prisma.videoCallSession.findFirst({
    where: { id: sessionId, userId },
  });
}

router.get("/", async (req: AuthRequest, res: Response) => {
  const conversationId = typeof req.query.conversationId === "string"
    ? req.query.conversationId
    : undefined;
  if (conversationId && !(await ownedConversation(req.userId!, conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const sessions = await prisma.videoCallSession.findMany({
    where: { userId: req.userId!, conversationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json(sessions);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const userId = req.userId!;
  const data = parsed.data;
  if (!(await ownedConversation(userId, data.conversationId))) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  const session = await prisma.videoCallSession.create({
    data: {
      ...data,
      userId,
      roomId: crypto.randomUUID(),
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  return res.status(201).json(session);
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) return res.status(404).json({ error: "Video call session not found" });
  return res.json(session);
});

router.patch("/:id", async (req: AuthRequest, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) return res.status(404).json({ error: "Video call session not found" });
  if (session.status === "ENDED" || session.status === "FAILED") {
    return res.status(409).json({ error: "Video call session is closed" });
  }

  const status = parsed.data.status;
  const now = new Date();
  const updated = await prisma.videoCallSession.update({
    where: { id: session.id },
    data: {
      ...parsed.data,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      ...(status === "ACTIVE" && !session.startedAt ? { startedAt: now } : {}),
      ...(status === "ENDED" || status === "FAILED" ? { endedAt: now } : {}),
    },
  });
  return res.json(updated);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) return res.status(404).json({ error: "Video call session not found" });
  await prisma.videoCallSession.delete({ where: { id: session.id } });
  return res.status(204).send();
});

export default router;