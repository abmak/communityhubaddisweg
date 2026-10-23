import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { allowedOrigins } from "./config/env";
import { verifyAuthToken } from "./lib/jwt";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import {
  markUserOffline,
  markUserOnline,
  setIO,
  emitToUser,
  isUserOnline,
} from "./lib/realtime";
import { createMessage, markConversationRead, otherParticipant } from "./services/messages";
import { getConversationForUser } from "./services/messages";
import { unreadMessageCount } from "./services/messages";

const conversationPayload = z.object({ conversationId: z.string().min(1) });

const sendPayload = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().max(4000).optional(),
  mediaIds: z.array(z.string().min(1)).max(6).optional(),
  replyToId: z.string().min(1).nullable().optional(),
});

interface SocketData {
  userId: string;
  username: string;
  displayName: string;
  showPresence: boolean;
  messageWindow: number[];
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    maxHttpBufferSize: 1e6,
    pingTimeout: 25_000,
  });

  setIO(io);

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const authToken =
        typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : undefined;
      const token = authToken && authToken !== "cookie" ? authToken : cookies.ch_token;

      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAuthToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          displayName: true,
          banned: true,
          showPresence: true,
          passwordChangedAt: true,
        },
      });

      if (!user || user.banned) return next(new Error("Unauthorized"));
      if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
        return next(new Error("Unauthorized"));
      }

      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.displayName = user.displayName;
      socket.data.showPresence = user.showPresence;
      socket.data.messageWindow = [];
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;
    socket.join(`user:${data.userId}`);

    const cameOnline = markUserOnline(data.userId);
    if (cameOnline && data.showPresence) {
      io.emit("presence:update", { userId: data.userId, online: true });
    }

    socket.on("message:send", async (raw: unknown, ack?: (response: unknown) => void) => {
      const respond = typeof ack === "function" ? ack : () => undefined;
      try {
        const parsed = sendPayload.safeParse(raw);
        if (!parsed.success) {
          respond({ ok: false, error: "That message could not be sent." });
          return;
        }

        const now = Date.now();
        data.messageWindow = data.messageWindow.filter((timestamp) => now - timestamp < 10_000);
        if (data.messageWindow.length >= 20) {
          respond({ ok: false, error: "You're sending messages too quickly. Slow down a little." });
          return;
        }
        data.messageWindow.push(now);

        const message = await createMessage({
          conversationId: parsed.data.conversationId,
          senderId: data.userId,
          body: parsed.data.body,
          mediaIds: parsed.data.mediaIds,
          replyToId: parsed.data.replyToId ?? null,
        });

        respond({ ok: true, message });
      } catch (error) {
        logger.warn({ err: error }, "Socket message send failed");
        respond({
          ok: false,
          error: error instanceof Error ? error.message : "Message could not be sent.",
        });
      }
    });

    socket.on("typing:start", async (raw: unknown) => {
      try {
        const parsed = conversationPayload.safeParse(raw);
        if (!parsed.success) return;
        const conversation = await getConversationForUser(parsed.data.conversationId, data.userId);
        emitToUser(otherParticipant(conversation, data.userId), "typing:update", {
          conversationId: conversation.id,
          userId: data.userId,
          displayName: data.displayName,
          typing: true,
        });
      } catch {
        // Ignore typing events for conversations the user cannot access.
      }
    });

    socket.on("typing:stop", async (raw: unknown) => {
      try {
        const parsed = conversationPayload.safeParse(raw);
        if (!parsed.success) return;
        const conversation = await getConversationForUser(parsed.data.conversationId, data.userId);
        emitToUser(otherParticipant(conversation, data.userId), "typing:update", {
          conversationId: conversation.id,
          userId: data.userId,
          displayName: data.displayName,
          typing: false,
        });
      } catch {
        // Ignore.
      }
    });

    socket.on("conversation:read", async (raw: unknown) => {
      try {
        const parsed = conversationPayload.safeParse(raw);
        if (!parsed.success) return;
        await markConversationRead(parsed.data.conversationId, data.userId);
        const count = await unreadMessageCount(data.userId);
        emitToUser(data.userId, "messages:unread", { count });
      } catch {
        // Ignore.
      }
    });

    socket.on("presence:query", (raw: unknown) => {
      const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string").slice(0, 50) : [];
      socket.emit(
        "presence:state",
        ids.map((id) => ({ userId: id, online: isUserOnline(id) })),
      );
    });

    socket.on("disconnect", async () => {
      const wentOffline = markUserOffline(data.userId);
      if (!wentOffline) return;

      if (data.showPresence) {
        io.emit("presence:update", { userId: data.userId, online: false });
      }
      await prisma.user
        .update({ where: { id: data.userId }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    });
  });

  return io;
}
