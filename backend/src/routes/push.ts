import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { prisma } from "../lib/prisma";
import { getVapidPublicKey } from "../lib/push";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";

export const pushRouter = Router();

pushRouter.get(
  "/public-key",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ publicKey: await getVapidPublicKey() });
  }),
);

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

pushRouter.post(
  "/subscribe",
  requireAuth,
  validate(subscribeSchema),
  asyncHandler(async (req, res) => {
    const { endpoint, keys } = req.body as z.infer<typeof subscribeSchema>;

    // Upsert by endpoint: a browser that signs into another account must not
    // leave the previous member's notifications attached to it.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: req.userId!,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
      },
      update: {
        userId: req.userId!,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
        lastUsedAt: new Date(),
      },
    });

    res.status(201).json({ subscribed: true });
  }),
);

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

pushRouter.delete(
  "/subscribe",
  requireAuth,
  validate(unsubscribeSchema),
  asyncHandler(async (req, res) => {
    const { endpoint } = req.body as z.infer<typeof unsubscribeSchema>;
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.userId! },
    });
    res.status(204).end();
  }),
);
