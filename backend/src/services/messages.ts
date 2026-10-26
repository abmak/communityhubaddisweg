import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { emitToUser, isUserOnline } from "../lib/realtime";
import { createNotification } from "../lib/notifications";
import { pushMessage } from "../lib/push";

export const conversationUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  showPresence: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

export const messageInclude = {
  sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  media: { orderBy: { createdAt: "asc" } },
  replyTo: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      senderId: true,
      sender: { select: { id: true, username: true, displayName: true } },
    },
  },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

const conversationInclude = {
  user1: { select: conversationUserSelect },
  user2: { select: conversationUserSelect },
} satisfies Prisma.ConversationInclude;

export type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

export function normalizePair(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

export function otherParticipant(conversation: { user1Id: string; user2Id: string }, userId: string): string {
  return conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
}

export async function getConversationForUser(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: conversationInclude,
  });
  if (!conversation) throw ApiError.notFound("That conversation could not be found.");
  return conversation;
}

export async function openConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) {
    throw ApiError.badRequest("You cannot start a conversation with yourself.");
  }

  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, username: true, displayName: true, avatarUrl: true, showPresence: true, lastSeenAt: true, banned: true },
  });
  if (!other || other.banned) throw ApiError.notFound("That member could not be found.");

  const [user1Id, user2Id] = normalizePair(userId, otherUserId);

  const conversation = await prisma.conversation.upsert({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    create: { user1Id, user2Id },
    update: {},
    include: conversationInclude,
  });

  const otherUser = conversation.user1.id === userId ? conversation.user2 : conversation.user1;
  return {
    conversation,
    otherUser: {
      ...otherUser,
      online: otherUser.showPresence ? isUserOnline(otherUser.id) : false,
    },
  };
}

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    orderBy: { lastMessageAt: "desc" },
    include: {
      ...conversationInclude,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: messageInclude,
      },
    },
  });

  const conversationIds = conversations.map((conversation) => conversation.id);
  const unreadGroups = conversationIds.length
    ? await prisma.message.groupBy({
        by: ["conversationId"],
        where: {
          conversationId: { in: conversationIds },
          senderId: { not: userId },
          readAt: null,
        },
        _count: { _all: true },
      })
    : [];
  const unreadByConversation = new Map(
    unreadGroups.map((group) => [group.conversationId, group._count._all]),
  );

  return conversations.map((conversation) => {
    const otherUser = conversation.user1.id === userId ? conversation.user2 : conversation.user1;
    return {
      id: conversation.id,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      otherUser: {
        ...otherUser,
        online: otherUser.showPresence ? isUserOnline(otherUser.id) : false,
      },
      lastMessage: conversation.messages[0] ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    };
  });
}

interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  body?: string | null;
  mediaIds?: string[];
  replyToId?: string | null;
}

export async function createMessage({
  conversationId,
  senderId,
  body,
  mediaIds = [],
  replyToId,
}: CreateMessageInput): Promise<MessageRow> {
  const conversation = await getConversationForUser(conversationId, senderId);
  const recipientId = otherParticipant(conversation, senderId);
  const trimmedBody = body?.trim() ?? "";

  if (!trimmedBody && mediaIds.length === 0) {
    throw ApiError.badRequest("Write a message or attach something first.");
  }
  if (trimmedBody.length > 4000) {
    throw ApiError.badRequest("Messages can be up to 4,000 characters.");
  }

  if (replyToId) {
    const parent = await prisma.message.findFirst({
      where: { id: replyToId, conversationId },
      select: { id: true },
    });
    if (!parent) throw ApiError.badRequest("The message you are replying to no longer exists.");
  }

  if (mediaIds.length > 0) {
    if (mediaIds.length > 6) throw ApiError.badRequest("You can attach up to 6 files.");
    const media = await prisma.media.findMany({
      where: { id: { in: mediaIds }, ownerId: senderId, messageId: null },
      select: { id: true, kind: true },
    });
    if (media.length !== mediaIds.length) {
      throw ApiError.badRequest("Some attachments are invalid or already used.");
    }
    if (media.filter((item) => item.kind === "AUDIO").length > 1) {
      throw ApiError.badRequest("Only one voice message can be attached at a time.");
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        body: trimmedBody || null,
        replyToId: replyToId || null,
      },
    });

    if (mediaIds.length > 0) {
      await tx.media.updateMany({
        where: { id: { in: mediaIds }, ownerId: senderId },
        data: { messageId: created.id },
      });
    }

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: created.createdAt },
    });

    return tx.message.findUniqueOrThrow({ where: { id: created.id }, include: messageInclude });
  });

  // Both participants' open tabs get the new message immediately.
  emitToUser(senderId, "message:new", message);
  emitToUser(recipientId, "message:new", message);
  emitToUser(recipientId, "conversation:updated", { conversationId, lastMessageAt: message.createdAt });

  // Web Push reaches devices whose tab is closed. A focused tab receives the
  // payload through the service worker and shows an in-app toast instead.
  const preview = trimmedBody
    ? trimmedBody.length > 160
      ? `${trimmedBody.slice(0, 157)}…`
      : trimmedBody
    : message.media.some((item) => item.kind === "AUDIO")
      ? "Sent you a voice message."
      : message.media.length > 0
        ? "Sent you a photo."
        : "Sent you a message.";
  void pushMessage({
    recipientId,
    senderName: message.sender.displayName,
    preview,
    conversationId,
  });

  if (!isUserOnline(recipientId)) {
    await createNotification({
      userId: recipientId,
      actorId: senderId,
      type: "MESSAGE",
      body: trimmedBody ? `sent you a message: “${trimmedBody.slice(0, 60)}”` : "sent you a message.",
      conversationId,
    });
  }

  return message;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const conversation = await getConversationForUser(conversationId, userId);
  const recipientId = otherParticipant(conversation, userId);
  const now = new Date();

  const result = await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: now },
  });

  if (result.count > 0) {
    emitToUser(recipientId, "messages:read", {
      conversationId,
      readerId: userId,
      readAt: now.toISOString(),
    });
  }

  return { conversation, updated: result.count };
}

export async function unreadMessageCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      conversation: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    },
  });
}
