-- Per-model cooldowns, so a restart does not re-spend a key whose quota is out.
ALTER TABLE "AiKeyUsage" ADD COLUMN "cooldowns" JSONB NOT NULL DEFAULT '{}';
