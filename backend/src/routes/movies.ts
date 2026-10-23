import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { postInclude, publicUserSelect, serializePost } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { parseLimit, parsePage } from "../lib/pagination";
import { rankedPostIds } from "../lib/trending";
import { createNotification } from "../lib/notifications";
import { writeLimiter } from "../lib/rate-limit";

export const moviesRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  genre: z.string().trim().max(60).optional(),
  sort: z.enum(["newest", "top", "trending"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const idParams = z.object({ postId: z.string().min(1) });

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Rate between 1 and 10").max(10),
  body: z.string().trim().max(3000).optional(),
});

async function movieStats(postId: string) {
  const [aggregate, groups] = await Promise.all([
    prisma.movieReview.aggregate({ where: { postId }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.movieReview.groupBy({ by: ["rating"], where: { postId }, _count: { _all: true } }),
  ]);

  return {
    average: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : null,
    count: aggregate._count._all,
    distribution: groups.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.rating)] = row._count._all;
      return acc;
    }, {}),
  };
}

moviesRouter.get(
  "/",
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listQuery>;
    const limit = parseLimit(query.limit, 12);
    const page = parsePage(query.page);
    const sort = query.sort ?? "newest";

    const where: Prisma.PostWhereInput = { category: { kind: "MOVIE" } };
    if (query.genre) {
      where.movie = { genre: { contains: query.genre, mode: "insensitive" } };
    }
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { body: { contains: query.q, mode: "insensitive" } },
        { movie: { movieTitle: { contains: query.q, mode: "insensitive" } } },
        { movie: { director: { contains: query.q, mode: "insensitive" } } },
      ];
    }

    if (sort === "trending") {
      const ids = await rankedPostIds({
        limit,
        offset: (page - 1) * limit,
        kind: "MOVIE",
        mode: "trending",
      });
      const posts = ids.length
        ? await prisma.post.findMany({ where: { id: { in: ids } }, include: postInclude(req.userId) })
        : [];
      const byId = new Map(posts.map((post) => [post.id, post]));
      const ordered = ids.map((id) => byId.get(id)).filter((post): post is NonNullable<typeof post> => Boolean(post));
      res.json({
        posts: ordered.map(serializePost),
        meta: { page, limit, hasMore: ids.length === limit },
      });
      return;
    }

    if (sort === "top") {
      const candidates = await prisma.post.findMany({
        where,
        include: postInclude(req.userId),
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const sorted = candidates
        .map(serializePost)
        .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || b.reviewCount - a.reviewCount);
      const start = (page - 1) * limit;
      res.json({
        posts: sorted.slice(start, start + limit),
        meta: { page, limit, hasMore: start + limit < sorted.length },
      });
      return;
    }

    const posts = await prisma.post.findMany({
      where,
      include: postInclude(req.userId),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    const hasMore = posts.length > limit;
    res.json({
      posts: (hasMore ? posts.slice(0, limit) : posts).map(serializePost),
      meta: { page, limit, hasMore },
    });
  }),
);

moviesRouter.get(
  "/:postId",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.postId);
    const post = await prisma.post.findFirst({
      where: { id: postId, category: { kind: "MOVIE" } },
      include: postInclude(req.userId),
    });
    if (!post) throw ApiError.notFound("That movie discussion could not be found.");

    const [stats, reviews, myReview, related] = await Promise.all([
      movieStats(postId),
      prisma.movieReview.findMany({
        where: { postId },
        include: { user: { select: publicUserSelect } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      req.userId
        ? prisma.movieReview.findUnique({
            where: { postId_userId: { postId, userId: req.userId } },
            include: { user: { select: publicUserSelect } },
          })
        : null,
      prisma.post.findMany({
        where: { categoryId: post.categoryId, id: { not: postId } },
        include: postInclude(req.userId),
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);

    res.json({
      post: serializePost(post),
      stats,
      reviews,
      myReview,
      related: related.map(serializePost),
    });
  }),
);

moviesRouter.put(
  "/:postId/reviews",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.postId);
    const { rating, body } = req.body as z.infer<typeof reviewSchema>;

    const post = await prisma.post.findFirst({
      where: { id: postId, category: { kind: "MOVIE" } },
      select: { id: true, authorId: true, movie: { select: { movieTitle: true } } },
    });
    if (!post) throw ApiError.notFound("That movie discussion could not be found.");

    const review = await prisma.movieReview.upsert({
      where: { postId_userId: { postId, userId: req.userId! } },
      create: { postId, userId: req.userId!, rating, body: body || null },
      update: { rating, body: body || null },
      include: { user: { select: publicUserSelect } },
    });

    await createNotification({
      userId: post.authorId,
      actorId: req.userId!,
      type: "MOVIE_REVIEW",
      body: `rated “${post.movie?.movieTitle ?? "your film pick"}” ${rating}/10.`,
      postId,
    });

    const stats = await movieStats(postId);
    res.json({ review, stats });
  }),
);

moviesRouter.delete(
  "/:postId/reviews/mine",
  requireAuth,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.postId);
    await prisma.movieReview.deleteMany({ where: { postId, userId: req.userId! } });
    const stats = await movieStats(postId);
    res.json({ deleted: true, stats });
  }),
);
