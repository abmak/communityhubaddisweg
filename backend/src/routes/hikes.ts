import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { postInclude, serializePost } from "../lib/serialize";
import { validate } from "../middleware/validate";
import { parseLimit, parsePage } from "../lib/pagination";
import { rankedPostIds } from "../lib/trending";

export const hikesRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  difficulty: z.enum(["EASY", "MODERATE", "HARD", "EXPERT"]).optional(),
  sort: z.enum(["newest", "trending"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const idParams = z.object({ postId: z.string().min(1) });

hikesRouter.get(
  "/",
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listQuery>;
    const limit = parseLimit(query.limit, 12);
    const page = parsePage(query.page);

    const where: Prisma.PostWhereInput = { category: { kind: "HIKE" } };
    if (query.difficulty) {
      where.hike = { difficulty: query.difficulty };
    }
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { body: { contains: query.q, mode: "insensitive" } },
        { hike: { location: { contains: query.q, mode: "insensitive" } } },
      ];
    }

    if (query.sort === "trending" && !query.q && !query.difficulty) {
      const ids = await rankedPostIds({
        limit,
        offset: (page - 1) * limit,
        kind: "HIKE",
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

hikesRouter.get(
  "/:postId",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.postId);
    const post = await prisma.post.findFirst({
      where: { id: postId, category: { kind: "HIKE" } },
      include: postInclude(req.userId),
    });
    if (!post) throw ApiError.notFound("That hiking story could not be found.");

    const related = await prisma.post.findMany({
      where: { categoryId: post.categoryId, id: { not: postId } },
      include: postInclude(req.userId),
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    res.json({ post: serializePost(post), related: related.map(serializePost) });
  }),
);
