-- CreateEnum
CREATE TYPE "StorageKind" AS ENUM ('LOCAL', 'REMOTE');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MediaAsset"
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "sizeBytes" INTEGER,
ADD COLUMN "storageKind" "StorageKind" NOT NULL DEFAULT 'REMOTE';