import { prisma } from "./prisma";

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const [notifications, messages] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        conversation: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      },
    }),
  ]);

  return { notifications, messages };
}
