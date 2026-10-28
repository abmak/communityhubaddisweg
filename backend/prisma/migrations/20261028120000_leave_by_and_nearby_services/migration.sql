-- Everyday service points join the nearby directory, and members can ask the
-- server for one departure reminder per event.

ALTER TYPE "PlaceKind" ADD VALUE 'PUBLIC_TOILET';
ALTER TYPE "PlaceKind" ADD VALUE 'PARKING';
ALTER TYPE "PlaceKind" ADD VALUE 'EV_CHARGING';
ALTER TYPE "PlaceKind" ADD VALUE 'TRANSIT_STOP';
ALTER TYPE "PlaceKind" ADD VALUE 'BANK';
ALTER TYPE "PlaceKind" ADD VALUE 'ATM';

ALTER TYPE "NotificationType" ADD VALUE 'EVENT_REMINDER';

-- A single destination for a notification. Post and conversation links remain
-- for existing notification types.
ALTER TABLE "Notification" ADD COLUMN "url" TEXT;

CREATE TABLE "LeaveByReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "originLabel" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'driving',
    "leaveAt" TIMESTAMP(3) NOT NULL,
    "notifyAt" TIMESTAMP(3) NOT NULL,
    "travelSeconds" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveByReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveByReminder_userId_eventId_key" ON "LeaveByReminder"("userId", "eventId");
CREATE INDEX "LeaveByReminder_notifyAt_notifiedAt_idx" ON "LeaveByReminder"("notifyAt", "notifiedAt");

ALTER TABLE "LeaveByReminder" ADD CONSTRAINT "LeaveByReminder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveByReminder" ADD CONSTRAINT "LeaveByReminder_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
