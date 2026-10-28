import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { emitToUser } from "./realtime";
import { notificationActorSelect } from "./serialize";

interface NotifyInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  body: string;
  /** In-app destination; the push payload sets its own URL. */
  url?: string | null;
  postId?: string | null;
  conversationId?: string | null;
}

/**
 * Persists a notification and pushes it to any live sockets for the recipient.
 * Notifications about your own actions are skipped (except announcements).
 */
export async function createNotification(input: NotifyInput) {
  if (input.actorId && input.userId === input.actorId && input.type !== "ANNOUNCEMENT") {
    return null;
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        body: input.body,
        url: input.url ?? null,
        postId: input.postId ?? null,
        conversationId: input.conversationId ?? null,
      },
      include: { actor: { select: notificationActorSelect } },
    });

    emitToUser(input.userId, "notification:new", notification);

    const unreadCount = await prisma.notification.count({
      where: { userId: input.userId, readAt: null },
    });
    emitToUser(input.userId, "notifications:unread", { count: unreadCount });

    return notification;
  } catch (error) {
    // Notifications must never break the primary action.
    logger.warn({ err: error }, "Failed to create notification");
    return null;
  }
}
