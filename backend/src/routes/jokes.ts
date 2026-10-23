import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth, isModerator } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { writeLimiter } from "../lib/rate-limit";
import { publicUserSelect } from "../lib/serialize";
import {
  addisDayStart,
  jokeInclude,
  pickWinner,
  serializeJoke,
  sessionStatus,
} from "../lib/jokes";

export const jokesRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

const jokeSchema = z.object({
  body: z.string().trim().min(1, "Share the joke first").max(2000),
});

const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(1000),
});

const commentInclude = {
  author: { select: publicUserSelect },
} as const;

/** Likes and comments only count while the session is open. */
async function jokeInOpenSession(id: string) {
  const joke = await prisma.joke.findUnique({
    where: { id },
    select: {
      id: true,
      session: { select: { opensAt: true, closesAt: true } },
    },
  });
  if (!joke) throw ApiError.notFound("That joke could not be found.");

  const now = new Date();
  if (now < joke.session.opensAt) {
    throw ApiError.badRequest("Joke Time has not opened yet.");
  }
  if (now >= joke.session.closesAt) {
    throw ApiError.badRequest("Joke Time is closed — the results are final.");
  }
  return joke;
}

async function openSession() {
  const now = new Date();
  return prisma.jokeSession.findFirst({
    where: { opensAt: { lte: now }, closesAt: { gt: now } },
    orderBy: { opensAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Feed: the open session, or today's closed one with its winner.
// ---------------------------------------------------------------------------

jokesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const viewerId = req.userId;

    const open = await openSession();
    let session = open;
    let status: "OPEN" | "CLOSED" | null = open ? "OPEN" : null;

    if (!open) {
      const lastClosed = await prisma.jokeSession.findFirst({
        where: { closesAt: { lte: now } },
        orderBy: { closesAt: "desc" },
      });
      // Only surface a closed session while it is still "today" in Addis.
      if (lastClosed && lastClosed.closesAt >= addisDayStart(now)) {
        session = lastClosed;
        status = "CLOSED";
      }
    }

    const rawJokes = session
      ? await prisma.joke.findMany({
          where: { sessionId: session.id },
          include: jokeInclude(viewerId),
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

    let jokes = rawJokes.map((joke) => serializeJoke(joke, viewerId));
    if (status === "CLOSED") {
      jokes = [...jokes].sort((a, b) => b.score - a.score || b.likeCount - a.likeCount);
    }

    const upcoming = await prisma.jokeSession.findFirst({
      where: { opensAt: { gt: now } },
      orderBy: { opensAt: "asc" },
    });

    res.json({
      session: session
        ? {
            id: session.id,
            title: session.title,
            opensAt: session.opensAt,
            closesAt: session.closesAt,
            status: status ?? sessionStatus(session, now),
            jokeCount: jokes.length,
          }
        : null,
      upcoming: upcoming
        ? {
            id: upcoming.id,
            title: upcoming.title,
            opensAt: upcoming.opensAt,
            closesAt: upcoming.closesAt,
          }
        : null,
      jokes,
      winner: status === "CLOSED" ? pickWinner(jokes) : null,
      canPost: Boolean(viewerId) && status === "OPEN",
    });
  }),
);

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

jokesRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate(jokeSchema),
  asyncHandler(async (req, res) => {
    const { body } = req.body as z.infer<typeof jokeSchema>;
    const session = await openSession();
    if (!session) {
      throw ApiError.badRequest("Joke Time is not open right now. Come back when the next session starts.");
    }

    const created = await prisma.joke.create({
      data: { sessionId: session.id, authorId: req.userId!, body },
    });
    const joke = await prisma.joke.findUniqueOrThrow({
      where: { id: created.id },
      include: jokeInclude(req.userId),
    });

    res.status(201).json({ joke: serializeJoke(joke, req.userId) });
  }),
);

jokesRouter.delete(
  "/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const joke = await prisma.joke.findUnique({ where: { id }, select: { authorId: true } });
    if (!joke) throw ApiError.notFound("That joke could not be found.");
    if (joke.authorId !== req.userId && !isModerator(req)) throw ApiError.forbidden();

    await prisma.joke.delete({ where: { id } });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

jokesRouter.post(
  "/:id/like",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await jokeInOpenSession(id);

    const existing = await prisma.jokeLike.findUnique({
      where: { jokeId_userId: { jokeId: id, userId: req.userId! } },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.jokeLike.create({ data: { jokeId: id, userId: req.userId! } }),
        prisma.joke.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
      ]);
    }

    const likeCount = await prisma.jokeLike.count({ where: { jokeId: id } });
    res.json({ liked: true, likeCount });
  }),
);

jokesRouter.delete(
  "/:id/like",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await jokeInOpenSession(id);
    const existing = await prisma.jokeLike.findUnique({
      where: { jokeId_userId: { jokeId: id, userId: req.userId! } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.jokeLike.delete({
          where: { jokeId_userId: { jokeId: id, userId: req.userId! } },
        }),
        prisma.joke.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
    }

    const likeCount = await prisma.jokeLike.count({ where: { jokeId: id } });
    res.json({ liked: false, likeCount });
  }),
);

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

jokesRouter.get(
  "/:id/comments",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const jokeId = String(req.params.id);
    const comments = await prisma.jokeComment.findMany({
      where: { jokeId, deletedAt: null },
      include: commentInclude,
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ comments });
  }),
);

jokesRouter.post(
  "/:id/comments",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(commentSchema),
  asyncHandler(async (req, res) => {
    const jokeId = String(req.params.id);
    const { body } = req.body as z.infer<typeof commentSchema>;
    await jokeInOpenSession(jokeId);

    const [comment] = await prisma.$transaction([
      prisma.jokeComment.create({
        data: { jokeId, authorId: req.userId!, body },
        include: commentInclude,
      }),
      prisma.joke.update({ where: { id: jokeId }, data: { commentCount: { increment: 1 } } }),
    ]);

    res.status(201).json({ comment });
  }),
);

jokesRouter.delete(
  "/comments/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const comment = await prisma.jokeComment.findUnique({
      where: { id },
      select: { id: true, authorId: true, jokeId: true },
    });
    if (!comment) throw ApiError.notFound("That comment could not be found.");
    if (comment.authorId !== req.userId && !isModerator(req)) throw ApiError.forbidden();

    await prisma.$transaction([
      prisma.jokeComment.delete({ where: { id } }),
      prisma.joke.update({ where: { id: comment.jokeId }, data: { commentCount: { decrement: 1 } } }),
    ]);
    res.status(204).end();
  }),
);
