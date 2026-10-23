import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { postInclude, publicUserSelect, serializePost } from "../lib/serialize";
import { validate } from "../middleware/validate";
import { parseLimit, parsePage } from "../lib/pagination";
import { rankedPostIds } from "../lib/trending";

export const searchRouter = Router();
export const exploreRouter = Router();

const searchQuery = z.object({
  q: z.string().trim().max(120).optional().default(""),
  type: z.enum(["all", "posts", "members", "categories", "movies", "books", "hikes"]).optional(),
  sort: z.enum(["latest", "popular"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

const emptyResult = {
  query: "",
  type: "all",
  posts: [],
  members: [],
  categories: [],
  movies: [],
  books: [],
  hikes: [],
  meta: { page: 1, limit: 10, hasMore: false, total: 0 },
};

function postSearchWhere(q: string, kind?: "MOVIE" | "BOOK" | "HIKE"): Prisma.PostWhereInput {
  const or: Prisma.PostWhereInput[] = [
    { title: { contains: q, mode: "insensitive" } },
    { body: { contains: q, mode: "insensitive" } },
  ];

  if (kind === "MOVIE") {
    or.push(
      { movie: { movieTitle: { contains: q, mode: "insensitive" } } },
      { movie: { director: { contains: q, mode: "insensitive" } } },
    );
  }
  if (kind === "BOOK") {
    or.push(
      { book: { bookTitle: { contains: q, mode: "insensitive" } } },
      { book: { author: { contains: q, mode: "insensitive" } } },
    );
  }
  if (kind === "HIKE") {
    or.push({ hike: { location: { contains: q, mode: "insensitive" } } });
  }

  return {
    ...(kind ? { category: { kind } } : {}),
    OR: or,
  };
}

searchRouter.get(
  "/",
  validate(searchQuery, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof searchQuery>;
    const q = query.q ?? "";
    if (q.length < 2) {
      res.json({ ...emptyResult, query: q, type: query.type ?? "all" });
      return;
    }

    const type = query.type ?? "all";
    const limit = parseLimit(query.limit, 10);
    const page = parsePage(query.page);
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      query.sort === "popular"
        ? [{ likeCount: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

    const wantPosts = type === "all" || type === "posts";
    const wantMovies = type === "all" || type === "movies";
    const wantBooks = type === "all" || type === "books";
    const wantHikes = type === "all" || type === "hikes";

    const [posts, movies, books, hikes, members, categories] = await Promise.all([
      wantPosts
        ? prisma.post.findMany({
            where: postSearchWhere(q),
            include: postInclude(req.userId),
            orderBy,
            take: type === "all" ? 6 : limit + 1,
            skip: type === "all" ? 0 : (page - 1) * limit,
          })
        : [],
      wantMovies
        ? prisma.post.findMany({
            where: postSearchWhere(q, "MOVIE"),
            include: postInclude(req.userId),
            orderBy: { createdAt: "desc" },
            take: type === "all" ? 4 : limit + 1,
            skip: type === "all" ? 0 : (page - 1) * limit,
          })
        : [],
      wantBooks
        ? prisma.post.findMany({
            where: postSearchWhere(q, "BOOK"),
            include: postInclude(req.userId),
            orderBy: { createdAt: "desc" },
            take: type === "all" ? 4 : limit + 1,
            skip: type === "all" ? 0 : (page - 1) * limit,
          })
        : [],
      wantHikes
        ? prisma.post.findMany({
            where: postSearchWhere(q, "HIKE"),
            include: postInclude(req.userId),
            orderBy: { createdAt: "desc" },
            take: type === "all" ? 4 : limit + 1,
            skip: type === "all" ? 0 : (page - 1) * limit,
          })
        : [],
      type === "all" || type === "members"
        ? prisma.user.findMany({
            where: {
              banned: false,
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
                { bio: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { ...publicUserSelect, _count: { select: { followers: true, posts: true } } },
            take: type === "all" ? 5 : limit,
            skip: type === "all" ? 0 : (page - 1) * limit,
            orderBy: { followers: { _count: "desc" } },
          })
        : [],
      type === "all" || type === "categories"
        ? prisma.category.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
            include: { _count: { select: { posts: true } } },
            take: 10,
          })
        : [],
    ]);

    const hasMore =
      type === "posts"
        ? posts.length > limit
        : type === "movies"
          ? movies.length > limit
          : type === "books"
            ? books.length > limit
            : type === "hikes"
              ? hikes.length > limit
              : false;

    res.json({
      query: q,
      type,
      posts: (type === "posts" ? posts.slice(0, limit) : posts).map(serializePost),
      movies: (type === "movies" ? movies.slice(0, limit) : movies).map(serializePost),
      books: (type === "books" ? books.slice(0, limit) : books).map(serializePost),
      hikes: (type === "hikes" ? hikes.slice(0, limit) : hikes).map(serializePost),
      members: members.map(({ _count, ...user }) => ({
        ...user,
        followerCount: _count.followers,
        postCount: _count.posts,
      })),
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        postCount: _count.posts,
      })),
      meta: {
        page,
        limit,
        hasMore,
        total: type === "all" ? undefined : hasMore ? undefined : posts.length + movies.length + books.length + hikes.length,
      },
    });
  }),
);

exploreRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [trendingIds, categories, suggestedUsers, membersCount, postCount, whatsNew, moviesRaw, booksRaw, hikesRaw] =
      await Promise.all([
        rankedPostIds({ limit: 6, mode: "trending" }),
        prisma.category.findMany({
          orderBy: { sortOrder: "asc" },
          include: {
            _count: { select: { posts: true } },
            posts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          },
        }),
        prisma.user.findMany({
          where: {
            banned: false,
            ...(req.userId
              ? { id: { not: req.userId }, followers: { none: { followerId: req.userId } } }
              : {}),
          },
          select: {
            ...publicUserSelect,
            _count: { select: { followers: true, posts: true } },
          },
          orderBy: { followers: { _count: "desc" } },
          take: 4,
        }),
        prisma.user.count({ where: { banned: false } }),
        prisma.post.count(),
        prisma.category.findUnique({ where: { slug: "whats-new" }, select: { id: true } }),
        prisma.post.findMany({
          where: { category: { kind: "MOVIE" } },
          include: postInclude(req.userId),
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.post.findMany({
          where: { category: { kind: "BOOK" } },
          include: postInclude(req.userId),
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.post.findMany({
          where: { category: { kind: "HIKE" } },
          include: postInclude(req.userId),
          orderBy: { createdAt: "desc" },
          take: 4,
        }),
      ]);

    const trendingPosts = trendingIds.length
      ? await prisma.post.findMany({ where: { id: { in: trendingIds } }, include: postInclude(req.userId) })
      : [];
    const trendingById = new Map(trendingPosts.map((post) => [post.id, post]));

    const announcements = whatsNew
      ? await prisma.post.findMany({
          where: { categoryId: whatsNew.id, title: { not: null } },
          include: postInclude(req.userId),
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : [];

    const topMovies = moviesRaw
      .map(serializePost)
      .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))
      .slice(0, 4);
    const featuredBooks = booksRaw
      .map(serializePost)
      .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))
      .slice(0, 4);

    res.json({
      trending: trendingIds
        .map((id) => trendingById.get(id))
        .filter((post): post is NonNullable<typeof post> => Boolean(post))
        .map(serializePost),
      categories: categories.map(({ _count, posts, ...category }) => ({
        ...category,
        postCount: _count.posts,
        lastPostAt: posts[0]?.createdAt ?? null,
      })),
      suggestedUsers: suggestedUsers.map(({ _count, ...user }) => ({
        ...user,
        followerCount: _count.followers,
        postCount: _count.posts,
      })),
      announcements: announcements.map(serializePost),
      movies: topMovies,
      books: featuredBooks,
      hikes: hikesRaw.map(serializePost),
      stats: { members: membersCount, posts: postCount, categories: categories.length },
    });
  }),
);
