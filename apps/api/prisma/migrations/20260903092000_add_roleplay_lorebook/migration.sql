-- CreateTable
CREATE TABLE "RoleplayLorebookEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "characterId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplayLorebookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleplayLorebookEntry_userId_updatedAt_idx" ON "RoleplayLorebookEntry"("userId", "updatedAt");
CREATE INDEX "RoleplayLorebookEntry_conversationId_enabled_priority_idx" ON "RoleplayLorebookEntry"("conversationId", "enabled", "priority");
CREATE INDEX "RoleplayLorebookEntry_characterId_enabled_idx" ON "RoleplayLorebookEntry"("characterId", "enabled");

-- AddForeignKey
ALTER TABLE "RoleplayLorebookEntry" ADD CONSTRAINT "RoleplayLorebookEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayLorebookEntry" ADD CONSTRAINT "RoleplayLorebookEntry_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayLorebookEntry" ADD CONSTRAINT "RoleplayLorebookEntry_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
