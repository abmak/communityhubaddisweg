-- Club crests for fixtures. Populated by the sports adapter on the next sync;
-- older rows without crests fall back to a neutral shield in the UI.
ALTER TABLE "Event" ADD COLUMN "homeLogo" TEXT;
ALTER TABLE "Event" ADD COLUMN "awayLogo" TEXT;
