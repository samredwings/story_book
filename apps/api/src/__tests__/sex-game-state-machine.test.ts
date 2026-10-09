import { describe, expect, test } from "vitest";
import {
  getPhaseForArousal,
  transitionSession,
} from "../services/sexgame/state-machine";
import type { SexGameSession, SexGameChoice } from "../services/sexgame/sex-game";

function baseSession(
  overrides: Partial<SexGameSession> = {},
): SexGameSession {
  return {
    id: "sess-1",
    userId: "user-1",
    characterName: "Alex",
    relationshipType: "partner",
    scenario: "test",
    language: "ENGLISH",
    intensity: 5,
    phase: "FOREPLAY",
    arousal: 10,
    stamina: 80,
    climaxCount: 0,
    round: 0,
    history: [],
    createdAt: new Date(),
    lastActivity: new Date(),
    version: 1,
    ...overrides,
  };
}

const mildChoice: SexGameChoice = {
  id: 1,
  text: "Tease",
  intensity: 3,
  arousalGain: 10,
  staminaCost: 5,
};

const strongChoice: SexGameChoice = {
  id: 2,
  text: "Intensify",
  intensity: 8,
  arousalGain: 40,
  staminaCost: 15,
};

describe("getPhaseForArousal", () => {
  test("maps arousal bands to phases", () => {
    expect(getPhaseForArousal(0)).toBe("FOREPLAY");
    expect(getPhaseForArousal(24)).toBe("FOREPLAY");
    expect(getPhaseForArousal(25)).toBe("BUILD_UP");
    expect(getPhaseForArousal(49)).toBe("BUILD_UP");
    expect(getPhaseForArousal(50)).toBe("ACT");
    expect(getPhaseForArousal(69)).toBe("ACT");
    expect(getPhaseForArousal(70)).toBe("INTENSE_ACT");
    expect(getPhaseForArousal(89)).toBe("INTENSE_ACT");
    expect(getPhaseForArousal(90)).toBe("CLIMAX");
    expect(getPhaseForArousal(100)).toBe("CLIMAX");
  });
});

describe("transitionSession", () => {
  test("increments round, clamps arousal/stamina, advances phase", () => {
    const result = transitionSession(
      baseSession({ phase: "FOREPLAY", arousal: 20, stamina: 50 }),
      mildChoice,
    );

    expect(result.session.round).toBe(1);
    expect(result.session.arousal).toBe(30);
    expect(result.session.stamina).toBe(45);
    expect(result.session.phase).toBe("BUILD_UP");
    expect(result.climaxAchieved).toBe(false);
    expect(result.sessionComplete).toBe(false);
    expect(result.session.version).toBe(2);
  });

  test("enters climax when arousal crosses the threshold", () => {
    const result = transitionSession(
      baseSession({
        phase: "INTENSE_ACT",
        arousal: 85,
        stamina: 60,
        climaxCount: 0,
      }),
      mildChoice,
    );

    expect(result.session.phase).toBe("CLIMAX");
    expect(result.session.arousal).toBe(95);
    expect(result.session.stamina).toBe(55);
    expect(result.climaxAchieved).toBe(true);
    expect(result.session.climaxCount).toBe(1);
  });

  test("moves from climax to aftercare on the next action", () => {
    const result = transitionSession(
      baseSession({
        phase: "CLIMAX",
        arousal: 95,
        stamina: 55,
        climaxCount: 1,
      }),
      mildChoice,
    );

    expect(result.session.phase).toBe("AFTERCARE");
    expect(result.climaxAchieved).toBe(false);
    expect(result.sessionComplete).toBe(false);
    expect(result.session.climaxCount).toBe(1);
  });

  test("marks aftercare actions complete without leaving phase", () => {
    const result = transitionSession(
      baseSession({
        phase: "AFTERCARE",
        arousal: 20,
        stamina: 50,
        climaxCount: 1,
      }),
      mildChoice,
    );

    expect(result.session.phase).toBe("AFTERCARE");
    expect(result.sessionComplete).toBe(true);
  });

  test("clamps arousal to 100 and stamina to 0", () => {
    const result = transitionSession(
      baseSession({ phase: "ACT", arousal: 90, stamina: 5 }),
      strongChoice,
    );

    expect(result.session.arousal).toBe(100);
    expect(result.session.stamina).toBe(0);
    expect(result.session.phase).toBe("CLIMAX");
    expect(result.climaxAchieved).toBe(true);
  });

  test("does not mutate the source session object", () => {
    const source = baseSession({ phase: "FOREPLAY", arousal: 10, stamina: 80 });
    const arousalBefore = source.arousal;
    const roundBefore = source.round;
    const phaseBefore = source.phase;
    transitionSession(source, mildChoice);
    expect(source.arousal).toBe(arousalBefore);
    expect(source.round).toBe(roundBefore);
    expect(source.phase).toBe(phaseBefore);
  });
});
