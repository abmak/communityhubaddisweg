import { randomUUID } from "node:crypto";
import type { CookieOptions, Response } from "express";
import { cookieSecure, env } from "../config/env";
import { signAuthToken } from "./jwt";

export const TOKEN_COOKIE = "ch_token";
export const CSRF_COOKIE = "ch_csrf";

const maxAge = env.JWT_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: "lax",
  path: "/",
  maxAge,
};

export interface SessionUser {
  id: string;
  username: string;
  role: string;
}

/**
 * Sets an HttpOnly session cookie plus a readable double-submit CSRF token.
 * The client echoes the CSRF cookie in the `x-csrf-token` header for mutations.
 */
export function setAuthCookies(res: Response, user: SessionUser): void {
  const token = signAuthToken({ sub: user.id, role: user.role, username: user.username });
  res.cookie(TOKEN_COOKIE, token, baseOptions);
  res.cookie(CSRF_COOKIE, randomUUID(), {
    ...baseOptions,
    httpOnly: false,
  });
}

export function clearAuthCookies(res: Response): void {
  const options: CookieOptions = { ...baseOptions, maxAge: undefined };
  res.clearCookie(TOKEN_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, options);
}
