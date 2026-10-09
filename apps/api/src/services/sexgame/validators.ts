import type {
  SexGameSession,
} from "./types";

const MAX_CHARACTER_NAME = 80;
const MAX_RELATIONSHIP_TYPE = 60;
const MAX_SCENARIO = 500;
const MAX_IMAGE_URL = 1000;
const MAX_SESSION_ID = 120;

export interface SessionCreateOptions {
  characterName?: string;
  characterImageUrl?: string;
  relationshipType?: string;
  scenario?: string;
  language?: "ENGLISH" | "BANGLA";
  intensity?: number;
}

export interface ValidatedSessionCreateOptions {
  characterName: string;
  characterImageUrl?: string;
  relationshipType: string;
  scenario: string;
  language: "ENGLISH" | "BANGLA";
  intensity: number;
}

export function sanitizeText(
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    return "";
  }

  const withoutControlCharacters = value
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f ? " " : character;
    })
    .join("");

  return withoutControlCharacters
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUrl(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > MAX_IMAGE_URL
  ) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return undefined;
    }

    return normalized;
  } catch {
    return undefined;
  }
}

export function validateChoiceId(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
  );
}

export function validateSessionId(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_SESSION_ID
  );
}

export function validateSessionCreateOptions(
  options: SessionCreateOptions = {},
): ValidatedSessionCreateOptions {
  const intensity = options.intensity ?? 7;

  if (
    !Number.isInteger(intensity) ||
    intensity < 1 ||
    intensity > 10
  ) {
    throw new Error(
      "Intensity must be an integer between 1 and 10.",
    );
  }

  if (
    options.language !== undefined &&
    options.language !== "ENGLISH" &&
    options.language !== "BANGLA"
  ) {
    throw new Error(
      "Unsupported language. Use ENGLISH or BANGLA.",
    );
  }

  return {
    characterName: sanitizeText(
      options.characterName,
      MAX_CHARACTER_NAME,
    ),
    characterImageUrl: sanitizeUrl(
      options.characterImageUrl,
    ),
    relationshipType: sanitizeText(
      options.relationshipType,
      MAX_RELATIONSHIP_TYPE,
    ),
    scenario: sanitizeText(
      options.scenario,
      MAX_SCENARIO,
    ),
    language: options.language ?? "ENGLISH",
    intensity,
  };
}

export function isSessionOwnedBy(
  session: SexGameSession,
  userId: string,
): boolean {
  return (
    typeof userId === "string" &&
    userId.trim().length > 0 &&
    session.userId === userId.trim()
  );
}
