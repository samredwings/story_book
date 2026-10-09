import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ageFromDateOfBirth,
  isAtLeastAge,
  parseDateOfBirth,
  evaluateConsentWithPolicy,
  LEGAL_VERSIONS,
} from "../../lib/age-consent.ts";

const policy = { minAge: 18, requireAge: true };

describe("age-consent", () => {
  it("computes age and rejects underage", () => {
    const adult = parseDateOfBirth("1990-06-15");
    assert.ok(adult);
    assert.equal(isAtLeastAge(adult!, 18), true);
    assert.ok(ageFromDateOfBirth(adult!) >= 18);

    const teen = parseDateOfBirth("2015-01-01");
    assert.ok(teen);
    assert.equal(isAtLeastAge(teen!, 18), false);

    assert.equal(parseDateOfBirth("not-a-date"), null);
    assert.equal(parseDateOfBirth("2099-01-01"), null);
  });

  it("requires full consent set", () => {
    const incomplete = evaluateConsentWithPolicy(
      {
        dateOfBirth: null,
        termsAcceptedAt: null,
        privacyAcceptedAt: null,
        adultContentAcknowledgedAt: null,
      },
      policy,
    );
    assert.equal(incomplete.complete, false);
    assert.ok(incomplete.missing.includes("DATE_OF_BIRTH"));
    assert.ok(incomplete.missing.includes("TERMS"));
    assert.ok(incomplete.missing.includes("PRIVACY"));
    assert.ok(incomplete.missing.includes("ADULT_CONTENT"));

    const now = new Date();
    const complete = evaluateConsentWithPolicy(
      {
        dateOfBirth: new Date("1995-03-10"),
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        adultContentAcknowledgedAt: now,
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
        adultContentVersion: LEGAL_VERSIONS.adultContent,
      },
      policy,
    );
    assert.equal(complete.complete, true);
    assert.deepEqual(complete.missing, []);
  });

  it("flags stale legal versions", () => {
    const now = new Date();
    const stale = evaluateConsentWithPolicy(
      {
        dateOfBirth: new Date("1990-01-01"),
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        adultContentAcknowledgedAt: now,
        termsVersion: "2020-01-01",
        privacyVersion: "2020-01-01",
        adultContentVersion: "2020-01-01",
      },
      policy,
    );
    assert.equal(stale.complete, false);
    assert.ok(stale.missing.includes("TERMS"));
    assert.ok(stale.missing.includes("PRIVACY"));
    assert.ok(stale.missing.includes("ADULT_CONTENT"));
  });
});
