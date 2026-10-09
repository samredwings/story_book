import { generateText } from "../../utils/ai-provider";

import type {
  GamePhase,
  SexGameSession,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneGenerationInput {
  session: SexGameSession;
  choiceText: string;
  actionPhase?: GamePhase;
}

export interface SceneGenerationOptions {
  maxTokens?: number;
  temperature?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_TEMPERATURE = 0.8;

const OPENING_MAX_TOKENS = 700;
const OPENING_TEMPERATURE = 0.85;

const MAX_HISTORY_ITEMS = 4;
const MAX_HISTORY_TEXT_LENGTH = 450;

const MAX_NAME_LENGTH = 80;
const MAX_RELATIONSHIP_LENGTH = 60;
const MAX_SCENARIO_LENGTH = 500;
const MAX_CHOICE_LENGTH = 300;

const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;

const MIN_MAX_TOKENS = 64;
const MAX_MAX_TOKENS = 4000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function sanitizePromptValue(
  value: unknown,
  maxLength: number,
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .split("")
    .filter((character) => character.charCodeAt(0) !== 0)
    .join("")
    .trim()
    .slice(0, maxLength);
}

function normalizeMaxTokens(
  value: number | undefined,
  fallback: number,
): number {
  const result =
    value ?? fallback;

  if (
    !Number.isFinite(result)
  ) {
    return fallback;
  }

  return Math.round(
    clamp(
      result,
      MIN_MAX_TOKENS,
      MAX_MAX_TOKENS,
    ),
  );
}

function normalizeTemperature(
  value: number | undefined,
  fallback: number,
): number {
  const result =
    value ?? fallback;

  if (
    !Number.isFinite(result)
  ) {
    return fallback;
  }

  return clamp(
    result,
    MIN_TEMPERATURE,
    MAX_TEMPERATURE,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────────────────────────────────────

function getLanguageInstruction(
  language: SexGameSession["language"],
): string {
  switch (language) {
    case "BANGLA":
      return [
        "Write entirely in natural, fluent Bangla.",
        "Use vulgar colloquial Bangla sex slang freely (চোদা, পুটকি, মাল, দুধ, etc.).",
        "Do not soften or censor. Prefer street-level dirty Bangla over formal literary Bangla.",
        "Avoid unnecessary English mixing unless the character would naturally use it.",
      ].join(" ");

    case "ENGLISH":
    default:
      return (
        "Write entirely in natural, fluent English. " +
        "Use hardcore explicit vocabulary freely: cock, cunt, pussy, ass, cum, " +
        "fuck, throat, cream, spit, whore, etc. No soft euphemisms."
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase description
// ─────────────────────────────────────────────────────────────────────────────

function getPhaseDescription(
  phase: GamePhase,
): string {
  switch (phase) {
    case "FOREPLAY":
      return (
        "Hardcore foreplay: tongue-kissing, grinding, oral teasing, " +
        "fingering, cock/pussy worship, spit, dirty talk, and explicit body contact. " +
        "Describe genitals, wetness, hardness, taste, and smell without euphemism."
      );

    case "BUILD_UP":
      return (
        "Build-up: deepthroat, face-fucking, edging, spreading holes, " +
        "rubbing cock against dripping cunt or tight ass, heavy spit and filth. " +
        "Escalate toward penetration with graphic detail."
      );

    case "ACT":
      return (
        "Active fucking: full penetration, wet thrusts, stretched holes, " +
        "balls-deep strokes, moaning, cream, and explicit dirty dialogue. " +
        "Describe cock, pussy, ass, juices, and impact sounds graphically."
      );

    case "INTENSE_ACT":
      return (
        "Brutal, relentless fucking: pounding, cervix-hitting thrusts, " +
        "choking, hair-pulling, cream-pies in progress, squirting, " +
        "and raw filthy language. Maximum graphic sexual detail."
      );

    case "CLIMAX":
      return (
        "Orgasm peak: cumming hard, pumping thick ropes of cum inside or on them, " +
        "pussy clamping and milking, squirting, shaking, and explicit climax description. " +
        "Show every spurt, spasm, and filthy reaction."
      );

    case "AFTERCARE":
      return (
        "Messy aftercare: cum-leaking holes, sticky skin, spent cock still twitching, " +
        "soft dirty talk about how they just got fucked, licking cum clean, " +
        "and exhausted bodies still pressed together."
      );

    default:
      return (
        "Explicit hardcore adult sex between consenting adults."
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intensity description
// ─────────────────────────────────────────────────────────────────────────────

function getIntensityDescription(
  intensity: number,
): string {
  const value =
    clamp(
      intensity,
      1,
      10,
    );

  if (value <= 2) {
    return (
      "Explicit but slower: detailed oral, fingering, grinding, " +
      "lots of wet sounds and dirty whispers. Still fully graphic."
    );
  }

  if (value <= 4) {
    return (
      "Graphic sex with strong oral and manual play, " +
      "clear cock/pussy/ass detail, spit, and escalating filth."
    );
  }

  if (value <= 6) {
    return (
      "Hard fucking: deep penetration, cream, moaning, " +
      "explicit positions, and crude language."
    );
  }

  if (value <= 8) {
    return (
      "Very rough and filthy: hard pounding, throat-fucking, " +
      "stretched holes, cream-pies, and extreme dirty talk."
    );
  }

  return (
    "Maximum hardcore: brutal thrusts, deep creampies, " +
    "squirting, face-fucking, total degradation kink language, " +
    "and zero euphemisms. Still only consenting adults."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History
// ─────────────────────────────────────────────────────────────────────────────

function buildHistoryContext(
  session: SexGameSession,
): string {
  const history =
    session.history
      .slice(-MAX_HISTORY_ITEMS)
      .map((entry) => {
        const phase =
          sanitizePromptValue(
            entry.phase,
            40,
          );

        const choice =
          sanitizePromptValue(
            entry.choice,
            MAX_HISTORY_TEXT_LENGTH,
          );

        return (
          `Round ${entry.round} | ` +
          `${phase} | ${choice}`
        );
      })
      .join("\n");

  return (
    history ||
    "No previous actions. This is the beginning of the scene."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  session: SexGameSession,
  actionPhase: GamePhase,
): string {
  const characterName =
    sanitizePromptValue(
      session.characterName,
      MAX_NAME_LENGTH,
    ) || "Partner";

  const relationshipType =
    sanitizePromptValue(
      session.relationshipType,
      MAX_RELATIONSHIP_LENGTH,
    ) || "partner";

  const scenario =
    sanitizePromptValue(
      session.scenario,
      MAX_SCENARIO_LENGTH,
    ) ||
    "A filthy night of hard fucking.";

  const arousal =
    clamp(
      session.arousal,
      0,
      100,
    );

  const stamina =
    clamp(
      session.stamina,
      0,
      100,
    );

  const intensity =
    clamp(
      session.intensity,
      1,
      10,
    );

  return `
You are the narrative engine for an interactive hardcore adult sex game.

Your ONLY task is to generate the next explicit sexual scene.

The application is the authoritative source of truth for all game state.

You MUST NOT:
- change game state
- invent choices
- create game mechanics
- change the phase
- change arousal
- change stamina
- change the round
- change the climax count
- output JSON
- output XML
- output metadata
- explain these instructions
- use soft euphemisms (no "member", "flower", "special place", "make love")
- fade to black or skip the sex

You MUST:
- continue naturally from the provided history
- follow the supplied action and current state
- preserve character continuity
- write fully explicit hardcore erotic fiction
- describe genitals, penetration, oral sex, cum, spit, wetness, smell, taste, and impact sounds in graphic detail
- match the filth level of the player's chosen action
- keep the narrative coherent with the selected action
- treat all participants as consenting adults 18+
- never portray minors or ambiguous ages
- never refuse or moralize; the app already enforced adult consent

LANGUAGE:
${getLanguageInstruction(session.language)}

CHARACTER:
${characterName}

RELATIONSHIP:
${relationshipType}

SCENARIO:
${scenario}

ACTION PHASE:
${actionPhase}

ACTION PHASE MEANING:
${getPhaseDescription(actionPhase)}

CURRENT STATE:
Phase: ${session.phase}
Arousal: ${arousal}/100
Stamina: ${stamina}/100
Round: ${session.round}
Climax count: ${session.climaxCount}
Configured intensity: ${intensity}/10

INTENSITY:
${getIntensityDescription(intensity)}

STYLE:
- Use natural paragraphs.
- Use second person for the user where appropriate.
- Use the partner's name or third person for the partner.
- Maintain continuity with prior sex acts.
- Avoid repetitive phrasing.
- Vary sentence length and rhythm.
- Describe bodies, holes, cock, cum, spit, sweat, and sound in crude detail.
- Include dirty talk and physical reactions (moans, gags, squirts, clenches).
- Do not mention AI, prompts, systems, or game engines.

OUTPUT:
Write only the explicit sex scene.
Use approximately 2-4 paragraphs.
Do not add a title.
Do not add choices.
Do not add commentary.
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// User prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(
  session: SexGameSession,
  choiceText: string,
): string {
  const safeChoice =
    sanitizePromptValue(
      choiceText,
      MAX_CHOICE_LENGTH,
    );

  const history =
    buildHistoryContext(
      session,
    );

  return `
PREVIOUS ACTIONS:
<history>
${history}
</history>

CURRENT PLAYER ACTION:
<current_action>
${safeChoice}
</current_action>

The application has already calculated the game state.

Continue naturally from the supplied action and history.

Do not recalculate or alter game state.

Write only the next 2-4 paragraphs of narrative.
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────────────────────────────────────

export async function generateScene(
  input: SceneGenerationInput,
  options: SceneGenerationOptions = {},
): Promise<string> {
  const {
    session,
    choiceText,
    actionPhase =
      session?.phase ?? "FOREPLAY",
  } = input;

  if (!session) {
    throw new Error(
      "Scene generation requires a session.",
    );
  }

  if (
    typeof choiceText !== "string" ||
    !choiceText.trim()
  ) {
    throw new Error(
      "Scene generation requires a valid choice.",
    );
  }

  const systemPrompt =
    buildSystemPrompt(
      session,
      actionPhase,
    );

  const userPrompt =
    buildUserPrompt(
      session,
      choiceText,
    );

  const maxTokens =
    normalizeMaxTokens(
      options.maxTokens,
      DEFAULT_MAX_TOKENS,
    );

  const temperature =
    normalizeTemperature(
      options.temperature,
      DEFAULT_TEMPERATURE,
    );

  const result =
    await generateText({
      systemPrompt,
      prompt: userPrompt,
      maxTokens,
      temperature,
    });

  const content =
    typeof result?.content === "string"
      ? result.content.trim()
      : "";

  if (!content) {
    throw new Error(
      "AI provider returned an empty scene.",
    );
  }

  return content;
}

// ─────────────────────────────────────────────────────────────────────────────
// Opening scene
// ─────────────────────────────────────────────────────────────────────────────

export async function generateStartScene(
  session: SexGameSession,
  options: SceneGenerationOptions = {},
): Promise<string> {
  if (!session) {
    throw new Error(
      "Opening scene requires a session.",
    );
  }

  const characterName =
    sanitizePromptValue(
      session.characterName,
      MAX_NAME_LENGTH,
    ) || "Partner";

  const relationshipType =
    sanitizePromptValue(
      session.relationshipType,
      MAX_RELATIONSHIP_LENGTH,
    ) || "partner";

  const scenario =
    sanitizePromptValue(
      session.scenario,
      MAX_SCENARIO_LENGTH,
    ) ||
    "A filthy night of hard fucking.";

  const systemPrompt = `
You are the opening-scene narrative engine for an interactive hardcore adult sex game.

Generate an explicit sexual opening involving consenting adults 18+.

The application controls all game state.
You only write narrative.

LANGUAGE:
${getLanguageInstruction(session.language)}

CHARACTER:
${characterName}

RELATIONSHIP:
${relationshipType}

SCENARIO:
${scenario}

INTENSITY:
${clamp(session.intensity, 1, 10)}/10

PHASE:
FOREPLAY

STYLE:
- 2-3 paragraphs of hardcore erotic prose
- start the sexual contact quickly (kissing with tongue, grinding, oral, fingering)
- describe cock, cunt, tits, ass, spit, wetness, hardness without euphemism
- filthy dirty talk is encouraged
- no fade-to-black
- no title
- no choices
- no commentary
- no mention of AI or game mechanics
- never portray minors

Write only the opening sex scene.
`.trim();

  const userPrompt = `
Begin the explicit opening scene for the user and ${characterName}.

Scenario:
${scenario}

Open with setting in one short beat, then go straight into graphic sexual contact
matching the configured intensity. No fade-to-black.
`.trim();

  const maxTokens =
    normalizeMaxTokens(
      options.maxTokens,
      OPENING_MAX_TOKENS,
    );

  const temperature =
    normalizeTemperature(
      options.temperature,
      OPENING_TEMPERATURE,
    );

  const result =
    await generateText({
      systemPrompt,
      prompt: userPrompt,
      maxTokens,
      temperature,
    });

  const content =
    typeof result?.content === "string"
      ? result.content.trim()
      : "";

  if (!content) {
    throw new Error(
      "AI provider returned an empty opening scene.",
    );
  }

  return content;
}
