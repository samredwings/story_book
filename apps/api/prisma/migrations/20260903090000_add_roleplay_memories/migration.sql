-- CreateEnum
CREATE TYPE "RoleplayMemoryType" AS ENUM ('SHORT_TERM', 'EPISODIC', 'FACT', 'RELATIONSHIP', 'CHARACTER', 'WORLD');

-- CreateEnum
CREATE TYPE "RoleplayMemoryScope" AS ENUM ('CONVERSATION', 'CHARACTER', 'SHARED', 'PRIVATE');

-- CreateTable
CREATE TABLE "RoleplayMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "characterId" TEXT,
    "type" "RoleplayMemoryType" NOT NULL,
    "scope" "RoleplayMemoryScope" NOT NULL,
    "content" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplayMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleplayMemory_userId_updatedAt_idx" ON "RoleplayMemory"("userId", "updatedAt");
CREATE INDEX "RoleplayMemory_conversationId_updatedAt_idx" ON "RoleplayMemory"("conversationId", "updatedAt");
CREATE INDEX "RoleplayMemory_conversationId_type_idx" ON "RoleplayMemory"("conversationId", "type");
CREATE INDEX "RoleplayMemory_characterId_idx" ON "RoleplayMemory"("characterId");

-- AddForeignKey
ALTER TABLE "RoleplayMemory" ADD CONSTRAINT "RoleplayMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayMemory" ADD CONSTRAINT "RoleplayMemory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayMemory" ADD CONSTRAINT "RoleplayMemory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
