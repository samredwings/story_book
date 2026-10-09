-- Adult platform consent + legal document versioning
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adultContentAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adultContentVersion" TEXT;
