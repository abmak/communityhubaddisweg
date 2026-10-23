import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { postInclude, serializePoll, serializePost } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { parseLimit, parsePage } from "../lib/pagination";
import { rankedPostIds } from "../lib/trending";
import { createNotification } from "../lib/notifications";
import { removeUploads } from "../lib/storage";
import { isModerator } from "../middleware/auth";
import { writeLimiter } from "../lib/rate-limit";
import { emitToAll } from "../lib/realtime";

export const postsRouter = Router();

const mediaRef = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => value === "" || value.startsWith("/uploads/") || /^https?:\/\//i.test(value),
    "Enter a valid image URL",
  );

const optionalText = (max: number) => z.string().trim().max(max).optional();
const httpUrl = z
  .string()
  .trim()
  .max(600)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "Enter a valid link");

const movieDetailSchema = z.object({
  movieTitle: z.string().trim().min(1, "Add the movie title").max(140),
  director: optionalText(120),
  year: z.coerce.number().int().min(1888).max(2100).optional(),
  genre: optionalText(80),
  synopsis: optionalText(4000),
  trailerUrl: httpUrl.optional(),
  posterUrl: mediaRef.optional(),
});

const bookDetailSchema = z.object({
  bookTitle: z.string().trim().min(1, "Add the book title").max(160),
  author: optionalText(120),
  genre: optionalText(80),
  synopsis: optionalText(4000),
  coverUrl: mediaRef.optional(),
});

const hikeDetailSchema = z.object({
  location: z.string().trim().min(1, "Where was the hike?").max(160),
  difficulty: z.enum(["EASY", "MODERATE", "HARD", "EXPERT"]),
  distanceKm: z.coerce.number().min(0).max(2000).optional(),
  durationHours: z.coerce.number().min(0).max(1000).optional(),
  tips: optionalText(3000),
});

const pollSchema = z
  .object({
    question: z.string().trim().min(1, "Ask a question").max(200),
    options: z
      .array(z.string().trim().min(1, "Fill in every option").max(80))
      .min(2, "Add at least two options")
      .max(6, "A poll can have at most six options"),
  })
  .refine(
    (poll) => new Set(poll.options.map((option) => option.toLowerCase())).size === poll.options.length,
    { message: "Poll options must be different", path: ["options"] },
  );

const createPostSchema = z
  .object({
    categoryId: z.string().min(1, "Choose a category"),
    title: z.string().trim().max(160).optional(),
    // Photo- and voice-first posts are welcome, so text is optional when media is attached.
    body: z.string().trim().max(10_000).optional().default(""),
    mediaIds: z.array(z.string().min(1)).max(6).optional(),
    movie: movieDetailSchema.optional(),
    book: bookDetailSchema.optional(),
    hike: hikeDetailSchema.optional(),
    poll: pollSchema.optional(),
  })
  .refine(
    (data) => data.body.length > 0 || (data.mediaIds?.length ?? 0) > 0 || Boolean(data.poll),
    {
      message: "Write something, add a photo or voice note, or ask a poll question.",
      path: ["body"],
    },
  );

const updatePostSchema = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  body: z.string().trim().min(1, "Posts cannot be empty").max(10_000).optional(),
});

const voteSchema = z.object({
  optionId: z.string().min(1, "Choose an option"),
});

const reportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "HATE_SPEECH", "MISINFORMATION", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
});

const idParams = z.object({ id: z.string().min(1) });

const feedQuerySchema = z.object({
  feed: z.enum(["home", "latest", "following", "popular", "trending"]).optional(),
  sort: z.enum(["latest", "popular", "trending"]).optional(),
  category: z.string().trim().min(1).optional(),
  kind: z.enum(["DISCUSSION", "MOVIE", "BOOK", "HIKE"]).optional(),
  author: z.string().trim().min(1).optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

async function mediaIdsForPost(userId: string, mediaIds: string[]) {
  if (mediaIds.length === 0) return [];
  const media = await prisma.media.findMany({
    where: { id: { in: mediaIds }, ownerId: userId, postId: null },
    select: { id: true, kind: true },
  });
  if (media.length !== mediaIds.length) {
    throw ApiError.badRequest("Some attachments were invalid or already used. Please re-upload.");
  }
  if (media.filter((item) => item.kind === "AUDIO").length > 1) {
    throw ApiError.badRequest("A post can include one voice recording.");
  }
  return media.map((item) => item.id);
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

postsRouter.get(
  "/",
  validate(feedQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof feedQuerySchema>;
    const mode = query.sort ?? query.feed ?? "latest";
    const limit = parseLimit(query.limit, 10);
    const page = parsePage(query.page);
    const viewerId = req.userId;

    const where: Prisma.PostWhereInput = {};

    let categoryId: string | undefined;
    if (query.category) {
      const category = await prisma.category.findUnique({
        where: { slug: query.category },
        select: { id: true },
      });
      if (!category) throw ApiError.notFound("That category does not exist.");
      categoryId = category.id;
      where.categoryId = category.id;
    } else if (query.kind) {
      where.category = { kind: query.kind };
    }

    if (query.author) {
      const author = await prisma.user.findUnique({
        where: { username: query.author.toLowerCase() },
        select: { id: true, banned: true },
      });
      if (!author || author.banned) throw ApiError.notFound("That member could not be found.");
      where.authorId = author.id;
    }

    if (query.q) {
      where.OR = [
        { body: { contains: query.q, mode: "insensitive" } },
        { title: { contains: query.q, mode: "insensitive" } },
      ];
    }

    if (mode === "following") {
      if (!viewerId) throw ApiError.unauthorized("Sign in to see posts from people you follow.");
      const following = await prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      });
      where.authorId = {
        in: [...following.map((row) => row.followingId), viewerId],
      };
    }

    // Ranked feeds use recency-weighted engagement in SQL, then hydrate.
    if ((mode === "trending" || mode === "popular") && !query.q && !query.author) {
      const ids = await rankedPostIds({
        limit,
        offset: (page - 1) * limit,
        categoryId,
        kind: query.kind,
        mode,
      });
      const posts = ids.length
        ? await prisma.post.findMany({ where: { id: { in: ids } }, include: postInclude(viewerId) })
        : [];
      const byId = new Map(posts.map((post) => [post.id, post]));
      const ordered = ids.map((id) => byId.get(id)).filter((post): post is NonNullable<typeof post> => Boolean(post));

      res.json({
        posts: ordered.map(serializePost),
        nextCursor: null,
        meta: { page, limit, hasMore: ids.length === limit },
      });
      return;
    }

    if (mode === "popular" || mode === "trending") {
      const posts = await prisma.post.findMany({
        where,
        include: postInclude(viewerId),
        orderBy:
          mode === "popular"
            ? [{ likeCount: "desc" }, { commentCount: "desc" }, { createdAt: "desc" }]
            : [{ createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit + 1,
      });
      const hasMore = posts.length > limit;
      const visible = hasMore ? posts.slice(0, limit) : posts;
      res.json({
        posts: visible.map(serializePost),
        nextCursor: null,
        meta: { page, limit, hasMore },
      });
      return;
    }

    const cursor = query.cursor;
    const posts = await prisma.post.findMany({
      where,
      include: postInclude(viewerId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > limit;
    const visible = hasMore ? posts.slice(0, limit) : posts;
    res.json({
      posts: visible.map(serializePost),
      nextCursor: hasMore ? visible[visible.length - 1]?.id ?? null : null,
      meta: { page: 1, limit, hasMore },
    });
  }),
);

// ---------------------------------------------------------------------------
// Single post
// ---------------------------------------------------------------------------

postsRouter.get(
  "/:id",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id },
      include: postInclude(req.userId),
    });
    if (!post) throw ApiError.notFound("That post could not be found.");

    if (req.userId !== post.authorId) {
      await prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    }

    res.json({ post: serializePost({ ...post, viewCount: post.viewCount + (req.userId === post.authorId ? 0 : 1) }) });
  }),
);

postsRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate(createPostSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createPostSchema>;
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw ApiError.notFound("That category does not exist.");

    if (category.kind === "MOVIE" && !data.movie) {
      throw ApiError.badRequest("Add the movie title and details before publishing.");
    }
    if (category.kind === "BOOK" && !data.book) {
      throw ApiError.badRequest("Add the book title and details before publishing.");
    }
    if (category.kind === "HIKE" && !data.hike) {
      throw ApiError.badRequest("Add the trail location and difficulty before publishing.");
    }

    const mediaIds = await mediaIdsForPost(req.userId!, data.mediaIds ?? []);

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId: req.userId!,
          categoryId: category.id,
          title: data.title?.trim() || null,
          body: data.body,
          ...(category.kind === "MOVIE" && data.movie
            ? {
                movie: {
                  create: {
                    movieTitle: data.movie.movieTitle,
                    director: data.movie.director || null,
                    year: data.movie.year ?? null,
                    genre: data.movie.genre || null,
                    synopsis: data.movie.synopsis || null,
                    trailerUrl: data.movie.trailerUrl || null,
                    posterUrl: data.movie.posterUrl || null,
                  },
                },
              }
            : {}),
          ...(category.kind === "BOOK" && data.book
            ? {
                book: {
                  create: {
                    bookTitle: data.book.bookTitle,
                    author: data.book.author || null,
                    genre: data.book.genre || null,
                    synopsis: data.book.synopsis || null,
                    coverUrl: data.book.coverUrl || null,
                  },
                },
              }
            : {}),
          ...(category.kind === "HIKE" && data.hike
            ? {
                hike: {
                  create: {
                    location: data.hike.location,
                    difficulty: data.hike.difficulty,
                    distanceKm: data.hike.distanceKm ?? null,
                    durationHours: data.hike.durationHours ?? null,
                    tips: data.hike.tips || null,
                  },
                },
              }
            : {}),
        },
      });

      if (data.poll) {
        await tx.poll.create({
          data: {
            postId: created.id,
            question: data.poll.question,
            options: {
              create: data.poll.options.map((label, index) => ({ label, sortOrder: index })),
            },
          },
        });
      }

      if (mediaIds.length > 0) {
        await tx.media.updateMany({
          where: { id: { in: mediaIds }, ownerId: req.userId! },
          data: { postId: created.id },
        });
      }

      return tx.post.findUniqueOrThrow({
        where: { id: created.id },
        include: postInclude(req.userId),
      });
    });

    res.status(201).json({ post: serializePost(post) });
  }),
);

postsRouter.patch(
  "/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(updatePostSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof updatePostSchema>;
    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) throw ApiError.notFound("That post could not be found.");
    if (post.authorId !== req.userId && !isModerator(req)) throw ApiError.forbidden();

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title || null } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
      },
      include: postInclude(req.userId),
    });

    res.json({ post: serializePost(updated) });
  }),
);

postsRouter.delete(
  "/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, media: { select: { url: true, thumbnailUrl: true } } },
    });
    if (!post) throw ApiError.notFound("That post could not be found.");
    if (post.authorId !== req.userId && !isModerator(req)) throw ApiError.forbidden();

    await prisma.post.delete({ where: { id } });
    await removeUploads(post.media.flatMap((item) => [item.url, item.thumbnailUrl]));
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

/**
 * One vote per member per poll; voting again on a different option moves the
 * vote instead of stacking it. Counts are updated in the same transaction and
 * broadcast to everyone so results move in real time.
 */
postsRouter.post(
  "/:id/poll/vote",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(voteSchema),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.id);
    const { optionId } = req.body as z.infer<typeof voteSchema>;

    const poll = await prisma.poll.findUnique({
      where: { postId },
      include: { options: { select: { id: true } } },
    });
    if (!poll) throw ApiError.notFound("This post does not have a poll.");
    if (!poll.options.some((option) => option.id === optionId)) {
      throw ApiError.badRequest("Choose one of this poll's options.");
    }
    if (poll.endsAt && poll.endsAt.getTime() <= Date.now()) {
      throw ApiError.badRequest("This poll has closed.");
    }

    const existing = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId: poll.id, userId: req.userId! } },
    });

    if (existing?.optionId !== optionId) {
      await prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.pollVote.delete({ where: { id: existing.id } });
          await tx.pollOption.update({
            where: { id: existing.optionId },
            data: { voteCount: { decrement: 1 } },
          });
        }
        await tx.pollVote.create({
          data: { pollId: poll.id, optionId, userId: req.userId! },
        });
        await tx.pollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      });
    }

    const updated = await prisma.poll.findUniqueOrThrow({
      where: { id: poll.id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        votes: { where: { userId: req.userId! }, select: { optionId: true } },
      },
    });
    const serialized = serializePoll(updated);

    emitToAll("poll:update", {
      postId,
      totalVotes: serialized.totalVotes,
      options: serialized.options.map((option) => ({ id: option.id, voteCount: option.voteCount })),
    });

    res.json({ poll: serialized });
  }),
);

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

postsRouter.post(
  "/:id/like",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true, body: true },
    });
    if (!post) throw ApiError.notFound("That post could not be found.");

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: id, userId: req.userId! } },
    });

    if (!existing) {
      await prisma.$transaction([
        prisma.postLike.create({ data: { postId: id, userId: req.userId! } }),
        prisma.post.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
      ]);
      await createNotification({
        userId: post.authorId,
        actorId: req.userId!,
        type: "POST_LIKE",
        body: post.title ? `liked “${post.title.slice(0, 70)}”.` : "liked your post.",
        postId: id,
      });
    }

    const likeCount = await prisma.postLike.count({ where: { postId: id } });
    res.json({ liked: true, likeCount });
  }),
);

postsRouter.delete(
  "/:id/like",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId: id, userId: req.userId! } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.postLike.delete({
          where: { postId_userId: { postId: id, userId: req.userId! } },
        }),
        prisma.post.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
    }

    const likeCount = await prisma.postLike.count({ where: { postId: id } });
    res.json({ liked: false, likeCount });
  }),
);

postsRouter.post(
  "/:id/bookmark",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw ApiError.notFound("That post could not be found.");

    const existing = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId: id, userId: req.userId! } },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.bookmark.create({ data: { postId: id, userId: req.userId! } }),
        prisma.post.update({ where: { id }, data: { bookmarkCount: { increment: 1 } } }),
      ]);
    }
    res.json({ bookmarked: true });
  }),
);

postsRouter.delete(
  "/:id/bookmark",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId: id, userId: req.userId! } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.bookmark.delete({
          where: { postId_userId: { postId: id, userId: req.userId! } },
        }),
        prisma.post.update({ where: { id }, data: { bookmarkCount: { decrement: 1 } } }),
      ]);
    }
    res.json({ bookmarked: false });
  }),
);

postsRouter.post(
  "/:id/share",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw ApiError.notFound("That post could not be found.");

    const updated = await prisma.post.update({
      where: { id },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    res.json({ shareCount: updated.shareCount, url: `/posts/${id}` });
  }),
);

postsRouter.post(
  "/:id/report",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(reportSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof reportSchema>;
    const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw ApiError.notFound("That post could not be found.");

    const existing = await prisma.report.findFirst({
      where: { reporterId: req.userId!, targetType: "POST", targetId: id, status: "OPEN" },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict("You have already reported this post. Our team will review it.");

    await prisma.report.create({
      data: {
        reporterId: req.userId!,
        targetType: "POST",
        targetId: id,
        reason: data.reason,
        details: data.details || null,
      },
    });

    res.status(201).json({ ok: true, message: "Thanks — a moderator will take a look." });
  }),
);
