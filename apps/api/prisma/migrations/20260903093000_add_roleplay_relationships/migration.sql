-- CreateTable
CREATE TABLE "RoleplayRelationship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "characterAId" TEXT NOT NULL,
    "characterBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "facts" TEXT[] NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplayRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleplayRelationship_conversationId_characterAId_characterBId_key" ON "RoleplayRelationship"("conversationId", "characterAId", "characterBId");
CREATE INDEX "RoleplayRelationship_userId_updatedAt_idx" ON "RoleplayRelationship"("userId", "updatedAt");
CREATE INDEX "RoleplayRelationship_conversationId_updatedAt_idx" ON "RoleplayRelationship"("conversationId", "updatedAt");
CREATE INDEX "RoleplayRelationship_characterAId_idx" ON "RoleplayRelationship"("characterAId");
CREATE INDEX "RoleplayRelationship_characterBId_idx" ON "RoleplayRelationship"("characterBId");

-- AddForeignKey
ALTER TABLE "RoleplayRelationship" ADD CONSTRAINT "RoleplayRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayRelationship" ADD CONSTRAINT "RoleplayRelationship_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayRelationship" ADD CONSTRAINT "RoleplayRelationship_characterAId_fkey" FOREIGN KEY ("characterAId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplayRelationship" ADD CONSTRAINT "RoleplayRelationship_characterBId_fkey" FOREIGN KEY ("characterBId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
