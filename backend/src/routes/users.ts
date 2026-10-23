import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { publicUserSelect, selfUserSelect, postInclude, serializePost } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { parseLimit } from "../lib/pagination";
import { isUserOnline } from "../lib/realtime";
import { createNotification } from "../lib/notifications";
import { clearAuthCookies, setAuthCookies } from "../lib/cookies";
import { writeLimiter } from "../lib/rate-limit";

export const usersRouter = Router();

const mediaRef = z
  .string()
  .trim()
  .max(600)
  .nullable()
  .refine(
    (value) =>
      value === null ||
      value === "" ||
      value.startsWith("/uploads/") ||
      /^https?:\/\//i.test(value),
    "Enter a valid image URL",
  );

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  bio: z.string().trim().max(400).nullable().optional(),
  avatarUrl: mediaRef.optional(),
  coverUrl: mediaRef.optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  showPresence: z.boolean().optional(),
  calendarPreference: z.enum(["GREGORIAN", "ETHIOPIAN"]).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Use at least 8 characters").max(128),
});

const deleteSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

async function followingIdSet(viewerId: string | undefined, ids: string[]) {
  if (!viewerId || ids.length === 0) return new Set<string>();
  const rows = await prisma.follow.findMany({
    where: { followerId: viewerId, followingId: { in: ids } },
    select: { followingId: true },
  });
  return new Set(rows.map((row) => row.followingId));
}

// ---------------------------------------------------------------------------
// Discovery (must come before /:username)
// ---------------------------------------------------------------------------

usersRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json({ users: [] });
      return;
    }
    const users = await prisma.user.findMany({
      where: {
        banned: false,
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: publicUserSelect,
      take: 12,
      orderBy: { followers: { _count: "desc" } },
    });
    const followed = await followingIdSet(req.userId, users.map((user) => user.id));
    res.json({
      users: users.map((user) => ({ ...user, isFollowing: followed.has(user.id) })),
    });
  }),
);

usersRouter.get(
  "/suggested",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
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
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "asc" }],
      take: 5,
    });
    res.json({ users });
  }),
);

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

usersRouter.patch(
  "/me",
  requireAuth,
  writeLimiter,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof updateProfileSchema>;
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
        ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl || null } : {}),
        ...(data.interests !== undefined ? { interests: data.interests } : {}),
        ...(data.showPresence !== undefined ? { showPresence: data.showPresence } : {}),
        ...(data.calendarPreference !== undefined
          ? { calendarPreference: data.calendarPreference }
          : {}),
      },
      select: selfUserSelect,
    });
    res.json({ user });
  }),
);

usersRouter.patch(
  "/me/password",
  requireAuth,
  writeLimiter,
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof passwordSchema>;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId! },
      select: { id: true, username: true, role: true, passwordHash: true },
    });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw ApiError.badRequest("Your current password is not correct.");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: new Date() },
    });

    // Re-issue the current session so the user isn't logged out by their own change.
    setAuthCookies(res, user);
    res.json({ ok: true, message: "Password updated." });
  }),
);

usersRouter.delete(
  "/me",
  requireAuth,
  writeLimiter,
  validate(deleteSchema),
  asyncHandler(async (req, res) => {
    const { password } = req.body as z.infer<typeof deleteSchema>;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId! },
      select: { passwordHash: true },
    });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw ApiError.badRequest("Your password is not correct.");

    await prisma.user.delete({ where: { id: req.userId! } });
    clearAuthCookies(res);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Public profiles
// ---------------------------------------------------------------------------

usersRouter.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const username = String(req.params.username).toLowerCase();
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        ...publicUserSelect,
        banned: true,
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });

    if (!user || user.banned) throw ApiError.notFound("That member could not be found.");
    const { banned: _banned, ...profiledUser } = user;

    const [isFollowing, isFollowedBy] = await Promise.all([
      req.userId
        ? prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: req.userId, followingId: user.id } },
            select: { createdAt: true },
          })
        : null,
      req.userId
        ? prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: user.id, followingId: req.userId } },
            select: { createdAt: true },
          })
        : null,
    ]);

    res.json({
      user: {
        ...profiledUser,
        online: user.showPresence ? isUserOnline(user.id) : false,
        isFollowing: Boolean(isFollowing),
        isFollowedBy: Boolean(isFollowedBy),
        isMe: req.userId === user.id,
      },
    });
  }),
);

usersRouter.get(
  "/:username/posts",
  asyncHandler(async (req, res) => {
    const username = String(req.params.username).toLowerCase();
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, banned: true },
    });
    if (!user || user.banned) throw ApiError.notFound("That member could not be found.");

    const limit = parseLimit(req.query.limit, 10);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      include: postInclude(req.userId),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = posts.length > limit;
    const page = hasMore ? posts.slice(0, limit) : posts;
    res.json({
      posts: page.map(serializePost),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  }),
);

async function listFollowGraph(
  req: Request,
  res: Response,
  relation: "followers" | "following",
): Promise<void> {
  const username = String(req.params.username).toLowerCase();
  const limit = parseLimit(req.query.limit, 20);
  const page = Math.max(1, Number(req.query.page) || 1);

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, banned: true },
  });
  if (!target || target.banned) throw ApiError.notFound("That member could not be found.");

  const take = limit + 1;
  let users;

  if (relation === "followers") {
    const rows = await prisma.follow.findMany({
      where: { followingId: target.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take,
      include: { follower: { select: publicUserSelect } },
    });
    users = rows.map((row) => row.follower);
  } else {
    const rows = await prisma.follow.findMany({
      where: { followerId: target.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take,
      include: { following: { select: publicUserSelect } },
    });
    users = rows.map((row) => row.following);
  }

  const hasMore = users.length > limit;
  const visible = hasMore ? users.slice(0, limit) : users;
  const followed = await followingIdSet(
    req.userId,
    visible.map((user) => user.id),
  );

  res.json({
    users: visible.map((user) => ({ ...user, isFollowing: followed.has(user.id) })),
    page,
    hasMore,
  });
}

usersRouter.get(
  "/:username/followers",
  asyncHandler(async (req, res) => {
    await listFollowGraph(req, res, "followers");
  }),
);

usersRouter.get(
  "/:username/following",
  asyncHandler(async (req, res) => {
    await listFollowGraph(req, res, "following");
  }),
);

usersRouter.post(
  "/:username/follow",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.params.username).toLowerCase();
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true, displayName: true, banned: true },
    });
    if (!target || target.banned) throw ApiError.notFound("That member could not be found.");
    if (target.id === req.userId) throw ApiError.badRequest("You cannot follow yourself.");

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.userId!, followingId: target.id } },
    });

    if (!existing) {
      await prisma.follow.create({
        data: { followerId: req.userId!, followingId: target.id },
      });
      await createNotification({
        userId: target.id,
        actorId: req.userId!,
        type: "FOLLOW",
        body: "started following you.",
      });
    }

    const followerCount = await prisma.follow.count({ where: { followingId: target.id } });
    res.json({ following: true, followerCount });
  }),
);

usersRouter.delete(
  "/:username/follow",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.params.username).toLowerCase();
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!target) throw ApiError.notFound("That member could not be found.");

    await prisma.follow.deleteMany({
      where: { followerId: req.userId!, followingId: target.id },
    });

    const followerCount = await prisma.follow.count({ where: { followingId: target.id } });
    res.json({ following: false, followerCount });
  }),
);
