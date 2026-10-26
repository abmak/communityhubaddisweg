import { Router, type Request } from "express";
import { z } from "zod";
import { EventKind, EventTopic, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { EVENT_TOPIC_VALUES } from "../lib/event-topics";
import { parseLimit, parsePage } from "../lib/pagination";
import { publicUserSelect, selfUserSelect } from "../lib/serialize";
import { emitToAll } from "../lib/realtime";
import {
  PERMISSIONS,
  PERMISSION_SET,
  canManageRole,
  isPermission,
  permissionsFor,
  requirePermission,
} from "../lib/rbac";
import { getRole, listRoles, refreshRoles, roleRankSync } from "../lib/roles";

export const adminRouter = Router();

// Every admin surface needs a signed-in member; individual routes then narrow
// further with `requirePermission`, which resolves the caller's live role
// permissions from the database.
adminRouter.use(requireAuth);

const DAY_MS = 24 * 60 * 60 * 1000;

const pageQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  q: z.string().trim().max(120).optional(),
});

const idParams = z.object({ id: z.string().min(1) });

const rangeQuery = z.object({
  range: z.coerce.number().int().optional(),
});

const userListQuery = pageQuery.extend({
  role: z.string().trim().max(40).optional(),
  status: z.enum(["all", "active", "suspended"]).default("all"),
  sort: z.enum(["newest", "oldest", "posts", "comments", "recent"]).default("newest"),
});

const updateUserSchema = z.object({
  role: z.string().trim().max(40).optional(),
  banned: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

const reportParams = z.object({ id: z.string().min(1) });

const updateReportSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]),
  note: z.string().trim().max(500).optional(),
});

const contentQuery = pageQuery.extend({
  type: z.enum(["POST", "COMMENT"]).default("POST"),
  status: z.enum(["all", "visible", "removed"]).default("visible"),
  category: z.string().trim().max(60).optional(),
});

const contentParams = z.object({ type: z.enum(["POST", "COMMENT"]), id: z.string().min(1) });

const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(10).max(500),
  icon: z.string().trim().min(1).max(40).default("MessageCircle"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #0f766e")
    .default("#0f766e"),
  kind: z.enum(["DISCUSSION", "MOVIE", "BOOK", "HIKE"]).default("DISCUSSION"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const categoryUpdateSchema = categorySchema.partial();

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(5).max(4000),
});

const auditQuery = pageQuery.extend({
  action: z.string().trim().max(60).optional(),
  actorId: z.string().trim().max(60).optional(),
});

interface AuditInput {
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}

const roleSlugSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/, "Use 2–40 uppercase letters, numbers or underscores");

const roleCreateSchema = z.object({
  slug: roleSlugSchema,
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).default(""),
  permissions: z.array(z.string().trim()).max(PERMISSIONS.length).default([]),
  rank: z.coerce.number().int().min(11).max(99).optional(),
});

const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().trim()).max(PERMISSIONS.length).optional(),
  rank: z.coerce.number().int().min(11).max(99).optional(),
});

function assertKnownPermissions(permissions: string[]): void {
  const unknown = permissions.filter((permission) => !PERMISSION_SET.has(permission));
  if (unknown.length > 0) {
    throw ApiError.badRequest(`Unknown capability: ${unknown.join(", ")}`);
  }
}

async function recordAction(req: Request, input: AuditInput): Promise<void> {
  if (!req.userId || !req.userRole) return;
  await prisma.adminAction.create({
    data: {
      actorId: req.userId,
      actorRole: req.userRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      summary: input.summary,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}

function normalizeRange(raw: unknown): 7 | 30 | 90 {
  const value = Number(raw);
  return value === 90 ? 90 : value === 7 ? 7 : 30;
}

function startOfWindow(days: number): Date {
  const start = new Date(Date.now() - (days - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return start;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type DailyRow = { day: Date; count: bigint };

function emptySeries(since: Date, days: number) {
  return Array.from({ length: days }).map((_, index) => {
    const date = new Date(since.getTime() + index * DAY_MS);
    return { day: dayKey(date), members: 0, posts: 0, comments: 0, reports: 0 };
  });
}

// ---------------------------------------------------------------------------
// Session & access
// ---------------------------------------------------------------------------

adminRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, username: true, displayName: true, avatarUrl: true, role: true },
    });
    if (!user) throw ApiError.notFound("Your account could not be found.");
    res.json({ user, permissions: await permissionsFor(user.role) });
  }),
);

// ---------------------------------------------------------------------------
// Roles & permissions (editable at runtime)
// ---------------------------------------------------------------------------

adminRouter.get(
  "/roles",
  requirePermission("admin.roles.view"),
  asyncHandler(async (_req, res) => {
    const [roles, counts] = await Promise.all([
      listRoles(),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    ]);
    const byRole = new Map(counts.map((row) => [row.role, row._count._all]));
    res.json({
      permissions: PERMISSIONS,
      roles: roles.map((role) => ({
        id: role.id,
        slug: role.slug,
        name: role.name,
        description: role.description,
        permissions: role.permissions.filter(isPermission),
        rank: role.rank,
        system: role.system,
        members: byRole.get(role.slug) ?? 0,
      })),
    });
  }),
);

adminRouter.post(
  "/roles",
  requirePermission("admin.roles.manage"),
  validate(roleCreateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof roleCreateSchema>;
    assertKnownPermissions(input.permissions);

    const actorRank = roleRankSync(req.userRole);
    if (input.rank !== undefined && input.rank >= actorRank) {
      throw ApiError.forbidden("A new role cannot outrank your own role.");
    }
    const assignedRank = input.rank ?? Math.min(actorRank - 1, 20);

    const actorPermissions = await permissionsFor(req.userRole);
    const beyond = input.permissions.filter((permission) => !actorPermissions.includes(permission as never));
    if (beyond.length > 0) {
      throw ApiError.forbidden(`You cannot grant a capability you do not hold: ${beyond.join(", ")}`);
    }

    const existing = await prisma.roleDefinition.findFirst({
      where: { OR: [{ slug: input.slug }, { name: input.name }] },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict("A role with that slug or name already exists.");

    const role = await prisma.roleDefinition.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        rank: assignedRank,
        system: false,
      },
    });
    await refreshRoles();
    await recordAction(req, {
      action: "role.created",
      targetType: "ROLE",
      targetId: role.slug,
      summary: `Created the role ${role.name} (${role.slug}) with ${role.permissions.length} capabilities`,
      metadata: { slug: role.slug, permissions: role.permissions, rank: role.rank },
    });
    res.status(201).json({ role });
  }),
);

adminRouter.patch(
  "/roles/:id",
  requirePermission("admin.roles.manage"),
  validate(idParams, "params"),
  validate(roleUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const input = req.body as z.infer<typeof roleUpdateSchema>;

    const role = await prisma.roleDefinition.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!role) throw ApiError.notFound("That role could not be found.");
    if (role.slug === req.userRole) {
      throw ApiError.badRequest(
        "You cannot edit the permissions of the role you are signed in with. Ask another administrator.",
      );
    }

    if (input.permissions) assertKnownPermissions(input.permissions);

    const actorRank = roleRankSync(req.userRole);
    if (input.rank !== undefined && input.rank >= actorRank) {
      throw ApiError.forbidden("A role cannot outrank your own role.");
    }
    if (input.rank !== undefined && input.rank <= role.rank && role.slug === "ADMIN") {
      throw ApiError.forbidden("The administrator role keeps the highest rank.");
    }

    const nextPermissions = input.permissions ?? role.permissions;
    if (input.permissions) {
      const actorPermissions = await permissionsFor(req.userRole);
      const beyond = input.permissions.filter(
        (permission) => !actorPermissions.includes(permission as never),
      );
      if (beyond.length > 0) {
        throw ApiError.forbidden(`You cannot grant a capability you do not hold: ${beyond.join(", ")}`);
      }
    }

    const updated = await prisma.roleDefinition.update({
      where: { id: role.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
        ...(input.rank !== undefined ? { rank: input.rank } : {}),
      },
    });

    const losesGovernance =
      role.permissions.includes("admin.roles.manage") &&
      !nextPermissions.includes("admin.roles.manage");
    if (losesGovernance) {
      throw ApiError.conflict(
        "Removing admin.roles.manage from this role would leave no account able to manage roles.",
      );
    }

    await refreshRoles();
    await recordAction(req, {
      action: "role.updated",
      targetType: "ROLE",
      targetId: role.slug,
      summary: `Updated the role ${role.name}: now ${nextPermissions.length} capabilities`,
      metadata: {
        before: { permissions: role.permissions, rank: role.rank, name: role.name },
        after: { permissions: nextPermissions, rank: updated.rank, name: updated.name },
      },
    });
    res.json({ role: updated });
  }),
);

adminRouter.delete(
  "/roles/:id",
  requirePermission("admin.roles.manage"),
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const role = await prisma.roleDefinition.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!role) throw ApiError.notFound("That role could not be found.");
    if (role.system) {
      throw ApiError.conflict("The built-in Member, Moderator and Administrator roles cannot be deleted.");
    }
    const members = await prisma.user.count({ where: { role: role.slug } });
    if (members > 0) {
      throw ApiError.conflict(
        `${members} ${members === 1 ? "account still uses" : "accounts still use"} this role. Reassign them first.`,
      );
    }

    await prisma.roleDefinition.delete({ where: { id: role.id } });
    await refreshRoles();
    await recordAction(req, {
      action: "role.deleted",
      targetType: "ROLE",
      targetId: role.slug,
      summary: `Deleted the unused role ${role.name} (${role.slug})`,
    });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Comprehensive reporting
// ---------------------------------------------------------------------------

adminRouter.get(
  "/analytics",
  requirePermission("admin.dashboard.view"),
  validate(rangeQuery, "query"),
  asyncHandler(async (req, res) => {
    const days = normalizeRange((req.query as { range?: number }).range);
    const since = startOfWindow(days);
    const previousSince = new Date(since.getTime() - days * DAY_MS);

    const [
      users,
      posts,
      comments,
      messages,
      openReports,
      likes,
      bookmarks,
      media,
      events,
      places,
      newUsers,
      prevUsers,
      newPosts,
      prevPosts,
      newComments,
      prevComments,
      newReports,
      prevReports,
      roleRows,
      byReasonRows,
      byTargetRows,
      reportStatusRows,
      resolvedInWindow,
      topReportedRows,
      categories,
      categoryTotals,
      topPosts,
      postAuthors,
      commentAuthors,
      messagesInWindow,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count({ where: { deletedAt: null } }),
      prisma.message.count(),
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.postLike.count(),
      prisma.bookmark.count(),
      prisma.media.count(),
      prisma.event.count(),
      prisma.place.count(),
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
      prisma.post.count({ where: { createdAt: { gte: since } } }),
      prisma.post.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
      prisma.comment.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.comment.count({ where: { createdAt: { gte: previousSince, lt: since }, deletedAt: null } }),
      prisma.report.count({ where: { createdAt: { gte: since } } }),
      prisma.report.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.report.groupBy({
        by: ["reason"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { reason: "desc" } },
        take: 6,
      }),
      prisma.report.groupBy({
        by: ["targetType"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.report.findMany({
        where: { resolvedAt: { gte: since } },
        select: { createdAt: true, resolvedAt: true },
        take: 500,
        orderBy: { resolvedAt: "desc" },
      }),
      prisma.report.groupBy({
        by: ["reporterId"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { reporterId: "desc" } },
        take: 5,
      }),
      prisma.category.findMany({
        include: { _count: { select: { posts: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.post.groupBy({
        by: ["categoryId"],
        _sum: { commentCount: true, likeCount: true, viewCount: true },
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: since } },
        orderBy: [{ likeCount: "desc" }, { commentCount: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          likeCount: true,
          commentCount: true,
          viewCount: true,
          createdAt: true,
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      }),
      prisma.post.groupBy({
        by: ["authorId"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.comment.groupBy({
        by: ["authorId"],
        where: { createdAt: { gte: since }, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.message.count({ where: { createdAt: { gte: since } } }),
    ]);

    const [memberSeries, postSeries, commentSeries, reportSeries] = await Promise.all([
      prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
        FROM "User" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
        FROM "Post" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
        FROM "Comment" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<DailyRow[]>`
        SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*) AS count
        FROM "Report" WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const series = emptySeries(since, days);
    const byDay = new Map(series.map((entry) => [entry.day, entry]));
    const apply = (rows: DailyRow[], key: "members" | "posts" | "comments" | "reports") => {
      for (const row of rows) {
        const entry = byDay.get(dayKey(new Date(row.day)));
        if (entry) entry[key] = Number(row.count);
      }
    };
    apply(memberSeries, "members");
    apply(postSeries, "posts");
    apply(commentSeries, "comments");
    apply(reportSeries, "reports");

    const contributorCounts = new Map<string, { posts: number; comments: number }>();
    for (const row of postAuthors) {
      contributorCounts.set(row.authorId, { posts: row._count._all, comments: 0 });
    }
    for (const row of commentAuthors) {
      const current = contributorCounts.get(row.authorId) ?? { posts: 0, comments: 0 };
      current.comments = row._count._all;
      contributorCounts.set(row.authorId, current);
    }

    const contributorIds = [...contributorCounts.keys()];
    const [contributorUsers, returningContributors] = await Promise.all([
      contributorIds.length
        ? prisma.user.findMany({
            where: { id: { in: contributorIds } },
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          })
        : Promise.resolve([]),
      contributorIds.length
        ? prisma.user.count({ where: { id: { in: contributorIds }, createdAt: { lt: since } } })
        : Promise.resolve(0),
    ]);

    const contributorProfiles = new Map(contributorUsers.map((user) => [user.id, user]));
    const topContributors = [...contributorCounts.entries()]
      .map(([id, counts]) => ({
        ...(contributorProfiles.get(id) ?? {
          id,
          username: "unknown",
          displayName: "Former member",
          avatarUrl: null,
        }),
        posts: counts.posts,
        comments: counts.comments,
        activity: counts.posts + counts.comments,
      }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 6);

    const reporterProfiles = topReportedRows.length
      ? await prisma.user.findMany({
          where: { id: { in: topReportedRows.map((row) => row.reporterId) } },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : [];
    const reporterMap = new Map(reporterProfiles.map((user) => [user.id, user]));

    const categorySums = new Map(
      categoryTotals.map((row) => [
        row.categoryId,
        {
          comments: row._sum.commentCount ?? 0,
          likes: row._sum.likeCount ?? 0,
          views: row._sum.viewCount ?? 0,
        },
      ]),
    );

    const resolutionHours = resolvedInWindow
      .filter((report) => report.resolvedAt)
      .map((report) => (report.resolvedAt!.getTime() - report.createdAt.getTime()) / 3_600_000);

    const reportStatus = new Map(reportStatusRows.map((row) => [row.status, row._count._all]));

    res.json({
      range: days,
      generatedAt: new Date().toISOString(),
      totals: {
        users,
        posts,
        comments,
        messages,
        events,
        places,
        likes,
        bookmarks,
        media,
        openReports,
      },
      deltas: {
        users: { current: newUsers, previous: prevUsers },
        posts: { current: newPosts, previous: prevPosts },
        comments: { current: newComments, previous: prevComments },
        reports: { current: newReports, previous: prevReports },
      },
      roleBreakdown: roleRows.map((row) => ({ role: row.role, count: row._count._all })),
      series,
      engagement: {
        activeContributors: contributorIds.length,
        returningContributors,
        returningRate: contributorIds.length
          ? Math.round((returningContributors / contributorIds.length) * 100)
          : 0,
        postsPerMember: users ? Math.round((posts / users) * 10) / 10 : 0,
        commentsPerPost: posts ? Math.round((comments / posts) * 10) / 10 : 0,
        likesPerPost: posts ? Math.round((likes / posts) * 10) / 10 : 0,
        messagesSent: messagesInWindow,
      },
      moderation: {
        open: reportStatus.get("OPEN") ?? 0,
        resolved: reportStatus.get("RESOLVED") ?? 0,
        dismissed: reportStatus.get("DISMISSED") ?? 0,
        filedInRange: newReports,
        resolvedInRange: resolvedInWindow.length,
        avgResolutionHours: resolutionHours.length
          ? Math.round(
              (resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length) * 10,
            ) / 10
          : null,
        byReason: byReasonRows.map((row) => ({ reason: row.reason, count: row._count._all })),
        byTarget: byTargetRows.map((row) => ({
          targetType: row.targetType,
          count: row._count._all,
        })),
        topReporters: topReportedRows.map((row) => {
          const profile = reporterMap.get(row.reporterId);
          return {
            id: row.reporterId,
            username: profile?.username ?? "unknown",
            displayName: profile?.displayName ?? "Former member",
            avatarUrl: profile?.avatarUrl ?? null,
            count: row._count._all,
          };
        }),
      },
      rooms: categories.map(({ _count, ...category }) => {
        const sums = categorySums.get(category.id);
        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          color: category.color,
          posts: _count.posts,
          comments: sums?.comments ?? 0,
          likes: sums?.likes ?? 0,
          views: sums?.views ?? 0,
        };
      }),
      topPosts: topPosts.map((post) => ({
        id: post.id,
        title: post.title,
        excerpt: post.body.slice(0, 180),
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        author: post.author,
        category: post.category,
      })),
      topContributors,
    });
  }),
);

/** Kept for older clients: a compact version of the overview totals. */
adminRouter.get(
  "/stats",
  requirePermission("admin.dashboard.view"),
  asyncHandler(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [users, posts, comments, messages, openReports, newMembers, categories] =
      await Promise.all([
        prisma.user.count(),
        prisma.post.count(),
        prisma.comment.count({ where: { deletedAt: null } }),
        prisma.message.count(),
        prisma.report.count({ where: { status: "OPEN" } }),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.category.findMany({
          include: { _count: { select: { posts: true } } },
          orderBy: { sortOrder: "asc" },
        }),
      ]);

    res.json({
      totals: { users, posts, comments, messages, openReports, newMembers },
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        postCount: _count.posts,
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------

adminRouter.get(
  "/users",
  requirePermission("admin.users.view"),
  validate(userListQuery, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof userListQuery>;
    const limit = parseLimit(query.limit, 20);
    const page = parsePage(query.page);
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);

    const where: Prisma.UserWhereInput = {
      ...(query.q
        ? {
            OR: [
              { username: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { displayName: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.status === "suspended" ? { banned: true } : {}),
      ...(query.status === "active" ? { banned: false } : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sort === "oldest"
        ? { createdAt: "asc" }
        : query.sort === "posts"
          ? { posts: { _count: "desc" } }
          : query.sort === "comments"
            ? { comments: { _count: "desc" } }
            : query.sort === "recent"
              ? { lastSeenAt: { sort: "desc", nulls: "last" } }
              : { createdAt: "desc" };

    const allRoles = await listRoles();
    const adminSlugs = allRoles
      .filter((role) => role.permissions.includes("admin.roles.manage"))
      .map((role) => role.slug);
    const moderatorSlugs = allRoles
      .filter(
        (role) => !role.permissions.includes("admin.roles.manage") && role.permissions.some((permission) => permission.startsWith("admin.")),
      )
      .map((role) => role.slug);

    const [users, total, admins, moderators, suspended, newThisWeek] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          ...selfUserSelect,
          banned: true,
          suspendedAt: true,
          suspendedReason: true,
          lastSeenAt: true,
          _count: { select: { posts: true, comments: true, followers: true, reportsFiled: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { role: { in: adminSlugs } } }),
      prisma.user.count({ where: { role: { in: moderatorSlugs } } }),
      prisma.user.count({ where: { banned: true } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

    res.json({
      users: users.map(({ _count, ...user }) => ({
        ...user,
        postCount: _count.posts,
        commentCount: _count.comments,
        followerCount: _count.followers,
        reportCount: _count.reportsFiled,
      })),
      summary: { total, admins, moderators, suspended, newThisWeek },
      meta: { page, limit, total, hasMore: page * limit < total },
    });
  }),
);

adminRouter.get(
  "/users/:id",
  requirePermission("admin.users.view"),
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...selfUserSelect,
        banned: true,
        suspendedAt: true,
        suspendedReason: true,
        lastSeenAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
            followers: true,
            following: true,
            reportsFiled: true,
            bookmarks: true,
          },
        },
      },
    });
    if (!user) throw ApiError.notFound("That member could not be found.");

    const [recentPosts, reportsAgainst, recentActions] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          likeCount: true,
          commentCount: true,
          category: { select: { name: true, slug: true, color: true } },
        },
      }),
      prisma.report.findMany({
        where: { targetType: "USER", targetId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, reason: true, status: true, createdAt: true, details: true },
      }),
      prisma.adminAction.findMany({
        where: { targetType: "USER", targetId: id },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: publicUserSelect } },
      }),
    ]);

    const { _count, ...rest } = user;
    res.json({
      user: {
        ...rest,
        postCount: _count.posts,
        commentCount: _count.comments,
        followerCount: _count.followers,
        followingCount: _count.following,
        reportCount: _count.reportsFiled,
        bookmarkCount: _count.bookmarks,
      },
      recentPosts,
      reportsAgainst,
      recentActions,
    });
  }),
);

adminRouter.patch(
  "/users/:id",
  requirePermission("admin.users.manage"),
  validate(idParams, "params"),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof updateUserSchema>;
    const actorRole = req.userRole!;

    if (id === req.userId) {
      throw ApiError.badRequest("You cannot change your own role or suspension status.");
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        banned: true,
        username: true,
        displayName: true,
        suspendedReason: true,
      },
    });
    if (!target) throw ApiError.notFound("That member could not be found.");

    if (!canManageRole(actorRole, target.role)) {
      throw ApiError.forbidden("You cannot act on a member whose role outranks yours.");
    }

    const roleChanged = data.role !== undefined && data.role !== target.role;
    if (roleChanged) {
      const actorPermissions = await permissionsFor(actorRole);
      if (!actorPermissions.includes("admin.roles.manage")) {
        throw ApiError.forbidden("Your role cannot change member roles.");
      }
      const nextRole = await getRole(data.role);
      if (!nextRole) throw ApiError.badRequest("That role does not exist.");
      if (nextRole.rank >= roleRankSync(actorRole)) {
        throw ApiError.forbidden("You cannot grant a role that outranks yours.");
      }
      const managesRoles = nextRole.permissions.includes("admin.roles.manage");
      if (managesRoles) {
        const holders = await prisma.user.count({
          where: { role: { in: (await listRoles()).filter((r) => r.permissions.includes("admin.roles.manage")).map((r) => r.slug) } },
        });
        if (holders <= 1) {
          throw ApiError.conflict("The community must keep at least one account that can manage roles.");
        }
      }
    }

    if (data.banned === true && !data.reason?.trim()) {
      throw ApiError.badRequest("Add a short reason so the team knows why this member was suspended.");
    }

    const nextBanned = data.banned ?? target.banned;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(roleChanged && data.role ? { role: data.role } : {}),
        ...(data.banned !== undefined
          ? {
              banned: nextBanned,
              suspendedAt: nextBanned ? new Date() : null,
              suspendedReason: nextBanned ? data.reason?.trim() ?? null : null,
            }
          : {}),
      },
      select: { ...selfUserSelect, banned: true, suspendedAt: true, suspendedReason: true },
    });

    const auditEntries: AuditInput[] = [];
    if (roleChanged && data.role) {
      auditEntries.push({
        action: "user.role_changed",
        targetType: "USER",
        targetId: id,
        summary: `Changed @${target.username} from ${target.role} to ${data.role}`,
        metadata: { from: target.role, to: data.role },
      });
    }
    if (data.banned !== undefined && nextBanned !== target.banned) {
      auditEntries.push({
        action: nextBanned ? "user.suspended" : "user.restored",
        targetType: "USER",
        targetId: id,
        summary: nextBanned
          ? `Suspended @${target.username}: ${data.reason?.trim() ?? "no reason given"}`
          : `Restored access for @${target.username}`,
        metadata: nextBanned ? { reason: data.reason?.trim() ?? null } : {},
      });
    }
    for (const entry of auditEntries) await recordAction(req, entry);

    res.json({ user: updated });
  }),
);

adminRouter.delete(
  "/users/:id",
  requirePermission("admin.users.delete"),
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (id === req.userId) throw ApiError.badRequest("Delete your account from Settings instead.");

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, displayName: true, role: true },
    });
    if (!target) throw ApiError.notFound("That member could not be found.");
    if (!canManageRole(req.userRole!, target.role)) {
      throw ApiError.forbidden("You cannot delete an account whose role outranks yours.");
    }
    const targetRole = await getRole(target.role);
    if (targetRole?.permissions.includes("admin.users.delete")) {
      throw ApiError.forbidden("Demote this account's role before deleting it.");
    }

    await prisma.user.delete({ where: { id } });
    await recordAction(req, {
      action: "user.deleted",
      targetType: "USER",
      targetId: id,
      summary: `Deleted the account @${target.username} (${target.displayName})`,
      metadata: { role: target.role },
    });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Reports & moderation
// ---------------------------------------------------------------------------

adminRouter.get(
  "/reports/summary",
  requirePermission("admin.reports.view"),
  asyncHandler(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const [statusRows, reasonRows, targetRows, resolved, resolvedThisWeek] = await Promise.all([
      prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.report.groupBy({
        by: ["reason"],
        where: { status: "OPEN" },
        _count: { _all: true },
        orderBy: { _count: { reason: "desc" } },
        take: 8,
      }),
      prisma.report.groupBy({
        by: ["targetType"],
        where: { status: "OPEN" },
        _count: { _all: true },
      }),
      prisma.report.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        orderBy: { resolvedAt: "desc" },
        take: 400,
      }),
      prisma.report.count({ where: { resolvedAt: { gte: weekAgo } } }),
    ]);

    const status = new Map(statusRows.map((row) => [row.status, row._count._all]));
    const hours = resolved
      .filter((report) => report.resolvedAt)
      .map((report) => (report.resolvedAt!.getTime() - report.createdAt.getTime()) / 3_600_000);

    res.json({
      counts: {
        open: status.get("OPEN") ?? 0,
        resolved: status.get("RESOLVED") ?? 0,
        dismissed: status.get("DISMISSED") ?? 0,
        resolvedThisWeek,
      },
      byReason: reasonRows.map((row) => ({ reason: row.reason, count: row._count._all })),
      byTargetType: targetRows.map((row) => ({
        targetType: row.targetType,
        count: row._count._all,
      })),
      avgResolutionHours: hours.length
        ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10
        : null,
    });
  }),
);

adminRouter.get(
  "/reports",
  requirePermission("admin.reports.view"),
  asyncHandler(async (req, res) => {
    const status =
      req.query.status === "RESOLVED" || req.query.status === "DISMISSED"
        ? req.query.status
        : "OPEN";
    const targetType =
      req.query.targetType === "POST" || req.query.targetType === "COMMENT" || req.query.targetType === "USER"
        ? req.query.targetType
        : undefined;
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20);
    const where: Prisma.ReportWhereInput = { status, ...(targetType ? { targetType } : {}) };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: publicUserSelect },
          resolvedBy: { select: publicUserSelect },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    const postIds = reports.filter((r) => r.targetType === "POST").map((r) => r.targetId);
    const commentIds = reports.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId);
    const userIds = reports.filter((r) => r.targetType === "USER").map((r) => r.targetId);

    const [posts, comments, users] = await Promise.all([
      postIds.length
        ? prisma.post.findMany({
            where: { id: { in: postIds } },
            select: {
              id: true,
              title: true,
              body: true,
              author: { select: { username: true, displayName: true } },
            },
          })
        : [],
      commentIds.length
        ? prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: {
              id: true,
              body: true,
              postId: true,
              deletedAt: true,
              author: { select: { username: true, displayName: true } },
            },
          })
        : [],
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, displayName: true },
          })
        : [],
    ]);

    const postMap = new Map(posts.map((post) => [post.id, post]));
    const commentMap = new Map(comments.map((comment) => [comment.id, comment]));
    const userMap = new Map(users.map((user) => [user.id, user]));

    res.json({
      reports: reports.map((report) => ({
        ...report,
        target:
          report.targetType === "POST"
            ? postMap.get(report.targetId) ?? null
            : report.targetType === "COMMENT"
              ? commentMap.get(report.targetId) ?? null
              : userMap.get(report.targetId) ?? null,
      })),
      meta: { page, limit, total, status, hasMore: page * limit < total },
    });
  }),
);

adminRouter.patch(
  "/reports/:id",
  requirePermission("admin.reports.manage"),
  validate(reportParams, "params"),
  validate(updateReportSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { status, note } = req.body as z.infer<typeof updateReportSchema>;

    const report = await prisma.report.findUnique({
      where: { id },
      select: { id: true, reason: true, targetType: true, targetId: true, status: true },
    });
    if (!report) throw ApiError.notFound("That report could not be found.");

    const updated = await prisma.report.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "OPEN" ? null : new Date(),
        resolvedById: status === "OPEN" ? null : req.userId!,
      },
    });

    await recordAction(req, {
      action: status === "RESOLVED" ? "report.resolved" : "report.dismissed",
      targetType: "REPORT",
      targetId: id,
      summary: `${status === "RESOLVED" ? "Resolved" : "Dismissed"} a ${report.reason.replaceAll("_", " ")} report on ${report.targetType.toLowerCase()} ${report.targetId}`,
      metadata: { reason: report.reason, note: note ?? null },
    });

    res.json({ report: updated });
  }),
);

// ---------------------------------------------------------------------------
// Content moderation
// ---------------------------------------------------------------------------

adminRouter.get(
  "/content",
  requirePermission("admin.content.view"),
  validate(contentQuery, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof contentQuery>;
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit, 20);
    const skip = (page - 1) * limit;

    if (query.type === "COMMENT") {
      const where: Prisma.CommentWhereInput = {
        ...(query.q ? { body: { contains: query.q, mode: "insensitive" } } : {}),
        ...(query.status === "visible"
          ? { deletedAt: null }
          : query.status === "removed"
            ? { deletedAt: { not: null } }
            : {}),
        ...(query.category ? { post: { category: { slug: query.category } } } : {}),
      };

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            body: true,
            likeCount: true,
            replyCount: true,
            createdAt: true,
            deletedAt: true,
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            post: {
              select: {
                id: true,
                title: true,
                category: { select: { name: true, slug: true, color: true } },
              },
            },
          },
        }),
        prisma.comment.count({ where }),
      ]);

      res.json({
        items: comments.map((comment) => ({
          id: comment.id,
          type: "COMMENT" as const,
          body: comment.body,
          likeCount: comment.likeCount,
          replyCount: comment.replyCount,
          createdAt: comment.createdAt,
          removedAt: comment.deletedAt,
          author: comment.author,
          post: comment.post,
        })),
        meta: { page, limit, total, hasMore: page * limit < total },
      });
      return;
    }

    const where: Prisma.PostWhereInput = {
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { body: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          likeCount: true,
          commentCount: true,
          viewCount: true,
          createdAt: true,
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          category: { select: { name: true, slug: true, color: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      items: posts.map((post) => ({
        id: post.id,
        type: "POST" as const,
        title: post.title,
        body: post.body,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        removedAt: null,
        author: post.author,
        category: post.category,
      })),
      meta: { page, limit, total, hasMore: page * limit < total },
    });
  }),
);

adminRouter.delete(
  "/content/:type/:id",
  requirePermission("admin.content.manage"),
  validate(contentParams, "params"),
  asyncHandler(async (req, res) => {
    const type = String(req.params.type);
    const id = String(req.params.id);

    if (type === "COMMENT") {
      const comment = await prisma.comment.findUnique({
        where: { id },
        select: { id: true, body: true, deletedAt: true, authorId: true },
      });
      if (!comment) throw ApiError.notFound("That comment could not be found.");
      if (comment.deletedAt) throw ApiError.badRequest("That comment is already removed.");

      // Soft delete preserves thread structure; the reading UI shows a tombstone.
      await prisma.comment.update({
        where: { id },
        data: { deletedAt: new Date(), body: "" },
      });
      await recordAction(req, {
        action: "content.comment_removed",
        targetType: "COMMENT",
        targetId: id,
        summary: `Removed a comment by ${comment.authorId}`,
        metadata: { preview: comment.body.slice(0, 140) },
      });
      res.status(204).end();
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, title: true, authorId: true },
    });
    if (!post) throw ApiError.notFound("That post could not be found.");

    await prisma.post.delete({ where: { id } });
    await recordAction(req, {
      action: "content.post_deleted",
      targetType: "POST",
      targetId: id,
      summary: `Deleted the post “${post.title ?? "Untitled"}” by ${post.authorId}`,
    });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Rooms, announcements & audit trail
// ---------------------------------------------------------------------------

adminRouter.get(
  "/categories",
  requirePermission("admin.categories.view"),
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json({
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        postCount: _count.posts,
      })),
    });
  }),
);

adminRouter.post(
  "/categories",
  requirePermission("admin.categories.manage"),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof categorySchema>;
    const existing = await prisma.category.findFirst({
      where: { OR: [{ slug: data.slug }, { name: data.name }] },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict("A room with that name or slug already exists.");

    const category = await prisma.category.create({ data });
    await recordAction(req, {
      action: "category.created",
      targetType: "CATEGORY",
      targetId: category.id,
      summary: `Created the room ${category.name}`,
      metadata: { slug: category.slug, kind: category.kind },
    });
    res.status(201).json({ category });
  }),
);

adminRouter.patch(
  "/categories/:id",
  requirePermission("admin.categories.manage"),
  validate(idParams, "params"),
  validate(categoryUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof categoryUpdateSchema>;
    const category = await prisma.category
      .update({ where: { id }, data })
      .catch(() => null);
    if (!category) throw ApiError.notFound("That category could not be found.");

    await recordAction(req, {
      action: "category.updated",
      targetType: "CATEGORY",
      targetId: category.id,
      summary: `Updated the room ${category.name}`,
      metadata: data as Prisma.InputJsonValue,
    });
    res.json({ category });
  }),
);

adminRouter.delete(
  "/categories/:id",
  requirePermission("admin.categories.manage"),
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });
    if (!category) throw ApiError.notFound("That category could not be found.");
    if (category._count.posts > 0) {
      throw ApiError.conflict("Move or delete the posts in this category before removing it.");
    }

    await prisma.category.delete({ where: { id } });
    await recordAction(req, {
      action: "category.deleted",
      targetType: "CATEGORY",
      targetId: id,
      summary: `Deleted the room ${category.name}`,
    });
    res.status(204).end();
  }),
);

adminRouter.post(
  "/announcements",
  requirePermission("admin.announcements.publish"),
  validate(announcementSchema),
  asyncHandler(async (req, res) => {
    const { title, body } = req.body as z.infer<typeof announcementSchema>;

    const category = await prisma.category.findUnique({ where: { slug: "whats-new" } });
    if (!category) throw ApiError.badRequest("The What's New category is missing.");

    const post = await prisma.post.create({
      data: { authorId: req.userId!, categoryId: category.id, title, body },
    });

    const recipients = await prisma.user.findMany({
      where: { banned: false, NOT: { id: req.userId! } },
      select: { id: true },
    });

    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          actorId: req.userId!,
          type: "ANNOUNCEMENT" as const,
          body: title,
          postId: post.id,
        })),
      });
    }

    await recordAction(req, {
      action: "announcement.published",
      targetType: "POST",
      targetId: post.id,
      summary: `Published the announcement “${title}” to ${recipients.length} members`,
    });

    emitToAll("announcement:new", { postId: post.id, title });
    res.status(201).json({ post, notified: recipients.length });
  }),
);

adminRouter.get(
  "/audit",
  requirePermission("admin.audit.view"),
  validate(auditQuery, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof auditQuery>;
    const page = parsePage(query.page);
    const limit = parseLimit(query.limit, 30);

    const where: Prisma.AdminActionWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.q
        ? {
            OR: [
              { summary: { contains: query.q, mode: "insensitive" } },
              { targetId: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [actions, total, kinds] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: publicUserSelect } },
      }),
      prisma.adminAction.count({ where }),
      prisma.adminAction.groupBy({ by: ["action"], _count: { _all: true } }),
    ]);

    res.json({
      actions,
      kinds: kinds
        .map((row) => ({ action: row.action, count: row._count._all }))
        .sort((a, b) => b.count - a.count),
      meta: { page, limit, total, hasMore: page * limit < total },
    });
  }),
);

// ---------------------------------------------------------------------------
// Joke Time scheduling
// ---------------------------------------------------------------------------

const jokeSessionSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
});

const jokeSessionPatchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
});

async function assertNoJokeSessionOverlap(
  opensAt: Date,
  closesAt: Date,
  excludeId?: string,
): Promise<void> {
  if (closesAt <= opensAt) {
    throw ApiError.badRequest("Closing time must be after the opening time.");
  }
  const clash = await prisma.jokeSession.findFirst({
    where: {
      opensAt: { lt: closesAt },
      closesAt: { gt: opensAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, opensAt: true, closesAt: true },
  });
  if (clash) {
    throw ApiError.conflict("That window overlaps another Joke Time session.");
  }
}

function jokeSessionStatusView(session: { opensAt: Date; closesAt: Date }): string {
  const now = Date.now();
  if (now < session.opensAt.getTime()) return "UPCOMING";
  if (now >= session.closesAt.getTime()) return "CLOSED";
  return "OPEN";
}

adminRouter.get(
  "/joke-sessions",
  requirePermission("admin.jokes.view"),
  asyncHandler(async (_req, res) => {
    const sessions = await prisma.jokeSession.findMany({
      orderBy: { opensAt: "desc" },
      include: {
        _count: { select: { jokes: true } },
        createdBy: { select: publicUserSelect },
      },
      take: 100,
    });

    res.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        opensAt: session.opensAt,
        closesAt: session.closesAt,
        createdAt: session.createdAt,
        jokeCount: session._count.jokes,
        status: jokeSessionStatusView(session),
        createdBy: session.createdBy,
      })),
    });
  }),
);

adminRouter.post(
  "/joke-sessions",
  requirePermission("admin.jokes.manage"),
  validate(jokeSessionSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof jokeSessionSchema>;
    await assertNoJokeSessionOverlap(data.opensAt, data.closesAt);

    const session = await prisma.jokeSession.create({
      data: {
        title: data.title?.trim() || "Joke Time",
        opensAt: data.opensAt,
        closesAt: data.closesAt,
        createdById: req.userId!,
      },
    });

    await recordAction(req, {
      action: "jokeSession.create",
      targetType: "jokeSession",
      targetId: session.id,
      summary: `Scheduled “${session.title}” from ${session.opensAt.toISOString()} to ${session.closesAt.toISOString()}.`,
    });

    res.status(201).json({ session: { ...session, status: jokeSessionStatusView(session), jokeCount: 0 } });
  }),
);

adminRouter.patch(
  "/joke-sessions/:id",
  requirePermission("admin.jokes.manage"),
  validate(idParams, "params"),
  validate(jokeSessionPatchSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof jokeSessionPatchSchema>;
    const existing = await prisma.jokeSession.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("That Joke Time session could not be found.");

    const opensAt = data.opensAt ?? existing.opensAt;
    const closesAt = data.closesAt ?? existing.closesAt;
    await assertNoJokeSessionOverlap(opensAt, closesAt, id);

    const session = await prisma.jokeSession.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        opensAt,
        closesAt,
      },
    });

    await recordAction(req, {
      action: "jokeSession.update",
      targetType: "jokeSession",
      targetId: session.id,
      summary: `Rescheduled “${session.title}” to ${session.opensAt.toISOString()} – ${session.closesAt.toISOString()}.`,
    });

    res.json({ session: { ...session, status: jokeSessionStatusView(session) } });
  }),
);

adminRouter.delete(
  "/joke-sessions/:id",
  requirePermission("admin.jokes.manage"),
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const session = await prisma.jokeSession.findUnique({ where: { id } });
    if (!session) throw ApiError.notFound("That Joke Time session could not be found.");

    await prisma.jokeSession.delete({ where: { id } });
    await recordAction(req, {
      action: "jokeSession.delete",
      targetType: "jokeSession",
      targetId: id,
      summary: `Deleted the Joke Time session “${session.title}”.`,
    });

    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Events desk
//
// Most listings arrive from feeds, but the community team also publishes its
// own: music festivals, cinema and theatre runs, socials, travel and hiking
// outings, business conferences and seasonal celebrations. These routes create
// official Event rows (kind EVENT) so they sit beside imported listings and
// inherit the same list, filter and RSVP surfaces.
// ---------------------------------------------------------------------------

function eventSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "event";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function assertEventWindow(start: Date, end: Date | null | undefined): void {
  if (end && end.getTime() < start.getTime()) {
    throw new ApiError(400, "The event cannot end before it starts.", "BAD_EVENT_WINDOW");
  }
}

const adminEventQuery = z.object({
  scope: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  // The desk manages the community team's own listings by default; imported
  // feed rows are only shown when asked for.
  source: z.enum(["curated", "imported", "all"]).default("curated"),
  topic: z.enum(EVENT_TOPIC_VALUES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

const adminEventFields = {
  title: z.string().trim().min(3, "Give the event a title of at least 3 characters").max(120),
  description: z.string().trim().min(10, "Describe the event in at least 10 characters").max(3000),
  topic: z.enum(EVENT_TOPIC_VALUES),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  location: z.string().trim().max(180).nullable().optional(),
  coverUrl: z.string().trim().max(600).nullable().optional(),
  maxAttendees: z.coerce.number().int().min(2).max(100000).nullable().optional(),
};

const createAdminEventSchema = z.object(adminEventFields);

const updateAdminEventSchema = z.object({
  title: adminEventFields.title.optional(),
  description: adminEventFields.description.optional(),
  topic: adminEventFields.topic.optional(),
  startDate: adminEventFields.startDate.optional(),
  endDate: adminEventFields.endDate,
  location: adminEventFields.location,
  coverUrl: adminEventFields.coverUrl,
  maxAttendees: adminEventFields.maxAttendees,
});

const adminEventInclude = {
  creator: { select: publicUserSelect },
  category: { select: { id: true, name: true, slug: true, color: true } },
  place: { select: { id: true, name: true, slug: true, city: true } },
  source: { select: { id: true, key: true, name: true } },
  _count: { select: { rsvps: true } },
} satisfies Prisma.EventInclude;

type AdminEventRecord = Prisma.EventGetPayload<{ include: typeof adminEventInclude }>;

function adminEventView(event: AdminEventRecord) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    topic: event.topic,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate ? event.endDate.toISOString() : null,
    location: event.location,
    coverUrl: event.coverUrl,
    maxAttendees: event.maxAttendees,
    createdAt: event.createdAt.toISOString(),
    attendeeCount: event._count.rsvps,
    creator: event.creator,
    category: event.category,
    place: event.place,
    source: event.source,
  };
}

adminRouter.get(
  "/events",
  requirePermission("admin.events.view"),
  validate(adminEventQuery, "query"),
  asyncHandler(async (req, res) => {
    const { scope, source, topic, limit } = req.query as unknown as z.infer<typeof adminEventQuery>;
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const filters: Prisma.EventWhereInput[] = [{ kind: EventKind.EVENT }];
    if (scope === "upcoming") {
      // Keep something that started in the last couple of hours, and keep
      // multi-day events until they close rather than dropping them on day two.
      filters.push({
        OR: [
          { endDate: { gte: recent } },
          { endDate: null, startDate: { gte: recent } },
        ],
      });
    }
    if (scope === "past") {
      filters.push({
        OR: [
          { endDate: { lt: now } },
          { endDate: null, startDate: { lt: now } },
        ],
      });
    }
    if (source === "curated") filters.push({ sourceId: null });
    if (source === "imported") filters.push({ sourceId: { not: null } });
    if (topic) filters.push({ topic: topic as EventTopic });

    const events = await prisma.event.findMany({
      where: { AND: filters },
      include: adminEventInclude,
      orderBy: { startDate: scope === "past" ? "desc" : "asc" },
      take: limit,
    });

    res.json({ events: events.map(adminEventView) });
  }),
);

adminRouter.post(
  "/events",
  requirePermission("admin.events.manage"),
  validate(createAdminEventSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createAdminEventSchema>;
    assertEventWindow(data.startDate, data.endDate);

    const event = await prisma.event.create({
      data: {
        slug: eventSlug(data.title),
        kind: EventKind.EVENT,
        title: data.title,
        description: data.description,
        topic: data.topic as EventTopic,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        location: data.location?.trim() || null,
        coverUrl: data.coverUrl?.trim() || null,
        maxAttendees: data.maxAttendees ?? null,
        creatorId: req.userId!,
      },
      include: adminEventInclude,
    });

    await recordAction(req, {
      action: "event.create",
      targetType: "event",
      targetId: event.id,
      summary: `Published “${event.title}” (${event.topic}) on ${event.startDate.toISOString()}.`,
    });

    // A newly published listing reaches open tabs immediately; the browser
    // notification is raised by the client when the tab is in the background.
    emitToAll("event:new", {
      id: event.id,
      slug: event.slug,
      title: event.title,
      startDate: event.startDate.toISOString(),
      location: event.location,
      kind: event.kind,
      creatorId: event.creatorId,
    });

    res.status(201).json({ event: adminEventView(event) });
  }),
);

adminRouter.patch(
  "/events/:id",
  requirePermission("admin.events.manage"),
  validate(idParams, "params"),
  validate(updateAdminEventSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof updateAdminEventSchema>;
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("That event could not be found.");

    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
    assertEventWindow(startDate, endDate);

    const event = await prisma.event.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.topic !== undefined ? { topic: data.topic as EventTopic } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
        ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl?.trim() || null } : {}),
        ...(data.maxAttendees !== undefined ? { maxAttendees: data.maxAttendees } : {}),
      },
      include: adminEventInclude,
    });

    await recordAction(req, {
      action: "event.update",
      targetType: "event",
      targetId: event.id,
      summary: `Updated “${event.title}” (${event.topic}) for ${event.startDate.toISOString()}.`,
    });

    res.json({ event: adminEventView(event) });
  }),
);

adminRouter.delete(
  "/events/:id",
  requirePermission("admin.events.manage"),
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!event) throw ApiError.notFound("That event could not be found.");

    await prisma.event.delete({ where: { id } });
    await recordAction(req, {
      action: "event.delete",
      targetType: "event",
      targetId: id,
      summary: `Deleted the event “${event.title}”.`,
    });

    res.status(204).end();
  }),
);
