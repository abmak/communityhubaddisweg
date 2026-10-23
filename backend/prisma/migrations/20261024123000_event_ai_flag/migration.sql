-- Remember which listings Gemini wrote, so a regex-only sync never replaces a
-- nicely extracted title with the raw channel post.
ALTER TABLE "Event" ADD COLUMN "aiExtracted" BOOLEAN NOT NULL DEFAULT false;
