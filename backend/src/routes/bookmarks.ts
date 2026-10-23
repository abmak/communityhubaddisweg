import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { requireAuth } from "../middleware/auth";
import { parseLimit, parsePage } from "../lib/pagination";
import { postInclude, serializePost } from "../lib/serialize";

export const bookmarksRouter = Router();

bookmarksRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, 10);
    const page = parsePage(req.query.page);

    const [bookmarks, total] = await Promise.all([
      prisma.bookmark.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: { postId: true },
      }),
      prisma.bookmark.count({ where: { userId: req.userId! } }),
    ]);

    const ids = bookmarks.map((bookmark) => bookmark.postId);
    const posts = ids.length
      ? await prisma.post.findMany({ where: { id: { in: ids } }, include: postInclude(req.userId) })
      : [];
    const byId = new Map(posts.map((post) => [post.id, post]));

    res.json({
      posts: ids
        .map((id) => byId.get(id))
        .filter((post): post is NonNullable<typeof post> => Boolean(post))
        .map(serializePost),
      meta: { page, limit, total, hasMore: page * limit < total },
    });
  }),
);
