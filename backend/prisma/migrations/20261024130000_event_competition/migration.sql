-- Competition keeps sports fixtures groupable by league instead of scraping the
-- league name out of the description on every request.
ALTER TABLE "Event" ADD COLUMN "competition" TEXT;

CREATE INDEX "Event_competition_startDate_idx" ON "Event"("competition", "startDate");

-- Existing sports rows carry "League · season" as the first description line.
UPDATE "Event"
SET "competition" = split_part(split_part("description", E'\n', 1), ' · ', 1)
WHERE "topic" = 'SPORTS' AND "competition" IS NULL;

-- The international feed now reads ESPN's public scoreboard (full matchweeks)
-- instead of TheSportsDB's single next fixture under the free key.
UPDATE "EventSource"
SET "config" = jsonb_set("config", '{provider}', '"ESPN"')
WHERE "key" = 'intl-sport-fixtures';
