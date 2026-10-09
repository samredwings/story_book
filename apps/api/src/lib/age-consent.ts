/** Bump these when legal documents change so users must re-accept. */
export const LEGAL_VERSIONS = {
  terms: "2026-09-03",
  privacy: "2026-09-03",
  adultContent: "2026-09-03",
} as const;

export type ConsentUser = {
  dateOfBirth: Date | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  adultContentAcknowledgedAt?: Date | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
  adultContentVersion?: string | null;
};

export type ConsentGap =
  | "DATE_OF_BIRTH"
  | "UNDERAGE"
  | "TERMS"
  | "PRIVACY"
  | "ADULT_CONTENT";

export type ConsentPolicy = {
  minAge: number;
  requireAge: boolean;
};

export function ageFromDateOfBirth(dob: Date, now = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function isAtLeastAge(dob: Date, minAge: number, now = new Date()): boolean {
  return ageFromDateOfBirth(dob, now) >= minAge;
}

export function parseDateOfBirth(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const dob = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  if (dob.getTime() > now.getTime()) return null;
  if (ageFromDateOfBirth(dob, now) > 120) return null;
  return dob;
}

export function evaluateConsentWithPolicy(
  user: ConsentUser,
  policy: ConsentPolicy,
): {
  complete: boolean;
  missing: ConsentGap[];
  age: number | null;
  minAge: number;
  versions: typeof LEGAL_VERSIONS;
} {
  const missing: ConsentGap[] = [];
  const minAge = policy.minAge;
  let age: number | null = null;

  if (policy.requireAge) {
    if (!user.dateOfBirth) {
      missing.push("DATE_OF_BIRTH");
    } else {
      age = ageFromDateOfBirth(user.dateOfBirth);
      if (!isAtLeastAge(user.dateOfBirth, minAge)) {
        missing.push("UNDERAGE");
      }
    }
  }

  if (!user.termsAcceptedAt || user.termsVersion !== LEGAL_VERSIONS.terms) {
    missing.push("TERMS");
  }

  if (!user.privacyAcceptedAt || user.privacyVersion !== LEGAL_VERSIONS.privacy) {
    missing.push("PRIVACY");
  }

  if (
    !user.adultContentAcknowledgedAt ||
    user.adultContentVersion !== LEGAL_VERSIONS.adultContent
  ) {
    missing.push("ADULT_CONTENT");
  }

  return {
    complete: missing.length === 0,
    missing,
    age,
    minAge,
    versions: LEGAL_VERSIONS,
  };
}

/** Runtime wrapper — reads app config. Prefer evaluateConsentWithPolicy in tests. */
export function evaluateConsent(user: ConsentUser) {
  // Lazy require keeps pure helpers importable without env bootstrap.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { config } = require("../config") as typeof import("../config");
  return evaluateConsentWithPolicy(user, {
    minAge: config.age.min,
    requireAge: config.age.requireVerification || config.isProduction,
  });
}
