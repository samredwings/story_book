import type {
  GamePhase,
  SexGameChoice,
  SexGameSession,
} from "./types";

export const PHASE_ORDER: GamePhase[] = [
  "FOREPLAY",
  "BUILD_UP",
  "ACT",
  "INTENSE_ACT",
  "CLIMAX",
  "AFTERCARE",
];

export interface TransitionResult {
  session: SexGameSession;
  actionPhase: GamePhase;
  choice: SexGameChoice;
  climaxAchieved: boolean;
  sessionComplete: boolean;
}

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

export function getPhaseForArousal(
  arousal: number,
): GamePhase {
  const value =
    clamp(arousal, 0, 100);

  if (value >= 90) {
    return "CLIMAX";
  }

  if (value >= 70) {
    return "INTENSE_ACT";
  }

  if (value >= 50) {
    return "ACT";
  }

  if (value >= 25) {
    return "BUILD_UP";
  }

  return "FOREPLAY";
}

export function transitionSession(
  source: SexGameSession,
  choice: SexGameChoice,
): TransitionResult {
  const actionPhase =
    source.phase;

  const nextArousal =
    clamp(
      source.arousal +
        choice.arousalGain,
      0,
      100,
    );

  const nextStamina =
    clamp(
      source.stamina -
        choice.staminaCost,
      0,
      100,
    );

  const nextSession:
    SexGameSession = {
    ...source,
    arousal: nextArousal,
    stamina: nextStamina,
    round: source.round + 1,
    version: source.version + 1,
    lastActivity: new Date(),
    history: [...source.history],
  };

  let climaxAchieved = false;
  let sessionComplete = false;

  if (
    source.phase === "CLIMAX"
  ) {
    nextSession.phase =
      "AFTERCARE";
  } else if (
    source.phase === "AFTERCARE"
  ) {
    nextSession.phase =
      "AFTERCARE";

    sessionComplete = true;
  } else {
    const nextPhase =
      getPhaseForArousal(
        nextArousal,
      );

    if (
      nextPhase === "CLIMAX"
    ) {
      nextSession.phase =
        "CLIMAX";

      nextSession.climaxCount =
        source.climaxCount + 1;

      climaxAchieved = true;
    } else {
      nextSession.phase =
        nextPhase;
    }
  }

  return {
    session: nextSession,
    actionPhase,
    choice,
    climaxAchieved,
    sessionComplete,
  };
}
