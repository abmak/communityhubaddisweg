-- Add the AI adapter and per-key Gemini usage counters.
ALTER TYPE "EventSourceAdapter" ADD VALUE IF NOT EXISTS 'GEMINI';

CREATE TABLE "AiKeyUsage" (
    "id" TEXT NOT NULL,
    "keyIndex" INTEGER NOT NULL,
    "maskedKey" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "successes" INTEGER NOT NULL DEFAULT 0,
    "rateLimited" INTEGER NOT NULL DEFAULT 0,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "cooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKeyUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiKeyUsage_keyIndex_key" ON "AiKeyUsage"("keyIndex");
CREATE INDEX "AiKeyUsage_lastUsedAt_idx" ON "AiKeyUsage"("lastUsedAt");
