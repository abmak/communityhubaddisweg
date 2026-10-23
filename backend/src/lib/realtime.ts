import type { Server } from "socket.io";

let io: Server | null = null;
const connections = new Map<string, number>();

export function setIO(server: Server): void {
  io = server;
}

export function getIO(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  for (const userId of new Set(userIds)) emitToUser(userId, event, payload);
}

export function emitToAll(event: string, payload: unknown): void {
  io?.emit(event, payload);
}

/** Returns true when this was the user's first active connection. */
export function markUserOnline(userId: string): boolean {
  const next = (connections.get(userId) ?? 0) + 1;
  connections.set(userId, next);
  return next === 1;
}

/** Returns true when the user's last connection closed. */
export function markUserOffline(userId: string): boolean {
  const current = connections.get(userId) ?? 0;
  if (current <= 1) {
    connections.delete(userId);
    return current === 1;
  }
  connections.set(userId, current - 1);
  return false;
}

export function isUserOnline(userId: string): boolean {
  return (connections.get(userId) ?? 0) > 0;
}

export interface PresencePayload {
  userId: string;
  online: boolean;
}
