-- CreateEnum
CREATE TYPE "RoleplayConversationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoleplayParticipantType" AS ENUM ('USER', 'CHARACTER');

-- CreateEnum
CREATE TYPE "RoleplayMessageRole" AS ENUM ('USER', 'CHARACTER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RoleplayMessageStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "RoleplayConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RoleplayConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplayConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleplayParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" "RoleplayParticipantType" NOT NULL,
    "userId" TEXT,
    "characterId" TEXT,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleplayMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantId" TEXT,
    "role" "RoleplayMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "RoleplayMessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleplayMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleplayConversation_userId_idx" ON "RoleplayConversation"("userId");
CREATE INDEX "RoleplayConversation_userId_updatedAt_idx" ON "RoleplayConversation"("userId", "updatedAt");
CREATE INDEX "RoleplayParticipant_conversationId_idx" ON "RoleplayParticipant"("conversationId");
CREATE INDEX "RoleplayParticipant_characterId_idx" ON "RoleplayParticipant"("characterId");
CREATE INDEX "RoleplayParticipant_userId_idx" ON "RoleplayParticipant"("userId");
CREATE INDEX "RoleplayMessage_conversationId_createdAt_idx" ON "RoleplayMessage"("conversationId", "createdAt");
CREATE INDEX "RoleplayMessage_participantId_idx" ON "RoleplayMessage"("participantId");

-- AddForeignKey
ALTER TABLE "RoleplayParticipant" ADD CONSTRAINT "RoleplayParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayMessage" ADD CONSTRAINT "RoleplayMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayMessage" ADD CONSTRAINT "RoleplayMessage_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "RoleplayParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
