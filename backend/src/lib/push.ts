import webpush, { type VapidKeys } from "web-push";
import { env } from "../config/env";
import { ApiError } from "./errors";
import { logger } from "./logger";
import { prisma } from "./prisma";

/**
 * Web Push delivery for closed tabs.
 *
 * The VAPID key pair is generated once and stored in `AppSetting`, so a deploy
 * does not need a new secret on the server. Deployments that prefer to manage
 * keys externally can set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY instead.
 */

const VAPID_SETTING = "push.vapid";

export type PushKind = "message" | "event" | "announcement";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  kind: PushKind;
}

interface VapidConfig extends VapidKeys {
  subject: string;
}

interface StoredVapid {
  publicKey?: unknown;
  privateKey?: unknown;
}

let cachedVapid: VapidConfig | null = null;
let vapidLoading: Promise<VapidConfig> | null = null;

function fromEnvironment(): VapidConfig | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env;
  if (!VAPID_PUBLIC_KEY && !VAPID_PRIVATE_KEY) return null;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn(
      "Only one VAPID key is set; falling back to the key pair stored in AppSetting",
    );
    return null;
  }
  return {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

async function readStoredVapid(): Promise<VapidConfig | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: VAPID_SETTING } });
  if (!row) return null;

  let stored: StoredVapid;
  try {
    stored = JSON.parse(row.value) as StoredVapid;
  } catch {
    throw new Error("The stored VAPID configuration is not valid JSON");
  }
  if (typeof stored.publicKey !== "string" || typeof stored.privateKey !== "string") {
    throw new Error("The stored VAPID configuration is missing a key");
  }
  return {
    publicKey: stored.publicKey,
    privateKey: stored.privateKey,
    subject: env.VAPID_SUBJECT,
  };
}

async function loadVapid(): Promise<VapidConfig> {
  if (cachedVapid) return cachedVapid;
  if (vapidLoading) return vapidLoading;

  const pending = (async () => {
    const fromEnv = fromEnvironment();
    if (fromEnv) {
      cachedVapid = fromEnv;
      return fromEnv;
    }

    const stored = await readStoredVapid();
    if (stored) {
      cachedVapid = stored;
      return stored;
    }

    const generated = webpush.generateVAPIDKeys();
    try {
      await prisma.appSetting.create({
        data: { key: VAPID_SETTING, value: JSON.stringify(generated) },
      });
      cachedVapid = { ...generated, subject: env.VAPID_SUBJECT };
    } catch {
      // A second instance may have generated the pair at the same moment.
      const raced = await readStoredVapid();
      if (!raced) throw new Error("Could not save the Web Push key pair");
      cachedVapid = raced;
    }
    return cachedVapid;
  })();

  vapidLoading = pending.finally(() => {
    vapidLoading = null;
  });
  return vapidLoading;
}

/** Public key used by the browser's pushManager.subscribe call. */
export async function getVapidPublicKey(): Promise<string> {
  try {
    return (await loadVapid()).publicKey;
  } catch (error) {
    logger.error({ err: error }, "Could not load the Web Push key pair");
    throw new ApiError(503, "Push notifications are unavailable right now.", "PUSH_UNAVAILABLE");
  }
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function deliver(subscriptions: SubscriptionRow[], payload: PushPayload): Promise<void> {
  if (subscriptions.length === 0) return;

  const vapid = await loadVapid();
  const body = JSON.stringify(payload);
  const options = {
    vapidDetails: {
      subject: vapid.subject,
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
    },
    TTL: 24 * 60 * 60,
    urgency: payload.kind === "message" ? ("high" as const) : ("normal" as const),
    timeout: 10_000,
  };

  // Push services are independent; a small batch keeps one slow endpoint from
  // delaying every other subscriber.
  for (let index = 0; index < subscriptions.length; index += 8) {
    const batch = subscriptions.slice(index, index + 8);
    await Promise.all(
      batch.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
            options,
          );
          await prisma.pushSubscription
            .update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } })
            .catch(() => undefined);
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // The browser dropped the subscription (uninstalled, cleared data,
            // or revoked permission). Remove it so later sends stay cheap.
            await prisma.pushSubscription
              .deleteMany({ where: { id: subscription.id } })
              .catch(() => undefined);
            return;
          }
          logger.warn({ err: error, statusCode }, "Web Push delivery failed");
        }
      }),
    );
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    await deliver(subscriptions, payload);
  } catch (error) {
    logger.warn({ err: error, userId }, "Could not send Web Push to a member");
  }
}

export async function sendPushToAll(
  payload: PushPayload,
  options: { excludeUserId?: string } = {},
): Promise<void> {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        user: { banned: false },
        ...(options.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
      },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    await deliver(subscriptions, payload);
  } catch (error) {
    logger.warn({ err: error }, "Could not broadcast a Web Push notification");
  }
}

export async function pushNewEvent(event: {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  creatorId: string;
}): Promise<void> {
  const place = event.location?.trim();
  await sendPushToAll(
    {
      title: "New event on Addis Gebeta",
      body: `${event.title}${place ? ` · ${place}` : ""}`,
      url: `/events/${event.slug}`,
      tag: `event:${event.id}`,
      kind: "event",
    },
    { excludeUserId: event.creatorId },
  );
}

export async function pushAnnouncement(input: {
  postId: string;
  title: string;
  excludeUserId: string;
}): Promise<void> {
  await sendPushToAll(
    {
      title: "Addis Gebeta · Service update",
      body: input.title,
      url: `/posts/${input.postId}`,
      tag: `announcement:${input.postId}`,
      kind: "announcement",
    },
    { excludeUserId: input.excludeUserId },
  );
}

export async function pushMessage(input: {
  recipientId: string;
  senderName: string;
  preview: string;
  conversationId: string;
}): Promise<void> {
  const preview =
    input.preview.length > 180 ? `${input.preview.slice(0, 177)}…` : input.preview;
  await sendPushToUser(input.recipientId, {
    title: input.senderName,
    body: preview,
    url: `/messages/${input.conversationId}`,
    tag: `message:${input.conversationId}`,
    kind: "message",
  });
}
