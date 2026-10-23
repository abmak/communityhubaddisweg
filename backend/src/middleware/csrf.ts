import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { allowedOrigins } from "../config/env";
import { ApiError } from "../lib/errors";
import { CSRF_COOKIE, TOKEN_COOKIE } from "../lib/cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reject cross-site origins for state-changing requests. */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next(); // Non-browser clients (curl, mobile) and same-origin form posts.

  if (allowedOrigins.includes(origin)) return next();

  try {
    // Same-origin deployments behind a reverse proxy (Nginx) are always allowed.
    if (new URL(origin).host === req.get("host")) return next();
  } catch {
    // fall through
  }

  next(new ApiError(403, "This request came from an untrusted origin", "BAD_ORIGIN"));
}

/**
 * Double-submit CSRF check. Only applies to cookie-authenticated mutations;
 * Bearer-token requests are not vulnerable to browser CSRF.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();

  const hasAuthCookie = Boolean(req.cookies?.[TOKEN_COOKIE]);
  const usesBearer = req.headers.authorization?.startsWith("Bearer ");
  if (!hasAuthCookie || usesBearer) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get("x-csrf-token");

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    cookieToken.length === 0 ||
    cookieToken.length !== headerToken.length ||
    !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    next(new ApiError(403, "Your security token expired. Refresh the page and try again.", "CSRF_FAILED"));
    return;
  }

  next();
}
