import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { validate } from "../middleware/validate";

export const categoriesRouter = Router();

const slugParams = z.object({ slug: z.string().min(1) });

categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { posts: true } },
        posts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });

    res.json({
      categories: categories.map(({ _count, posts, ...category }) => ({
        ...category,
        postCount: _count.posts,
        lastPostAt: posts[0]?.createdAt ?? null,
      })),
    });
  }),
);

categoriesRouter.get(
  "/:slug",
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { slug: String(req.params.slug) },
      include: {
        _count: { select: { posts: true } },
        posts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    if (!category) throw ApiError.notFound("That category does not exist.");

    const { _count, posts, ...rest } = category;
    res.json({
      category: {
        ...rest,
        postCount: _count.posts,
        lastPostAt: posts[0]?.createdAt ?? null,
      },
    });
  }),
);
