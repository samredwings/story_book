import { describe, expect, test } from "vitest";
import { sessionOptionsSchema } from "../services/sexgame/validators";

describe("sessionOptionsSchema", () => {
  test("accepts empty object (all optional)", () => {
    const parsed = sessionOptionsSchema.parse({});
    expect(parsed).toEqual({});
  });

  test("accepts valid options", () => {
    const parsed = sessionOptionsSchema.parse({
      characterName: "Alex",
      intensity: 7,
      language: "ENGLISH",
      scenario: "Private cabin",
    });
    expect(parsed.characterName).toBe("Alex");
    expect(parsed.intensity).toBe(7);
    expect(parsed.language).toBe("ENGLISH");
  });

  test("rejects intensity out of range", () => {
    expect(() => sessionOptionsSchema.parse({ intensity: 0 })).toThrow();
    expect(() => sessionOptionsSchema.parse({ intensity: 11 })).toThrow();
  });

  test("rejects empty character name when provided", () => {
    expect(() => sessionOptionsSchema.parse({ characterName: "   " })).toThrow();
  });

  test("rejects invalid language", () => {
    expect(() =>
      sessionOptionsSchema.parse({ language: "FRENCH" }),
    ).toThrow();
  });
});
