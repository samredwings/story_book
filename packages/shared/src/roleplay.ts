/**
 * Shared roleplay domain types.
 *
 * These types are intentionally additive.
 * Existing StoryBook types remain unchanged.
 */

export type RoleplayId = string;

export enum RoleplaySessionStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

export enum RoleplayParticipantType {
  USER = "USER",
  CHARACTER = "CHARACTER",
}

export enum RoleplayMessageRole {
  USER = "USER",
  CHARACTER = "CHARACTER",
  SYSTEM = "SYSTEM",
}

export enum RoleplayMessageStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum RoleplayMemoryType {
  SHORT_TERM = "SHORT_TERM",
  EPISODIC = "EPISODIC",
  FACT = "FACT",
  RELATIONSHIP = "RELATIONSHIP",
  CHARACTER = "CHARACTER",
  WORLD = "WORLD",
}

export enum RoleplayMemoryScope {
  CONVERSATION = "CONVERSATION",
  CHARACTER = "CHARACTER",
  SHARED = "SHARED",
  PRIVATE = "PRIVATE",
}

export type RoleplayCameraMode =
  | "FIRST_PERSON"
  | "THIRD_PERSON"
  | "OVER_SHOULDER"
  | "CINEMATIC";

export interface RoleplayConversation {
  id: RoleplayId;
  userId: RoleplayId;
  title: string;
  status: RoleplaySessionStatus;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleplayParticipant {
  id: RoleplayId;
  conversationId: RoleplayId;

  type: RoleplayParticipantType;

  userId?: RoleplayId;
  characterId?: RoleplayId;

  displayName: string;
  active: boolean;
  sortOrder: number;

  joinedAt: string;
  updatedAt: string;
}

export interface RoleplayMessage {
  id: RoleplayId;
  conversationId: RoleplayId;
  participantId?: RoleplayId;

  role: RoleplayMessageRole;
  content: string;
  status: RoleplayMessageStatus;

  metadata?: Record<string, unknown>;

  createdAt: string;
}

export interface RoleplayCharacterState {
  characterId: RoleplayId;

  mood?: string;
  emotionalState?: string;
  currentGoal?: string;
  currentLocation?: string;

  variables: Record<string, unknown>;

  updatedAt: string;
}

export interface RoleplayRelationship {
  id: RoleplayId;
  conversationId: RoleplayId;

  characterAId: RoleplayId;
  characterBId: RoleplayId;

  type: string;
  score: number;

  facts: string[];

  metadata?: Record<string, unknown>;

  updatedAt: string;
}

export interface RoleplayMemory {
  id: RoleplayId;
  conversationId: RoleplayId;

  characterId?: RoleplayId;

  type: RoleplayMemoryType;
  scope: RoleplayMemoryScope;

  content: string;

  importance: number;

  metadata?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export interface RoleplayLorebookEntry {
  id: RoleplayId;

  conversationId?: RoleplayId;
  characterId?: RoleplayId;

  title: string;
  content: string;

  keywords: string[];

  priority: number;
  enabled: boolean;

  metadata?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export interface RoleplaySceneState {
  id: RoleplayId;
  conversationId: RoleplayId;

  /**
   * Existing application SceneStatus is intentionally not duplicated here.
   */
  description: string;

  location?: string;
  cameraMode: RoleplayCameraMode;

  participantIds: RoleplayId[];

  variables: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export interface RoleplayRuntimeState {
  conversation: RoleplayConversation;

  participants: RoleplayParticipant[];

  recentMessages: RoleplayMessage[];

  characterStates: RoleplayCharacterState[];

  relationships: RoleplayRelationship[];

  memories: RoleplayMemory[];

  lorebookEntries: RoleplayLorebookEntry[];

  sceneState?: RoleplaySceneState;
}

export interface RoleplayTurnCandidate {
  participantId: RoleplayId;

  relevance: number;
  responseProbability: number;

  reason?: string;
}

export interface RoleplayTurnPlan {
  responders: RoleplayTurnCandidate[];
  silentParticipantIds: RoleplayId[];

  reason?: string;
}

export interface RoleplayTurnInput {
  conversationId: RoleplayId;
  userMessage: string;

  targetParticipantIds?: RoleplayId[];

  metadata?: Record<string, unknown>;
}

export interface RoleplayTurnOutput {
  conversationId: RoleplayId;

  messages: RoleplayMessage[];

  turnPlan: RoleplayTurnPlan;
}
