-- "Guess the Place" picture quiz: a curated pool of Ethiopian heritage photos
-- and one attempt per member per Ethiopian calendar day.

CREATE TABLE "PlaceQuizQuestion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageCredit" TEXT NOT NULL DEFAULT '',
    "imageLicense" TEXT NOT NULL DEFAULT '',
    "imagePageUrl" TEXT,
    "answer" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'PLACE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceQuizQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaceQuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "questionIds" TEXT[],
    "answers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "score" INTEGER,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlaceQuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlaceQuizQuestion_key_key" ON "PlaceQuizQuestion"("key");
CREATE INDEX "PlaceQuizQuestion_category_active_idx" ON "PlaceQuizQuestion"("category", "active");
CREATE INDEX "PlaceQuizAttempt_day_score_durationMs_idx" ON "PlaceQuizAttempt"("day", "score" DESC, "durationMs");
CREATE INDEX "PlaceQuizAttempt_userId_completedAt_idx" ON "PlaceQuizAttempt"("userId", "completedAt" DESC);
CREATE UNIQUE INDEX "PlaceQuizAttempt_userId_day_key" ON "PlaceQuizAttempt"("userId", "day");

ALTER TABLE "PlaceQuizAttempt" ADD CONSTRAINT "PlaceQuizAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
