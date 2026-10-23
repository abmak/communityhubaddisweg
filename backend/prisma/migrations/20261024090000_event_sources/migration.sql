-- Events & Meetups: listings imported from online sources live next to
-- member-hosted meetups, distinguished by Event.kind.
--
-- The Event and EventRsvp tables used to exist only in databases that were
-- pushed from the schema, so a fresh `migrate deploy` hit "relation Event does
-- not exist" here. They are created first so the migration stands on its own.
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'INTERESTED');

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "categoryId" TEXT,
    "creatorId" TEXT NOT NULL,
    "maxAttendees" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");
CREATE INDEX "Event_placeId_idx" ON "Event"("placeId");
CREATE INDEX "Event_creatorId_idx" ON "Event"("creatorId");

ALTER TABLE "Event"
    ADD CONSTRAINT "Event_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");
CREATE INDEX "EventRsvp_eventId_status_idx" ON "EventRsvp"("eventId", "status");
CREATE INDEX "EventRsvp_userId_idx" ON "EventRsvp"("userId");

ALTER TABLE "EventRsvp"
    ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
