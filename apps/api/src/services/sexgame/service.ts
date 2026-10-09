import crypto from "node:crypto";

import {
  generateScene,
  generateStartScene as generateOpeningNarrative,
} from "./scene-generator";

import {
  generateChoicesForPhase,
} from "./choices";

import {
  transitionSession,
} from "./state-machine";

import {
  getFallbackDescription,
  getFallbackOpening,
} from "./fallback";

import {
  sessionCommit,
  sessionGet,
  sessionSet,
} from "./session";

import {
  isSessionOwnedBy,
  validateChoiceId,
  validateSessionCreateOptions,
  validateSessionId,
} from "./validators";

import type {
  SexGameChoice,
  SexGameScene,
  SexGameSession,
  CreateSessionOptions,
} from "./types";

function createSessionId(): string {
  return (
    `sexgame_${Date.now()}_` +
    crypto.randomUUID()
  );
}

export async function createSession(
  userId: string,
  options: Omit<
    CreateSessionOptions,
    "userId"
  > = {},
): Promise<SexGameSession> {
  if (
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    throw new Error(
      "userId is required",
    );
  }

  const validated =
    validateSessionCreateOptions(
      options,
    );

  const now = new Date();

  const session:
    SexGameSession = {
    id: createSessionId(),

    userId:
      userId.trim(),

    version: 0,

    characterName:
      validated.characterName ||
      "Partner",

    characterImageUrl:
      validated.characterImageUrl,

    relationshipType:
      validated.relationshipType ||
      "partner",

    scenario:
      validated.scenario ||
      "A filthy night of hard fucking.",

    language:
      validated.language,

    intensity:
      validated.intensity,

    phase: "FOREPLAY",

    arousal: 5,

    stamina: 100,

    climaxCount: 0,

    round: 0,

    history: [],

    createdAt: now,

    lastActivity: now,
  };

  await sessionSet(
    session,
  );

  return session;
}

export async function getGameSession(
  sessionId: string,
  userId: string,
): Promise<SexGameSession | null> {
  if (
    !validateSessionId(
      sessionId,
    )
  ) {
    return null;
  }

  if (
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    return null;
  }

  const session =
    await sessionGet(
      sessionId,
    );

  if (!session) {
    return null;
  }

  if (
    !isSessionOwnedBy(
      session,
      userId,
    )
  ) {
    return null;
  }

  return session;
}

export function getAvailableChoices(
  session: SexGameSession,
): SexGameChoice[] {
  return generateChoicesForPhase(
    session.phase,
    session.stamina,
    session.intensity,
  );
}

export async function processGameAction(
  sessionId: string,
  userId: string,
  choiceId: number,
): Promise<
  SexGameScene | { error: string }
> {
  if (
    !validateSessionId(
      sessionId,
    )
  ) {
    return {
      error: "Invalid session ID",
    };
  }

  if (
    typeof userId !== "string" ||
    !userId.trim()
  ) {
    return {
      error: "User ID is required",
    };
  }

  if (
    !validateChoiceId(
      choiceId,
    )
  ) {
    return {
      error: "Invalid choice ID",
    };
  }

  const session =
    await sessionGet(
      sessionId,
    );

  if (!session) {
    return {
      error:
        "Session not found or expired",
    };
  }

  if (
    !isSessionOwnedBy(
      session,
      userId,
    )
  ) {
    return {
      error: "Unauthorized",
    };
  }

  const choices =
    getAvailableChoices(
      session,
    );

  const choice =
    choices.find(
      (item) =>
        item.id === choiceId,
    );

  if (!choice) {
    return {
      error:
        "Choice is not available",
    };
  }

  if (
    choice.staminaCost >
    session.stamina
  ) {
    return {
      error: "Not enough stamina",
    };
  }

  const transition =
    transitionSession(
      session,
      choice,
    );

  const nextSession =
    transition.session;

  let description: string;

  try {
    description =
      await generateScene({
        session: nextSession,
        choiceText: choice.text,
        actionPhase:
          transition.actionPhase,
      });
  } catch (error) {
    console.error(
      "[sexgame] scene generation failed:",
      error,
    );

    description =
      getFallbackDescription(
        nextSession,
      );
  }

  description =
    description.trim() ||
    getFallbackDescription(
      nextSession,
    );

  nextSession.history = [
    ...nextSession.history,
    {
      phase:
        transition.actionPhase,

      round:
        nextSession.round,

      choice:
        choice.text,

      description:
        description.slice(0, 500),
    },
  ].slice(-50);

  nextSession.lastActivity =
    new Date();

  const commit =
    await sessionCommit(
      nextSession,
      session.version,
    );

  if (
    commit !== "committed"
  ) {
    return {
      error:
        "The session changed before this action was saved. Please retry.",
    };
  }

  const nextChoices =
    transition.sessionComplete
      ? []
      : generateChoicesForPhase(
          nextSession.phase,
          nextSession.stamina,
          nextSession.intensity,
        );

  return {
    phase:
      nextSession.phase,

    arousal:
      nextSession.arousal,

    stamina:
      nextSession.stamina,

    round:
      nextSession.round,

    description,

    choices:
      nextChoices,

    climaxAchieved:
      transition.climaxAchieved,

    climaxCount:
      nextSession.climaxCount,

    sessionComplete:
      transition.sessionComplete,

    version:
      nextSession.version,

    imageUrl:
      nextSession.characterImageUrl,
  };
}

export async function generateStartScene(
  session: SexGameSession,
): Promise<SexGameScene> {
  let description: string;

  try {
    description =
      await generateOpeningNarrative(
        session,
      );
  } catch (error) {
    console.error(
      "[sexgame] opening scene generation failed:",
      error,
    );

    description =
      getFallbackOpening(
        session,
      );
  }

  description =
    description.trim() ||
    getFallbackOpening(
      session,
    );

  const nextSession:
    SexGameSession = {
    ...session,

    history: [
      ...session.history,
      {
        phase: "FOREPLAY" as const,
        round: 0,
        choice: "Session started",
        description:
          description.slice(0, 500),
      },
    ].slice(-50),

    lastActivity:
      new Date(),
  };

  await sessionSet(
    nextSession,
  );

  return {
    phase:
      nextSession.phase,

    arousal:
      nextSession.arousal,

    stamina:
      nextSession.stamina,

    round:
      nextSession.round,

    description,

    choices:
      generateChoicesForPhase(
        nextSession.phase,
        nextSession.stamina,
        nextSession.intensity,
      ),

    climaxAchieved: false,

    climaxCount:
      nextSession.climaxCount,

    sessionComplete: false,

    version:
      nextSession.version,

    imageUrl:
      nextSession.characterImageUrl,
  };
}
