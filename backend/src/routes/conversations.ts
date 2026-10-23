import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { parseLimit } from "../lib/pagination";
import {
  createMessage,
  getConversationForUser,
  listConversations,
  markConversationRead,
  messageInclude,
  openConversation,
  otherParticipant,
  unreadMessageCount,
} from "../services/messages";
import { emitToUser } from "../lib/realtime";
import { removeUploads } from "../lib/storage";
import { writeLimiter } from "../lib/rate-limit";

export const conversationsRouter = Router();
export const messagesRouter = Router();

const idParams = z.object({ id: z.string().min(1) });

const startSchema = z.object({ userId: z.string().min(1) });

const sendSchema = z
  .object({
    body: z.string().trim().max(4000).optional(),
    mediaIds: z.array(z.string().min(1)).max(6).optional(),
    replyToId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Boolean(data.body?.trim()) || (data.mediaIds?.length ?? 0) > 0, {
    message: "Write a message or attach something",
    path: ["body"],
  });

const editSchema = z.object({
  body: z.string().trim().min(1, "Messages cannot be empty").max(4000),
});

conversationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversations = await listConversations(req.userId!);
    res.json({ conversations });
  }),
);

conversationsRouter.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await unreadMessageCount(req.userId!);
    res.json({ count });
  }),
);

conversationsRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate(startSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.body as z.infer<typeof startSchema>;
    const { conversation, otherUser } = await openConversation(req.userId!, userId);
    res.status(201).json({ conversation: { ...conversation, otherUser } });
  }),
);

conversationsRouter.get(
  "/:id",
  requireAuth,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const conversation = await getConversationForUser(String(req.params.id), req.userId!);
    const otherUser = conversation.user1.id === req.userId ? conversation.user2 : conversation.user1;
    res.json({ conversation, otherUser });
  }),
);

conversationsRouter.get(
  "/:id/messages",
  requireAuth,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const conversationId = String(req.params.id);
    await getConversationForUser(conversationId, req.userId!);

    const limit = parseLimit(req.query.limit, 30, 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(q ? { body: { contains: q, mode: "insensitive" } } : {}),
      },
      include: messageInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const visible = hasMore ? messages.slice(0, limit) : messages;
    const ordered = visible.slice().reverse();

    // Opening a conversation clears unread messages and sends a read receipt.
    if (!cursor && !q) await markConversationRead(conversationId, req.userId!);

    const unreadCount = await unreadMessageCount(req.userId!);
    res.json({
      messages: ordered,
      hasMore,
      nextCursor: hasMore ? ordered[0]?.id ?? null : null,
      unreadCount,
    });
  }),
);

conversationsRouter.post(
  "/:id/messages",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const conversationId = String(req.params.id);
    const data = req.body as z.infer<typeof sendSchema>;

    const message = await createMessage({
      conversationId,
      senderId: req.userId!,
      body: data.body,
      mediaIds: data.mediaIds,
      replyToId: data.replyToId ?? null,
    });

    res.status(201).json({ message });
  }),
);

conversationsRouter.post(
  "/:id/read",
  requireAuth,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { updated } = await markConversationRead(String(req.params.id), req.userId!);
    const count = await unreadMessageCount(req.userId!);
    res.json({ ok: true, updated, unreadCount: count });
  }),
);

// ---------------------------------------------------------------------------
// Individual messages (mounted at /api/messages)
// ---------------------------------------------------------------------------

messagesRouter.patch(
  "/messages/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  validate(editSchema),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { body } = req.body as z.infer<typeof editSchema>;

    const message = await prisma.message.findUnique({
      where: { id },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        deletedAt: true,
        conversation: { select: { user1Id: true, user2Id: true } },
      },
    });
    if (!message) throw ApiError.notFound("That message could not be found.");
    if (message.senderId !== req.userId) throw ApiError.forbidden("You can only edit your own messages.");
    if (message.deletedAt) throw ApiError.badRequest("This message was deleted.");

    const updated = await prisma.message.update({
      where: { id },
      data: { body, editedAt: new Date() },
      include: messageInclude,
    });

    const recipientId = otherParticipant(message.conversation, req.userId!);
    emitToUser(req.userId!, "message:updated", updated);
    emitToUser(recipientId, "message:updated", updated);

    res.json({ message: updated });
  }),
);

messagesRouter.delete(
  "/messages/:id",
  requireAuth,
  writeLimiter,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        media: { select: { id: true, url: true, thumbnailUrl: true } },
        conversation: { select: { user1Id: true, user2Id: true } },
      },
    });
    if (!message) throw ApiError.notFound("That message could not be found.");
    if (message.senderId !== req.userId) throw ApiError.forbidden("You can only delete your own messages.");
    if (message.deletedAt) {
      res.status(204).end();
      return;
    }

    const recipientId = otherParticipant(message.conversation, req.userId!);

    await prisma.$transaction([
      prisma.media.deleteMany({ where: { messageId: id } }),
      prisma.message.update({
        where: { id },
        data: { deletedAt: new Date(), body: null },
      }),
    ]);

    await removeUploads(message.media.flatMap((item) => [item.url, item.thumbnailUrl]));

    emitToUser(req.userId!, "message:deleted", { id, conversationId: message.conversationId });
    if (recipientId) {
      emitToUser(recipientId, "message:deleted", { id, conversationId: message.conversationId });
    }

    res.status(204).end();
  }),
);
