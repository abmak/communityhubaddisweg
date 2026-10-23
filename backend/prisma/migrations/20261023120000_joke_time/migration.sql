-- "Joke Time": scheduled windows for sharing and reacting to jokes.
CREATE TABLE "JokeSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Joke Time',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "JokeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Joke" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Joke_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JokeLike" (
    "jokeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JokeLike_pkey" PRIMARY KEY ("jokeId", "userId")
);

CREATE TABLE "JokeComment" (
    "id" TEXT NOT NULL,
    "jokeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JokeComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JokeSession_opensAt_closesAt_idx" ON "JokeSession"("opensAt", "closesAt");
CREATE INDEX "Joke_sessionId_createdAt_idx" ON "Joke"("sessionId", "createdAt" DESC);
CREATE INDEX "JokeComment_jokeId_createdAt_idx" ON "JokeComment"("jokeId", "createdAt");

ALTER TABLE "JokeSession" ADD CONSTRAINT "JokeSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Joke" ADD CONSTRAINT "Joke_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "JokeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Joke" ADD CONSTRAINT "Joke_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JokeLike" ADD CONSTRAINT "JokeLike_jokeId_fkey" FOREIGN KEY ("jokeId") REFERENCES "Joke"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JokeLike" ADD CONSTRAINT "JokeLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JokeComment" ADD CONSTRAINT "JokeComment_jokeId_fkey" FOREIGN KEY ("jokeId") REFERENCES "Joke"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JokeComment" ADD CONSTRAINT "JokeComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Administrators schedule Joke Time. Append only if the capability is not
-- already present, so a deliberate dashboard edit is not silently undone.
UPDATE "RoleDefinition"
SET "permissions" = array_append("permissions", 'admin.jokes.view')
WHERE "slug" = 'ADMIN' AND NOT ('admin.jokes.view' = ANY("permissions"));

UPDATE "RoleDefinition"
SET "permissions" = array_append("permissions", 'admin.jokes.manage')
WHERE "slug" = 'ADMIN' AND NOT ('admin.jokes.manage' = ANY("permissions"));
