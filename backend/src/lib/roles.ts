import { prisma } from "./prisma";

export interface RoleRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  rank: number;
  system: boolean;
}

/** Ranks used when the database has not been read yet (first millisecond of boot). */
const FALLBACK_RANKS: Record<string, number> = { ADMIN: 100, MODERATOR: 50, USER: 10 };

/**
 * Capabilities granted to each built-in role the first time it is created.
 * After that the database is the authority — editing a role does not get
 * overwritten by this map.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMIN: [
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
  ],
  MODERATOR: [
    "admin.dashboard.view",
    "admin.reports.view",
    "admin.reports.manage",
    "admin.content.view",
    "admin.content.manage",
    "admin.users.view",
    "admin.users.manage",
    "admin.roles.view",
    "admin.categories.view",
  ],
  USER: [],
};

export const DEFAULT_ROLE_RANKS: Record<string, number> = { ADMIN: 100, MODERATOR: 50, USER: 10 };

let cache: Map<string, RoleRecord> | null = null;
let cacheLoadedAt = 0;
let refresh: Promise<void> | null = null;
const TTL_MS = 10_000;

async function load(): Promise<void> {
  const rows = await prisma.roleDefinition.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      permissions: true,
      rank: true,
      system: true,
    },
  });
  cache = new Map(rows.map((row) => [row.slug, row]));
  cacheLoadedAt = Date.now();
}

/** Reloads the role cache. Any concurrent caller shares one query. */
export async function refreshRoles(): Promise<void> {
  refresh ??= load().finally(() => {
    refresh = null;
  });
  await refresh;
}

async function ensureFresh(): Promise<void> {
  if (!cache || Date.now() - cacheLoadedAt > TTL_MS) await refreshRoles();
}

export async function listRoles(): Promise<RoleRecord[]> {
  await ensureFresh();
  return [...(cache?.values() ?? [])].sort((a, b) => b.rank - a.rank);
}

export async function getRole(slug: string | null | undefined): Promise<RoleRecord | null> {
  if (!slug) return null;
  await ensureFresh();
  return cache?.get(slug) ?? null;
}

export async function permissionsForRole(slug: string | null | undefined): Promise<string[]> {
  const role = await getRole(slug);
  return role ? [...role.permissions] : [];
}

export async function roleRank(slug: string | null | undefined): Promise<number> {
  const role = await getRole(slug);
  return role?.rank ?? FALLBACK_RANKS[slug ?? ""] ?? 10;
}

/** Sync variants read only the cache; callers tolerate the built-in fallback. */
export function permissionsForRoleSync(slug: string | null | undefined): string[] {
  const role = slug ? cache?.get(slug) : undefined;
  return role ? [...role.permissions] : [...(slug ? DEFAULT_ROLE_PERMISSIONS[slug] ?? [] : [])];
}

export function roleRankSync(slug: string | null | undefined): number {
  return (slug ? cache?.get(slug)?.rank : undefined) ?? FALLBACK_RANKS[slug ?? ""] ?? 10;
}

/** True when the role holds at least one administrative capability. */
export function isStaffSync(slug: string | null | undefined): boolean {
  return permissionsForRoleSync(slug).some((permission) => permission.startsWith("admin."));
}

export async function isStaffRole(slug: string | null | undefined): Promise<boolean> {
  const role = await getRole(slug);
  if (!role) return false;
  return role.permissions.some((permission) => permission.startsWith("admin."));
}

/**
 * Guarantees the three built-in roles exist. Editing their capabilities later
 * is safe: this never overwrites an existing row, it only creates what is
 * missing, so a dashboard edit is never clobbered by a restart.
 */
export async function ensureBuiltinRoles(): Promise<void> {
  for (const [slug, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const name =
      slug === "ADMIN" ? "Administrator" : slug === "MODERATOR" ? "Moderator" : "Member";
    const description =
      slug === "ADMIN"
        ? "Full access, including role changes, account deletion, room configuration, announcements and the audit trail."
        : slug === "MODERATOR"
          ? "Keeps the community healthy: works the report queue, removes content and suspends members, but cannot change roles or platform configuration."
          : "Reads, posts, comments and messages other members. No admin surfaces.";

    await prisma.roleDefinition.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        description,
        permissions: [...permissions],
        rank: DEFAULT_ROLE_RANKS[slug] ?? 10,
        system: true,
      },
    });
  }
  await refreshRoles();
}
