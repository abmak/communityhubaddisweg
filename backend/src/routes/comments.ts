import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { commentInclude, type CommentWithRelations, type SerializedComment } from "../lib/serialize";
import { requireAuth, isModerator } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createNotification } from "../lib/notifications";
import { writeLimiter } from "../lib/rate-limit";

export const commentsRouter = Router();

const MAX_REPLY_DEPTH = 2; // top-level (0) → reply (1) → nested reply (2)

const postParams = z.object({ postId: z.string().min(1) });
const commentParams = z.object({ id: z.string().min(1) });

const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(2000),
  parentId: z.string().min(1).optional(),
});

const updateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comments cannot be empty").max(2000),
});

const reportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "HATE_SPEECH", "MISINFORMATION", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
});

function toNode(
  comment: CommentWithRelations,
  viewerId: string | undefined,
  depth: number,
): SerializedComment {
  const isDeleted = Boolean(comment.deletedAt);
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    body: isDeleted ? "" : comment.body,
    likeCount: comment.likeCount,
    replyCount: comment.replyCount,
    likedByMe: comment.likes.some((like) => like.userId === viewerId),
    isDeleted,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    depth,
    author: isDeleted ? null : comment.author,
    replies: [],
  };
}

function buildThread(
  comments: CommentWithRelations[],
  viewerId: string | undefined,
  sort: "new" | "top",
): SerializedComment[] {
  const nodes = new Map<string, SerializedComment>();
  for (const comment of comments) nodes.set(comment.id, toNode(comment, viewerId, 0));

  const roots: SerializedComment[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parentId ? nodes.get(comment.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  const assignDepth = (node: SerializedComment, depth: number) => {
    node.depth = depth;
    node.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const reply of node.replies) assignDepth(reply, depth + 1);
  };
  for (const root of roots) assignDepth(root, 0);

  roots.sort((a, b) => {
    if (sort === "top" && b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return roots;
}

async function depthOf(commentId: string): Promise<number> {
  let depth = 0;
  let current: string | null = commentId;
  let guard = 0;

  while (current && guard < 20) {
    const row: { parentId: string | null } | null = await prisma.comment.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    if (!row) break;
    if (!row.parentId) return depth;
    depth += 1;
    current = row.parentId;
    guard += 1;
  }
  return depth;
}

// ---------------------------------------------------------------------------
// Comments for a post
// ---------------------------------------------------------------------------

commentsRouter.get(
  "/posts/:postId/comments",
  validate(postParams, "params"),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.postId);
    const sort = req.query.sort === "top" ? "top" : "new";

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw ApiError.notFound("That post could not be found.");

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId },
        include: commentInclude,
        orderBy: { createdAt: "asc" },
        take: 300,
      }),
      prisma.comment.count({ where: { postId } }),
    ]);

    res.json({
      comments: buildThread(comments, req.userId, sort),
      total,
      sort,
      truncated: total > comments.length,
    });
  }),
);

commentsRouter.post(
  "/posts/:postId/comments",
  requireAuth,
  writeLimiter,
  validate(postParams, "params"),
  validate(createCommentSchema),
  asyncHandler(async (req, res) => {
    const postId = String(req.params.postId);
    const { body, parentId } = req.body as z.infer<typeof createCommentSchema>;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, title: true },
    });
    if (!post) throw ApiError.notFound("That post could not be found.");

    let parent: { id: string; postId: string; authorId: string } | null = null;
    if (parentId) {
      parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true, authorId: true },
      });
      if (!parent || parent.postId !== postId) {
        throw ApiError.badRequest("That comment no longer exists.");
      }
      if ((await depthOf(parent.id)) >= MAX_REPLY_DEPTH) {
        throw ApiError.badRequest("This thread has reached its reply depth. Reply to the main comment instead.");
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { postId, authorId: req.userId!, parentId: parent?.id ?? null, body },
      });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      if (parent) {
        await tx.comment.update({ where: { id: parent.id }, data: { replyCount: { increment: 1 } } });
      }
      return tx.comment.findUniqueOrThrow({ where: { id: comment.id }, include: commentInclude });
    });

    await createNotification({
      userId: parent ? parent.authorId : post.authorId,
      actorId: req.userId!,
      type: parent ? "REPLY" : "COMMENT",
      body: parent ? "replied to your comment." : "commented on your post.",
      postId,
    });

    res.status(201).json({
      comment: { ...toNode(created, req.userId, parent ? (await depthOf(parent.id)) + 1 : 0), replies: [] },
    });
  }),
);

// ---------------------------------------------------------------------------
// Individual comments
// ---------------------------------------------------------------------------

commentsRouter.patch(
  "/comments/:id",
  requireAuth,
  writeLimiter,
  validate(commentParams, "params"),
  validate(updateCommentSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const body = String((req.body as z.infer<typeof updateCommentSchema>).body);

    const comment = await prisma.comment.findUnique({ where: { id }, select: { authorId: true, deletedAt: true } });
    if (!comment) throw ApiError.notFound("That comment could not be found.");
    if (comment.authorId !== req.userId) throw ApiError.forbidden("You can only edit your own comments.");
    if (comment.deletedAt) throw ApiError.badRequest("This comment has been deleted.");

    const updated = await prisma.comment.update({
      where: { id },
      data: { body },
      include: commentInclude,
    });
    res.json({ comment: toNode(updated, req.userId, 0) });
  }),
);

commentsRouter.delete(
  "/comments/:id",
  requireAuth,
  writeLimiter,
  validate(commentParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { authorId: true, deletedAt: true },
    });
    if (!comment) throw ApiError.notFound("That comment could not be found.");
    if (comment.authorId !== req.userId && !isModerator(req)) throw ApiError.forbidden();

    // Soft delete preserves thread structure; the UI renders a tombstone.
    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date(), body: "" },
    });
    res.status(204).end();
  }),
);

commentsRouter.post(
  "/comments/:id/like",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { id: true, authorId: true, postId: true, deletedAt: true },
    });
    if (!comment || comment.deletedAt) throw ApiError.notFound("That comment could not be found.");

    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId: id, userId: req.userId! } },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.commentLike.create({ data: { commentId: id, userId: req.userId! } }),
        prisma.comment.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
      ]);
      await createNotification({
        userId: comment.authorId,
        actorId: req.userId!,
        type: "COMMENT_LIKE",
        body: "liked your comment.",
        postId: comment.postId,
      });
    }

    const likeCount = await prisma.commentLike.count({ where: { commentId: id } });
    res.json({ liked: true, likeCount });
  }),
);

commentsRouter.delete(
  "/comments/:id/like",
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId: id, userId: req.userId! } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.commentLike.delete({
          where: { commentId_userId: { commentId: id, userId: req.userId! } },
        }),
        prisma.comment.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
    }
    const likeCount = await prisma.commentLike.count({ where: { commentId: id } });
    res.json({ liked: false, likeCount });
  }),
);

commentsRouter.post(
  "/comments/:id/report",
  requireAuth,
  writeLimiter,
  validate(commentParams, "params"),
  validate(reportSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const data = req.body as z.infer<typeof reportSchema>;
    const comment = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
    if (!comment) throw ApiError.notFound("That comment could not be found.");

    const existing = await prisma.report.findFirst({
      where: { reporterId: req.userId!, targetType: "COMMENT", targetId: id, status: "OPEN" },
      select: { id: true },
    });
    if (existing) throw ApiError.conflict("You have already reported this comment.");

    await prisma.report.create({
      data: {
        reporterId: req.userId!,
        targetType: "COMMENT",
        targetId: id,
        reason: data.reason,
        details: data.details || null,
      },
    });
    res.status(201).json({ ok: true, message: "Thanks — a moderator will take a look." });
  }),
);
