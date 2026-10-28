import type { LeaveByReminder } from "@prisma/client";
import { logger } from "./logger";
import { createNotification } from "./notifications";
import { prisma } from "./prisma";
import { sendPushToUser } from "./push";

/**
 * "Leave by" reminders.
 *
 * A member sets one from an event page with their current location. The route
 * and traffic estimate are frozen at that moment, so the scheduler only has to
 * look up rows whose notifyAt has passed and deliver the nudge. It runs in the
 * API process because that is where Web Push and the realtime socket already
 * live; a missed run is harmless, since the row stays due until it is sent.
 */

const CHECK_INTERVAL_MS = 60_000;
// A reminder that comes due while the API was down is still useful for a short
// while. After the event has started it is noise, so the row is retired.
const LATE_GRACE_MS = 15 * 60_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

export interface LeaveByView {
  id: string;
  eventId: string;
  origin: { lat: number; lng: number };
  originLabel: string | null;
  mode: "driving" | "walking";
  leaveAt: string;
  notifyAt: string;
  travelSeconds: number;
  distanceMeters: number;
  notifiedAt: string | null;
}

export function serializeLeaveBy(reminder: LeaveByReminder): LeaveByView {
  return {
    id: reminder.id,
    eventId: reminder.eventId,
    origin: { lat: reminder.originLat, lng: reminder.originLng },
    originLabel: reminder.originLabel,
    mode: reminder.mode === "walking" ? "walking" : "driving",
    leaveAt: reminder.leaveAt.toISOString(),
    notifyAt: reminder.notifyAt.toISOString(),
    travelSeconds: reminder.travelSeconds,
    distanceMeters: reminder.distanceMeters,
    notifiedAt: reminder.notifiedAt?.toISOString() ?? null,
  };
}

/** Send every reminder that is due. Returns how many were delivered. */
export async function runLeaveByReminders(now: Date = new Date()): Promise<number> {
  if (running) return 0;
  running = true;

  try {
    const due = await prisma.leaveByReminder.findMany({
      where: { notifiedAt: null, notifyAt: { lte: now } },
      include: {
        event: {
          select: { id: true, slug: true, title: true, startDate: true, location: true },
        },
      },
      orderBy: { notifyAt: "asc" },
      take: 100,
    });

    let delivered = 0;

    for (const reminder of due) {
      const event = reminder.event;

      // Past the grace window, or already started: retire it quietly.
      if (
        event.startDate.getTime() <= now.getTime() ||
        now.getTime() - reminder.notifyAt.getTime() > LATE_GRACE_MS
      ) {
        await prisma.leaveByReminder
          .update({ where: { id: reminder.id }, data: { notifiedAt: now } })
          .catch(() => undefined);
        continue;
      }

      const leaveIn = Math.round((reminder.leaveAt.getTime() - now.getTime()) / 60_000);
      const tripMinutes = Math.max(1, Math.round(reminder.travelSeconds / 60));
      const mode = reminder.mode === "walking" ? "walk" : "drive";
      const from = reminder.originLabel?.trim() ? ` from ${reminder.originLabel.trim()}` : "";
      const when = leaveIn >= 1 ? `Leave in ${leaveIn} min` : "Leave now";
      const body = `${when} for ${event.title} — about ${tripMinutes} min ${mode}${from}.`;

      await createNotification({
        userId: reminder.userId,
        type: "EVENT_REMINDER",
        body,
        url: `/events/${event.slug}`,
      });

      await sendPushToUser(reminder.userId, {
        title: "Time to leave",
        body,
        url: `/events/${event.slug}`,
        tag: `leave-by:${reminder.id}`,
        kind: "event",
      });

      await prisma.leaveByReminder
        .update({ where: { id: reminder.id }, data: { notifiedAt: now } })
        .catch(() => undefined);
      delivered += 1;
    }

    if (delivered > 0) {
      logger.info({ delivered }, "Sent leave-by reminders");
    }
    return delivered;
  } catch (error) {
    logger.warn({ err: error }, "Leave-by reminder run failed");
    return 0;
  } finally {
    running = false;
  }
}

/** Starts the one-minute reminder clock. */
export function startLeaveByScheduler(): void {
  if (timer) return;

  // Give the API a moment to finish booting, then keep checking. The interval
  // is deliberately short: a "leave in 5 min" notice that arrives late is a
  // missed bus, not a slightly stale feed.
  setTimeout(() => void runLeaveByReminders(), 10_000).unref?.();
  timer = setInterval(() => void runLeaveByReminders(), CHECK_INTERVAL_MS);
  timer.unref?.();
}

export function stopLeaveByScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
