import type { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma";
import { isStaffSync } from "../lib/roles";
import { ApiError } from "../lib/errors";
import { TOKEN_COOKIE } from "../lib/cookies";
import { verifyAuthToken } from "../lib/jwt";
import { asyncHandler } from "../lib/async-handler";

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  const cookie = req.cookies?.[TOKEN_COOKIE];
  return typeof cookie === "string" && cookie.length > 0 ? cookie : null;
}

/**
 * Populates req.userId for valid sessions. Invalid/expired tokens fall through
 * as anonymous so public pages still work; protected routes reject explicitly.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, username: true, banned: true, passwordChangedAt: true },
    });
    // Changing a password invalidates sessions issued before the change.
    const sessionStale =
      user?.passwordChangedAt && payload.iat
        ? payload.iat * 1000 < user.passwordChangedAt.getTime()
        : false;
    if (user && !user.banned && !sessionStale) {
      req.userId = user.id;
      req.userRole = user.role;
      req.username = user.username;
    }
  } catch {
    // Ignore invalid sessions here; requireAuth produces the 401.
  }
  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    next(ApiError.unauthorized());
    return;
  }
  next();
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.userId) {
      next(ApiError.unauthorized());
      return;
    }
    if (!req.userRole || !roles.includes(req.userRole)) {
      next(ApiError.forbidden("This area is restricted to community moderators"));
      return;
    }
    next();
  };
}

/**
 * True when the caller's role holds any administrative capability. Custom
 * roles created from the dashboard count, so membership is never checked by
 * hard-coding the two built-in slugs.
 */
export function isModerator(req: Request): boolean {
  return isStaffSync(req.userRole);
}
