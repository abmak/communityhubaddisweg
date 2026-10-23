import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { parseLimit } from "../lib/pagination";
import { notificationActorSelect } from "../lib/serialize";
import { emitToUser } from "../lib/realtime";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({
      where: { userId: req.userId!, readAt: null },
    });
    res.json({ count });
  }),
);

notificationsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, 20);
    const unreadOnly = req.query.unreadOnly === "true";
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId!, ...(unreadOnly ? { readAt: null } : {}) },
      include: { actor: { select: notificationActorSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = notifications.length > limit;
    const visible = hasMore ? notifications.slice(0, limit) : notifications;
    const unreadCount = await prisma.notification.count({
      where: { userId: req.userId!, readAt: null },
    });

    res.json({
      notifications: visible,
      unreadCount,
      nextCursor: hasMore ? visible[visible.length - 1]?.id ?? null : null,
    });
  }),
);

notificationsRouter.post(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.userId!, readAt: null },
      data: { readAt: new Date() },
    });
    emitToUser(req.userId!, "notifications:unread", { count: 0 });
    res.json({ ok: true, unreadCount: 0 });
  }),
);

notificationsRouter.post(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!notification) throw ApiError.notFound("That notification could not be found.");
    if (notification.userId !== req.userId) throw ApiError.forbidden();

    await prisma.notification.updateMany({ where: { id }, data: { readAt: new Date() } });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.userId!, readAt: null },
    });
    emitToUser(req.userId!, "notifications:unread", { count: unreadCount });
    res.json({ ok: true, unreadCount });
  }),
);

notificationsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const deleted = await prisma.notification.deleteMany({
      where: { id, userId: req.userId! },
    });
    if (deleted.count === 0) throw ApiError.notFound("That notification could not be found.");
    const unreadCount = await prisma.notification.count({
      where: { userId: req.userId!, readAt: null },
    });
    emitToUser(req.userId!, "notifications:unread", { count: unreadCount });
    res.status(204).end();
  }),
);
