import type { RequestHandler } from "express";
import { ApiError } from "./errors";
import { getRole, permissionsForRole, permissionsForRoleSync, roleRankSync } from "./roles";

/**
 * The single source of truth for the capability vocabulary. Roles themselves
 * live in the database (`RoleDefinition`) so administrators can change what a
 * role may do, or add a brand new role, from the dashboard. Every admin route
 * is guarded with `requirePermission`; the client mirrors this vocabulary to
 * decide which surfaces to render.
 */
export const PERMISSIONS = [
  "admin.dashboard.view",
  "admin.reports.view",
  "admin.reports.manage",
  "admin.content.view",
  "admin.content.manage",
  "admin.users.view",
  "admin.users.manage",
  "admin.roles.view",
  "admin.roles.manage",
  "admin.users.delete",
  "admin.categories.view",
  "admin.categories.manage",
  "admin.announcements.publish",
  "admin.jokes.view",
  "admin.jokes.manage",
  "admin.events.view",
  "admin.events.manage",
  "admin.audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export async function can(
  role: string | null | undefined,
  permission: Permission,
): Promise<boolean> {
  const roleRecord = await getRole(role);
  return Boolean(roleRecord && roleRecord.permissions.includes(permission));
}

export async function permissionsFor(role: string | null | undefined): Promise<Permission[]> {
  const permissions = await permissionsForRole(role);
  return permissions.filter(isPermission);
}

/** Sync read used by middleware paths where the cache is already warm. */
export function canSync(role: string | null | undefined, permission: Permission): boolean {
  return permissionsForRoleSync(role).includes(permission);
}

/**
 * Higher-rank roles may act on lower-rank roles. An administrator (100) can
 * manage everyone; a moderator (50) may manage ordinary members but never a
 * fellow moderator or an administrator; custom roles are placed on the same
 * ladder by their rank.
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  const actorRank = roleRankSync(actorRole);
  const targetRank = roleRankSync(targetRole);
  if (actorRank === targetRank) return false;
  return actorRank > targetRank;
}

export function requirePermission(...required: Permission[]): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      if (!req.userId) throw ApiError.unauthorized();
      const roleRecord = await getRole(req.userRole);
      const missing = required.filter(
        (permission) => !roleRecord?.permissions.includes(permission),
      );
      if (missing.length > 0) {
        throw ApiError.forbidden("Your role does not include permission for this action.");
      }
      next();
    })().catch(next);
  };
}
