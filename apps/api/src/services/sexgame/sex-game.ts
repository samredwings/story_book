export {
  createSession,
  getGameSession,
  getAvailableChoices,
  processGameAction,
  generateStartScene,
} from "./service";

export type {
  GamePhase,
  GameLanguage,
  GameCharacter,
  SexGameChoice,
  SexGameHistoryEntry,
  SexGameSession,
  SexGameScene,
  CreateSessionOptions,
  GameActionInput,
  GameError,
  GameResult,
} from "./types";
