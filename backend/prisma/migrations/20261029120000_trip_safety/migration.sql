-- Live trip safety links. A member starts one from in-app navigation, shares
-- the token URL with a trusted contact, and the public page can follow the
-- route and see the latest fix. The route is stored so the map has a planned
-- line before the first GPS update arrives.

CREATE TYPE "TripShareStatus" AS ENUM ('ACTIVE', 'ARRIVED', 'ENDED', 'EXPIRED');

CREATE TABLE "TripShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originName" TEXT,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destinationName" TEXT NOT NULL,
    "destinationAddress" TEXT,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'driving',
    "routePath" JSONB,
    "routeDistanceMeters" INTEGER,
    "routeDurationSeconds" INTEGER,
    "status" "TripShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "headingDegrees" DOUBLE PRECISION,
    "lastFixAt" TIMESTAMP(3),
    "remainingMeters" INTEGER,
    "remainingSeconds" INTEGER,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" VARCHAR(200),
    "arrivedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TripShare_token_key" ON "TripShare"("token");
CREATE INDEX "TripShare_userId_status_idx" ON "TripShare"("userId", "status");
CREATE INDEX "TripShare_expiresAt_idx" ON "TripShare"("expiresAt");

ALTER TABLE "TripShare" ADD CONSTRAINT "TripShare_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
