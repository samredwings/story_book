export type GamePhase =
  | "FOREPLAY"
  | "BUILD_UP"
  | "ACT"
  | "INTENSE_ACT"
  | "CLIMAX"
  | "AFTERCARE";

export type GameLanguage =
  | "ENGLISH"
  | "BANGLA";

export interface GameCharacter {
  name: string;
  relationshipType: string;
}

export interface SexGameChoice {
  id: number;
  text: string;
  intensity: number;
  staminaCost: number;
  arousalGain: number;
}

export interface SexGameHistoryEntry {
  round: number;
  phase: GamePhase;
  choice: string;
  description: string;
}

export interface SexGameSession {
  id: string;
  userId: string;

  /**
   * Optimistic concurrency version.
   * Incremented whenever authoritative state changes.
   */
  version: number;

  characterName: string;
  characterImageUrl?: string;
  relationshipType: string;
  scenario: string;

  language: GameLanguage;
  intensity: number;

  phase: GamePhase;

  arousal: number;
  stamina: number;

  climaxCount: number;
  round: number;

  history: SexGameHistoryEntry[];

  createdAt: Date;
  lastActivity: Date;
}

export interface SexGameScene {
  phase: GamePhase;
  arousal: number;
  stamina: number;
  round: number;

  description: string;
  choices: SexGameChoice[];

  climaxAchieved: boolean;
  climaxCount: number;
  sessionComplete: boolean;

  version: number;

  imageUrl?: string;
}

export interface CreateSessionOptions {
  userId: string;

  characterName?: string;
  characterImageUrl?: string;
  relationshipType?: string;
  scenario?: string;

  language?: GameLanguage;
  intensity?: number;
}

export interface GameActionInput {
  sessionId: string;
  userId: string;
  choiceId: number;
}

export interface GameError {
  error: string;
  code?: string;
}

export type GameResult<T> =
  | T
  | GameError;
