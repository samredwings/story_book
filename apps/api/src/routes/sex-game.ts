import { Router, type Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import {
  createSession,
  getGameSession,
  getAvailableChoices,
  processGameAction,
  generateStartScene,
} from "../services/sexgame/service";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const startGameSchema = z.object({
  characterName: z.string().trim().min(1).max(80).optional(),
  characterId: z.string().trim().min(1).max(120).optional(),
  characterImageUrl: z.string().url().max(1000).optional(),
  relationshipType: z.string().trim().max(60).optional(),
  scenario: z.string().trim().max(500).optional(),
  language: z.enum(["ENGLISH", "BANGLA"]).default("ENGLISH"),
  intensity: z.number().int().min(1).max(10).default(9),
  generateImage: z.boolean().default(false), // reserved; scene images not wired yet
});

const actionSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
  choiceId: z.number().int().min(1).max(100),
  version: z.number().int().min(0),
  generateImage: z.boolean().default(false),
});

const sessionIdSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sex-game/start
// ─────────────────────────────────────────────────────────────────────────────

router.post("/start", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const input = startGameSchema.parse(req.body);

    // Character enrichment can be added later.
    // For now we pass sanitized values straight to the service.

    const session = await createSession(userId, {
      characterName: input.characterName,
      characterImageUrl: input.characterImageUrl,
      relationshipType: input.relationshipType || "partner",
      scenario:
        input.scenario ||
        "A filthy, desperate fuck where you use her tight holes until she’s shaking, drooling, and leaking cum from her used pussy",
      language: input.language,
      intensity: input.intensity,
    });

    const scene = await generateStartScene(session);

    return res.status(201).json({
      success: true,
      sessionId: session.id,
      session: {
        id: session.id,
        characterName: session.characterName,
        characterImageUrl: session.characterImageUrl,
        relationshipType: session.relationshipType,
        scenario: session.scenario,
        language: session.language,
        intensity: session.intensity,
        phase: session.phase,
        version: session.version,
        createdAt: session.createdAt,
      },
      game: scene,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.issues,
      });
    }

    console.error("[sexgame] start error:", error);
    return res.status(500).json({ error: "Failed to start the game." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sex-game/act
// ─────────────────────────────────────────────────────────────────────────────

router.post("/act", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const input = actionSchema.parse(req.body);

    const session = await getGameSession(input.sessionId, userId);

    if (!session) {
      return res.status(404).json({
        error: "Session not found or you do not have access to it.",
      });
    }

    // Optimistic concurrency check (will later move fully into the service)
    if (session.version !== input.version) {
      return res.status(409).json({
        error: "Session is out of date. Refresh and try again.",
        version: session.version,
      });
    }

    const result = await processGameAction(
      input.sessionId,
      userId,
      input.choiceId,
    );

    if ("error" in result) {
      const message = result.error;

      if (message === "Unauthorized") {
        return res.status(403).json({ error: message });
      }
      if (message.includes("not found")) {
        return res.status(404).json({ error: message });
      }
      if (message.includes("changed") || message.includes("version")) {
        return res.status(409).json({ error: message });
      }

      return res.status(400).json({ error: message });
    }

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      game: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.issues,
      });
    }

    console.error("[sexgame] action error:", error);
    return res.status(500).json({ error: "Failed to process the action." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sex-game/status/:sessionId
// ─────────────────────────────────────────────────────────────────────────────

router.get("/status/:sessionId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const parsed = sessionIdSchema.parse(req.params);

    const session = await getGameSession(parsed.sessionId, userId);

    if (!session) {
      return res.status(404).json({
        error: "Session not found or you do not have access to it.",
      });
    }

    const lastEntry = session.history.at(-1);

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      session: {
        id: session.id,
        characterName: session.characterName,
        characterImageUrl: session.characterImageUrl,
        relationshipType: session.relationshipType,
        scenario: session.scenario,
        language: session.language,
        intensity: session.intensity,
        phase: session.phase,
        version: session.version,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      },
      game: {
        phase: session.phase,
        arousal: session.arousal,
        stamina: session.stamina,
        round: session.round,
        description: lastEntry?.description ?? "",
        choices: getAvailableChoices(session),
        climaxCount: session.climaxCount,
        sessionComplete:
          session.phase === "AFTERCARE" &&
          session.history.length > 0 &&
          lastEntry?.phase === "AFTERCARE",
        version: session.version,
      },
      history: session.history,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid session ID.",
        details: error.issues,
      });
    }

    console.error("[sexgame] status error:", error);
    return res.status(500).json({ error: "Failed to retrieve session." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/sex-game/:sessionId  (placeholder)
// ─────────────────────────────────────────────────────────────────────────────

router.delete("/:sessionId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const parsed = sessionIdSchema.parse(req.params);

    const session = await getGameSession(parsed.sessionId, userId);

    if (!session) {
      return res.status(404).json({ error: "Session not found." });
    }

    // Intentionally not implemented yet – wait until the service
    // exposes a canonical deleteSession function.
    return res.status(501).json({
      error: "Session deletion is not enabled yet.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid session ID.",
        details: error.issues,
      });
    }

    console.error("[sexgame] delete error:", error);
    return res.status(500).json({ error: "Failed to delete session." });
  }
});

export default router;
