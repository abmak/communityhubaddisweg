import type { Role } from "../types";

/**
 * Mirrors `backend/src/lib/rbac.ts`. The server is the authority; this copy only
 * decides which controls to render so moderators are not shown actions they
 * cannot complete.
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

const MODERATOR_PERMISSIONS: Permission[] = [
  "admin.dashboard.view",
  "admin.reports.view",
  "admin.reports.manage",
  "admin.content.view",
  "admin.content.manage",
  "admin.users.view",
  "admin.users.manage",
  "admin.roles.view",
  "admin.categories.view",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: [],
  MODERATOR: MODERATOR_PERMISSIONS,
  ADMIN: PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = {
  USER: "Member",
  MODERATOR: "Moderator",
  ADMIN: "Administrator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  USER: "Reads, posts, comments and messages other members. No admin surfaces.",
  MODERATOR:
    "Keeps the community healthy: works the report queue, removes content and suspends members, but cannot change roles or platform configuration.",
  ADMIN:
    "Full access, including role changes, account deletion, room configuration, announcements and the audit trail.",
};

export interface PermissionInfo {
  id: Permission;
  label: string;
  description: string;
}

export const PERMISSION_GROUPS: Array<{ label: string; permissions: PermissionInfo[] }> = [
  {
    label: "Insights",
    permissions: [
      {
        id: "admin.dashboard.view",
        label: "View the dashboard",
        description: "Open the admin area and read community KPIs, trends and reports.",
      },
    ],
  },
  {
    label: "Moderation",
    permissions: [
      {
        id: "admin.reports.view",
        label: "Read the report queue",
        description: "See reports about posts, comments and members.",
      },
      {
        id: "admin.reports.manage",
        label: "Resolve reports",
        description: "Resolve or dismiss a report and record the outcome.",
      },
      {
        id: "admin.content.view",
        label: "Browse content",
        description: "Search posts and comments across the community.",
      },
      {
        id: "admin.content.manage",
        label: "Remove content",
        description: "Delete a post or remove a comment from public view.",
      },
    ],
  },
  {
    label: "People",
    permissions: [
      {
        id: "admin.users.view",
        label: "Read member records",
        description: "Search members and open their activity, moderation history and account details.",
      },
      {
        id: "admin.users.manage",
        label: "Suspend and restore members",
        description: "Suspend an ordinary member with a reason, or restore their access.",
      },
      {
        id: "admin.roles.view",
        label: "Read role definitions",
        description: "See which capabilities each role carries.",
      },
      {
        id: "admin.roles.manage",
        label: "Change member roles",
        description: "Promote or demote members, including granting administrator access.",
      },
      {
        id: "admin.users.delete",
        label: "Delete accounts",
        description: "Permanently delete a non-administrator account and all of its content.",
      },
    ],
  },
  {
    label: "Platform",
    permissions: [
      {
        id: "admin.categories.view",
        label: "Read room configuration",
        description: "See every room, its type and post volume.",
      },
      {
        id: "admin.categories.manage",
        label: "Manage rooms",
        description: "Create and delete community rooms.",
      },
      {
        id: "admin.announcements.publish",
        label: "Publish announcements",
        description: "Broadcast a post to What's New and notify every member.",
      },
      {
        id: "admin.jokes.view",
        label: "Read Joke Time sessions",
        description: "See the scheduled joke windows and the jokes shared in them.",
      },
      {
        id: "admin.jokes.manage",
        label: "Schedule Joke Time",
        description: "Create, reschedule and close the community joke sessions.",
      },
      {
        id: "admin.events.view",
        label: "Read event sources",
        description: "See which online feeds post events automatically and when they last synced.",
      },
      {
        id: "admin.events.manage",
        label: "Manage event sources",
        description: "Add, enable, pause and sync the online sources that publish events.",
      },
      {
        id: "admin.audit.view",
        label: "Read the audit trail",
        description: "Review every administrative action, who took it and why.",
      },
    ],
  },
];

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}

export function permissionLabel(permission: string): string {
  for (const group of PERMISSION_GROUPS) {
    const match = group.permissions.find((entry) => entry.id === permission);
    if (match) return match.label;
  }
  return permission;
}
