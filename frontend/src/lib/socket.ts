import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "./api";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (!socket) {
    socket = io(API_ORIGIN || window.location.origin, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
