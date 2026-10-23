import type { Prisma } from "@prisma/client";
import { publicUserSelect } from "./serialize";

export type JokeSessionStatus = "OPEN" | "UPCOMING" | "CLOSED";

export const JOKE_DAY_MS = 24 * 60 * 60 * 1000;

/** Include the author and the viewer's own like in one query. */
export function jokeInclude(viewerId?: string) {
  return {
    author: { select: publicUserSelect },
    likes: {
      where: { userId: viewerId ?? "__anonymous__" },
      select: { userId: true },
    },
  } satisfies Prisma.JokeInclude;
}

export type JokeWithRelations = Prisma.JokeGetPayload<{ include: ReturnType<typeof jokeInclude> }>;

export interface SerializedJoke {
  id: string;
  sessionId: string;
  body: string;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  mine: boolean;
  /** Likes plus comments — the ranking used to crown the day's best joke. */
  score: number;
  author: JokeWithRelations["author"];
}

export function serializeJoke(joke: JokeWithRelations, viewerId?: string): SerializedJoke {
  return {
    id: joke.id,
    sessionId: joke.sessionId,
    body: joke.body,
    createdAt: joke.createdAt,
    likeCount: joke.likeCount,
    commentCount: joke.commentCount,
    likedByMe: joke.likes.length > 0,
    mine: Boolean(viewerId && joke.authorId === viewerId),
    score: joke.likeCount + joke.commentCount,
    author: joke.author,
  };
}

export function sessionStatus(
  session: { opensAt: Date; closesAt: Date },
  now: Date = new Date(),
): JokeSessionStatus {
  if (now < session.opensAt) return "UPCOMING";
  if (now >= session.closesAt) return "CLOSED";
  return "OPEN";
}

/**
 * Start of the current day in Addis Ababa (UTC+3, no daylight saving). Used to
 * decide whether a closed session still counts as "today's" Joke Time.
 */
export function addisDayStart(now: Date = new Date()): Date {
  const SHIFT_MS = 3 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + SHIFT_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - SHIFT_MS,
  );
}

/** Highest score wins; ties fall to more likes, then the earlier joke. */
export function pickWinner(jokes: SerializedJoke[]): SerializedJoke | null {
  if (jokes.length === 0) return null;
  return [...jokes].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}
