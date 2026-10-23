import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      /** Slug of the member's RoleDefinition row, e.g. USER, MODERATOR, ADMIN. */
      userRole?: string;
      username?: string;
    }
  }
}

export {};
