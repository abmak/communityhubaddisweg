-- Roles become data, so administrators can edit capabilities and add new roles.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
ALTER TABLE "AdminAction" ALTER COLUMN "actorRole" TYPE TEXT USING "actorRole"::text;
DROP TYPE "UserRole";
CREATE INDEX "User_role_idx" ON "User"("role");

CREATE TABLE "RoleDefinition" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rank" INTEGER NOT NULL DEFAULT 10,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoleDefinition_slug_key" ON "RoleDefinition"("slug");
CREATE UNIQUE INDEX "RoleDefinition_name_key" ON "RoleDefinition"("name");
CREATE INDEX "RoleDefinition_rank_idx" ON "RoleDefinition"("rank");

-- The three built-in roles keep working exactly as before. Their capability
-- lists are editable from the dashboard afterwards.
INSERT INTO "RoleDefinition" ("id", "slug", "name", "description", "permissions", "rank", "system", "createdAt", "updatedAt")
VALUES
  (
    'role_builtin_admin',
    'ADMIN',
    'Administrator',
    'Full access, including role changes, account deletion, room configuration, announcements and the audit trail.',
    ARRAY[
      'admin.dashboard.view','admin.reports.view','admin.reports.manage','admin.content.view',
      'admin.content.manage','admin.users.view','admin.users.manage','admin.roles.view',
      'admin.roles.manage','admin.users.delete','admin.categories.view','admin.categories.manage',
      'admin.announcements.publish','admin.audit.view'
    ]::TEXT[],
    100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'role_builtin_moderator',
    'MODERATOR',
    'Moderator',
    'Keeps the community healthy: works the report queue, removes content and suspends members, but cannot change roles or platform configuration.',
    ARRAY[
      'admin.dashboard.view','admin.reports.view','admin.reports.manage','admin.content.view',
      'admin.content.manage','admin.users.view','admin.users.manage','admin.roles.view',
      'admin.categories.view'
    ]::TEXT[],
    50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'role_builtin_user',
    'USER',
    'Member',
    'Reads, posts, comments and messages other members. No admin surfaces.',
    ARRAY[]::TEXT[],
    10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;

-- "Let's Know Ethiopia" question pool and daily attempts.
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizQuestion_key_key" ON "QuizQuestion"("key");
CREATE INDEX "QuizQuestion_category_active_idx" ON "QuizQuestion"("category", "active");

CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "questionIds" TEXT[],
    "answers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "score" INTEGER,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuizAttempt_userId_day_key" ON "QuizAttempt"("userId", "day");
CREATE INDEX "QuizAttempt_day_score_durationMs_idx" ON "QuizAttempt"("day", "score" DESC, "durationMs");
CREATE INDEX "QuizAttempt_userId_completedAt_idx" ON "QuizAttempt"("userId", "completedAt" DESC);

CREATE TABLE "QuizSeen" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizSeen_pkey" PRIMARY KEY ("userId", "questionId")
);
CREATE INDEX "QuizSeen_userId_seenAt_idx" ON "QuizSeen"("userId", "seenAt" DESC);

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSeen" ADD CONSTRAINT "QuizSeen_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuizSeen" ADD CONSTRAINT "QuizSeen_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
