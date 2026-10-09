-- CreateEnum
CREATE TYPE "VideoCallSessionStatus" AS ENUM ('CREATED', 'CONNECTING', 'ACTIVE', 'ENDED', 'FAILED');

-- CreateTable
CREATE TABLE "VideoCallSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "VideoCallSessionStatus" NOT NULL DEFAULT 'CREATED',
    "provider" TEXT NOT NULL DEFAULT 'webrtc',
    "audioEnabled" BOOLEAN NOT NULL DEFAULT true,
    "videoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCallSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoCallSession_roomId_key" ON "VideoCallSession"("roomId");
CREATE INDEX "VideoCallSession_userId_updatedAt_idx" ON "VideoCallSession"("userId", "updatedAt");
CREATE INDEX "VideoCallSession_conversationId_status_idx" ON "VideoCallSession"("conversationId", "status");

-- AddForeignKey
ALTER TABLE "VideoCallSession" ADD CONSTRAINT "VideoCallSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoCallSession" ADD CONSTRAINT "VideoCallSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RoleplayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
