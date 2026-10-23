-- Events & Meetups: listings imported from online sources live next to
-- member-hosted meetups, distinguished by Event.kind.
CREATE TYPE "EventKind" AS ENUM ('EVENT', 'MEETUP');
CREATE TYPE "EventTopic" AS ENUM ('CINEMA', 'THEATRE', 'SPORTS', 'MUSIC', 'FESTIVAL', 'COMMUNITY', 'OTHER');
CREATE TYPE "EventSourceAdapter" AS ENUM ('SPORTS_API', 'TELEGRAM', 'RSS');

CREATE TABLE "EventSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adapter" "EventSourceAdapter" NOT NULL,
    "topic" "EventTopic" NOT NULL DEFAULT 'OTHER',
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "lastImported" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventSource_key_key" ON "EventSource"("key");
CREATE INDEX "EventSource_enabled_idx" ON "EventSource"("enabled");

ALTER TABLE "Event"
    ADD COLUMN "kind" "EventKind" NOT NULL DEFAULT 'MEETUP',
    ADD COLUMN "topic" "EventTopic" NOT NULL DEFAULT 'COMMUNITY',
    ADD COLUMN "sourceId" TEXT,
    ADD COLUMN "externalId" TEXT,
    ADD COLUMN "sourceUrl" TEXT,
    ADD COLUMN "importedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Event_sourceId_externalId_key" ON "Event"("sourceId", "externalId");
CREATE INDEX "Event_kind_startDate_idx" ON "Event"("kind", "startDate");

ALTER TABLE "Event"
    ADD CONSTRAINT "Event_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Importing listings is a new administrative surface.
UPDATE "RoleDefinition"
SET "permissions" = array_append("permissions", 'admin.events.view')
WHERE "slug" = 'ADMIN' AND NOT ('admin.events.view' = ANY("permissions"));

UPDATE "RoleDefinition"
SET "permissions" = array_append("permissions", 'admin.events.manage')
WHERE "slug" = 'ADMIN' AND NOT ('admin.events.manage' = ANY("permissions"));
