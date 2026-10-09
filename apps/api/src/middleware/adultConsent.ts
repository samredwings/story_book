import { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { evaluateConsent } from "../lib/age-consent";
import type { AuthRequest } from "./auth";

/**
 * Blocks access to adult content routes until the user has:
 * - verified age (DOB >= MIN_AGE) when required
 * - accepted current Terms, Privacy, and Adult Content notices
 */
export async function requireAdultConsent(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        status: true,
        dateOfBirth: true,
        termsAcceptedAt: true,
        privacyAcceptedAt: true,
        adultContentAcknowledgedAt: true,
        termsVersion: true,
        privacyVersion: true,
        adultContentVersion: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    const consent = evaluateConsent(user);

    if (!consent.complete) {
      if (consent.missing.includes("UNDERAGE")) {
        return res.status(403).json({
          error: "Age requirement not met",
          code: "UNDERAGE",
          minAge: consent.minAge,
          missing: consent.missing,
        });
      }
      return res.status(403).json({
        error: "Legal consent required before accessing adult content",
        code: "CONSENT_REQUIRED",
        missing: consent.missing,
        versions: consent.versions,
        consentPath: "/api/auth/consent",
      });
    }

    next();
  } catch {
    return res.status(500).json({ error: "Consent check failed" });
  }
}
