import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Isolate env before importing modules that read config
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.REQUIRE_AGE_VERIFICATION = "true";
  process.env.MIN_AGE = "18";
  process.env.JWT_SECRET = "test-secret-key-at-least-32-characters-long";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://storybook:storybook123@localhost:5432/image_video_storybook";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("age-consent helpers", () => {
  it("computes age and underage correctly", async () => {
    const { ageFromDateOfBirth, isAtLeastAge, parseDateOfBirth } =
      await import("../lib/age-consent");

    const adult = parseDateOfBirth("1990-06-15");
    expect(adult).not.toBeNull();
    expect(isAtLeastAge(adult!, 18)).toBe(true);
    expect(ageFromDateOfBirth(adult!)).toBeGreaterThanOrEqual(18);

    const teen = parseDateOfBirth("2015-01-01");
    expect(teen).not.toBeNull();
    expect(isAtLeastAge(teen!, 18)).toBe(false);

    expect(parseDateOfBirth("not-a-date")).toBeNull();
    expect(parseDateOfBirth("2099-01-01")).toBeNull();
  });

  it("requires terms, privacy, adult ack and DOB", async () => {
    const { evaluateConsent, LEGAL_VERSIONS } = await import(
      "../lib/age-consent"
    );

    const incomplete = evaluateConsent({
      dateOfBirth: null,
      termsAcceptedAt: null,
      privacyAcceptedAt: null,
      adultContentAcknowledgedAt: null,
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missing).toContain("DATE_OF_BIRTH");
    expect(incomplete.missing).toContain("TERMS");
    expect(incomplete.missing).toContain("PRIVACY");
    expect(incomplete.missing).toContain("ADULT_CONTENT");

    const now = new Date();
    const complete = evaluateConsent({
      dateOfBirth: new Date("1995-03-10"),
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      adultContentAcknowledgedAt: now,
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      adultContentVersion: LEGAL_VERSIONS.adultContent,
    });
    expect(complete.complete).toBe(true);
    expect(complete.missing).toEqual([]);
  });

  it("flags outdated legal versions as incomplete", async () => {
    const { evaluateConsent } = await import("../lib/age-consent");
    const now = new Date();
    const stale = evaluateConsent({
      dateOfBirth: new Date("1990-01-01"),
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      adultContentAcknowledgedAt: now,
      termsVersion: "2020-01-01",
      privacyVersion: "2020-01-01",
      adultContentVersion: "2020-01-01",
    });
    expect(stale.complete).toBe(false);
    expect(stale.missing).toEqual(
      expect.arrayContaining(["TERMS", "PRIVACY", "ADULT_CONTENT"]),
    );
  });
});
