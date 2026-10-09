-- CreateEnum
CREATE TYPE "RoleplayCameraMode" AS ENUM ('FIRST_PERSON', 'THIRD_PERSON', 'OVER_SHOULDER', 'CINEMATIC');

-- CreateTable
CREATE TABLE "RoleplaySceneState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "cameraMode" "RoleplayCameraMode" NOT NULL DEFAULT 'THIRD_PERSON',
    "participantIds" TEXT[] NOT NULL,
    "variables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleplaySceneState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleplaySceneState_conversationId_key" ON "RoleplaySceneState"("conversationId");
CREATE INDEX "RoleplaySceneState_userId_updatedAt_idx" ON "RoleplaySceneState"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "RoleplaySceneState" ADD CONSTRAINT "RoleplaySceneState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleplaySceneState" ADD CONSTRAINT "RoleplaySceneState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
