import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { config } from "../config";
import { AuthRequest, signToken, authMiddleware } from "../middleware/auth";
import { logger } from "../lib/logger";
import {
  LEGAL_VERSIONS,
  evaluateConsent,
  isAtLeastAge,
  parseDateOfBirth,
} from "../lib/age-consent";

const router = Router();

const loginSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
  password: z.string().min(1).max(128),
});

const consentSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  acceptedTerms: z.boolean().optional(),
  acceptedPrivacy: z.boolean().optional(),
  acceptedAdultContent: z.boolean().optional(),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
  keyGenerator: (req) => `login:${req.ip ?? "anon"}`,
});

const consentLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many consent updates. Try again later." },
});

const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

function recordFailure(key: string) {
  const now = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry || entry.lockedUntil < now) {
    failedAttempts.set(key, { count: 1, lockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
  }
}

function isLocked(key: string): { locked: boolean; until: number } {
  const entry = failedAttempts.get(key);
  if (!entry) return { locked: false, until: 0 };
  if (entry.lockedUntil > Date.now()) {
    return { locked: true, until: entry.lockedUntil };
  }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    failedAttempts.delete(key);
  }
  return { locked: false, until: 0 };
}

function clearFailures(key: string) {
  failedAttempts.delete(key);
}

const consentSelect = {
  dateOfBirth: true,
  termsAcceptedAt: true,
  privacyAcceptedAt: true,
  adultContentAcknowledgedAt: true,
  termsVersion: true,
  privacyVersion: true,
  adultContentVersion: true,
} as const;

router.get("/legal", (_req: Request, res: Response) => {
  res.json({
    minAge: config.age.min,
    requireAgeVerification: config.age.requireVerification,
    versions: LEGAL_VERSIONS,
    notices: {
      terms: "By using this service you agree to the Terms of Service.",
      privacy: "By using this service you agree to the Privacy Policy.",
      adultContent:
        "This platform contains and generates unrestricted hardcore adult content: explicit sex, detailed fucking, cum, oral, anal, and graphic sexual acts. You confirm you are of legal age and want full access to this material.",
    },
  });
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const lockKey = `login:${data.email}`;
    const lock = isLocked(lockKey);
    if (lock.locked) {
      return res.status(429).json({
        error: "Account temporarily locked. Try again later.",
        retryAfter: Math.ceil((lock.until - Date.now()) / 1000),
      });
    }
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        password: true,
        status: true,
        ...consentSelect,
      },
    });
    if (!user) {
      recordFailure(lockKey);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account not active" });
    }
    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      recordFailure(lockKey);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    clearFailures(lockKey);
    const consent = evaluateConsent(user);
    const token = signToken(user.id);
    logger.info({ userId: user.id, consentComplete: consent.complete }, "user logged in");
    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
      consent,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid login data" });
    }
    logger.error({ err }, "login error");
    res.status(500).json({ error: "Login failed" });
  }
});

/** Return current consent status for the authenticated user */
router.get("/consent", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: consentSelect,
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(evaluateConsent(user));
  } catch (err) {
    logger.error({ err }, "consent status error");
    res.status(500).json({ error: "Failed to load consent status" });
  }
});

/**
 * Complete or refresh legal consent (DOB + terms/privacy/adult ack).
 * Used for legacy accounts and when legal document versions change.
 */
router.post(
  "/consent",
  authMiddleware,
  consentLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = consentSchema.parse(req.body);
      const existing = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, status: true, ...consentSelect },
      });
      if (!existing || existing.status !== "ACTIVE") {
        return res.status(404).json({ error: "User not found" });
      }
      const update: Record<string, unknown> = {};
      const now = new Date();
      if (data.dateOfBirth) {
        const dob = parseDateOfBirth(data.dateOfBirth);
        if (!dob) {
          return res.status(400).json({ error: "Invalid date of birth" });
        }
        if (
          (config.age.requireVerification || config.isProduction) &&
          !isAtLeastAge(dob, config.age.min)
        ) {
          return res.status(403).json({
            error: `You must be at least ${config.age.min} years old`,
            code: "UNDERAGE",
            minAge: config.age.min,
          });
        }
        update.dateOfBirth = dob;
      }
      if (data.acceptedTerms === true) {
        update.termsAcceptedAt = now;
        update.termsVersion = LEGAL_VERSIONS.terms;
      }
      if (data.acceptedPrivacy === true) {
        update.privacyAcceptedAt = now;
        update.privacyVersion = LEGAL_VERSIONS.privacy;
      }
      if (data.acceptedAdultContent === true) {
        update.adultContentAcknowledgedAt = now;
        update.adultContentVersion = LEGAL_VERSIONS.adultContent;
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({
          error: "Provide dateOfBirth and/or acceptance flags to update",
        });
      }
      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: update,
        select: consentSelect,
      });
      const consent = evaluateConsent(user);
      logger.info(
        { userId: req.userId, complete: consent.complete, missing: consent.missing },
        "consent updated",
      );
      res.json({ success: true, consent });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid consent data",
          details: err.flatten().fieldErrors,
        });
      }
      logger.error({ err }, "consent update error");
      res.status(500).json({ error: "Failed to update consent" });
    }
  },
);

router.post("/logout", (_req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
