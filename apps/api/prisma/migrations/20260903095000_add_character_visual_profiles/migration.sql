-- CreateTable
CREATE TABLE "CharacterVisualProfile" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "identityPrompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "style" TEXT,
    "seed" INTEGER,
    "referenceAssetIds" TEXT[] NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterVisualProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterVisualProfile_characterId_key" ON "CharacterVisualProfile"("characterId");
CREATE INDEX "CharacterVisualProfile_locked_idx" ON "CharacterVisualProfile"("locked");

-- AddForeignKey
ALTER TABLE "CharacterVisualProfile" ADD CONSTRAINT "CharacterVisualProfile_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
