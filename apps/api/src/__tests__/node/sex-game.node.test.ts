import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getPhaseForArousal,
  transitionSession,
} from "../../services/sexgame/state-machine.ts";
import type {
  SexGameSession,
  SexGameChoice,
} from "../../services/sexgame/sex-game.ts";

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

const mild: SexGameChoice = {
  id: 1,
  text: "Tease",
  intensity: 3,
  arousalGain: 10,
  staminaCost: 5,
};

describe("getPhaseForArousal", () => {
  it("maps arousal bands", () => {
    assert.equal(getPhaseForArousal(0), "FOREPLAY");
    assert.equal(getPhaseForArousal(25), "BUILD_UP");
    assert.equal(getPhaseForArousal(50), "ACT");
    assert.equal(getPhaseForArousal(70), "INTENSE_ACT");
    assert.equal(getPhaseForArousal(90), "CLIMAX");
  });
});

describe("transitionSession", () => {
  it("advances phase and stats", () => {
    const r = transitionSession(
      baseSession({ phase: "FOREPLAY", arousal: 20, stamina: 50 }),
      mild,
    );
    assert.equal(r.session.round, 1);
    assert.equal(r.session.arousal, 30);
    assert.equal(r.session.stamina, 45);
    assert.equal(r.session.phase, "BUILD_UP");
    assert.equal(r.climaxAchieved, false);
  });

  it("enters climax at threshold", () => {
    const r = transitionSession(
      baseSession({
        phase: "INTENSE_ACT",
        arousal: 85,
        stamina: 60,
        climaxCount: 0,
      }),
      mild,
    );
    assert.equal(r.session.phase, "CLIMAX");
    assert.equal(r.climaxAchieved, true);
    assert.equal(r.session.climaxCount, 1);
  });

  it("moves climax to aftercare", () => {
    const r = transitionSession(
      baseSession({ phase: "CLIMAX", arousal: 95, stamina: 55, climaxCount: 1 }),
      mild,
    );
    assert.equal(r.session.phase, "AFTERCARE");
    assert.equal(r.sessionComplete, false);
  });

  it("completes aftercare", () => {
    const r = transitionSession(
      baseSession({
        phase: "AFTERCARE",
        arousal: 20,
        stamina: 50,
        climaxCount: 1,
      }),
      mild,
    );
    assert.equal(r.sessionComplete, true);
  });

  it("does not mutate source", () => {
    const source = baseSession({ arousal: 10, round: 0 });
    transitionSession(source, mild);
    assert.equal(source.arousal, 10);
    assert.equal(source.round, 0);
  });
});
