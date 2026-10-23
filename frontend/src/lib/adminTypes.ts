import type { Category, Post, Role, User } from "../types";
import type { Permission } from "./rbac";

export interface AdminMe {
  user: Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "role">;
  permissions: Permission[];
}

export interface PeriodDelta {
  current: number;
  previous: number;
}

export interface TrendPoint {
  day: string;
  members: number;
  posts: number;
  comments: number;
  reports: number;
}

export interface Analytics {
  range: number;
  generatedAt: string;
  totals: {
    users: number;
    posts: number;
    comments: number;
    messages: number;
    events: number;
    places: number;
    likes: number;
    bookmarks: number;
    media: number;
    openReports: number;
  };
  deltas: {
    users: PeriodDelta;
    posts: PeriodDelta;
    comments: PeriodDelta;
    reports: PeriodDelta;
  };
  roleBreakdown: Array<{ role: Role; count: number }>;
  series: TrendPoint[];
  engagement: {
    activeContributors: number;
    returningContributors: number;
    returningRate: number;
    postsPerMember: number;
    commentsPerPost: number;
    likesPerPost: number;
    messagesSent: number;
  };
  moderation: {
    open: number;
    resolved: number;
    dismissed: number;
    filedInRange: number;
    resolvedInRange: number;
    avgResolutionHours: number | null;
    byReason: Array<{ reason: string; count: number }>;
    byTarget: Array<{ targetType: string; count: number }>;
    topReporters: Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      count: number;
    }>;
  };
  rooms: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    posts: number;
    comments: number;
    likes: number;
    views: number;
  }>;
  topPosts: Array<{
    id: string;
    title: string | null;
    excerpt: string;
    likeCount: number;
    commentCount: number;
    viewCount: number;
    createdAt: string;
    author: { id: string; username: string; displayName: string; avatarUrl: string | null };
    category: { id: string; name: string; slug: string; color: string };
  }>;
  topContributors: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    posts: number;
    comments: number;
    activity: number;
  }>;
}

export interface AdminMember extends User {
  banned: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  lastSeenAt: string | null;
  postCount: number;
  commentCount: number;
  followerCount: number;
  reportCount: number;
}

export interface MembersResponse {
  users: AdminMember[];
  summary: {
    total: number;
    admins: number;
    moderators: number;
    suspended: number;
    newThisWeek: number;
  };
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface MemberDetailResponse {
  user: AdminMember & { followingCount: number; bookmarkCount: number };
  recentPosts: Array<{
    id: string;
    title: string | null;
    createdAt: string;
    likeCount: number;
    commentCount: number;
    category: { name: string; slug: string; color: string };
  }>;
  reportsAgainst: Array<{
    id: string;
    reason: string;
    status: "OPEN" | "RESOLVED" | "DISMISSED";
    createdAt: string;
    details: string | null;
  }>;
  recentActions: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    actor: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
  }>;
}

export type ReportTarget =
  | (Pick<Post, "id" | "title" | "body"> & { author: { username: string; displayName: string } })
  | {
      id: string;
      body: string;
      postId: string;
      deletedAt?: string | null;
      author: { username: string; displayName: string };
    }
  | { id: string; username: string; displayName: string };

export interface Report {
  id: string;
  reporterId: string;
  reporter: User;
  targetType: "POST" | "COMMENT" | "USER";
  targetId: string;
  reason: string;
  details: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy?: User | null;
  target: ReportTarget | null;
}

export interface ReportsResponse {
  reports: Report[];
  meta: { page: number; limit: number; total: number; status: string; hasMore: boolean };
}

export interface ReportsSummary {
  counts: { open: number; resolved: number; dismissed: number; resolvedThisWeek: number };
  byReason: Array<{ reason: string; count: number }>;
  byTargetType: Array<{ targetType: string; count: number }>;
  avgResolutionHours: number | null;
}

export interface ContentItem {
  id: string;
  type: "POST" | "COMMENT";
  title?: string | null;
  body: string;
  likeCount: number;
  commentCount?: number;
  replyCount?: number;
  viewCount?: number;
  createdAt: string;
  removedAt: string | null;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null };
  category?: { name: string; slug: string; color: string };
  post?: { id: string; title: string | null; category: { name: string; slug: string; color: string } };
}

export interface ContentResponse {
  items: ContentItem[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface AdminAction {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: Pick<User, "id" | "username" | "displayName" | "avatarUrl">;
}

export interface AuditResponse {
  actions: AdminAction[];
  kinds: Array<{ action: string; count: number }>;
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export interface RoleItem {
  id: string;
  slug: string;
  role?: string;
  name: string;
  description: string;
  permissions: Permission[];
  rank: number;
  system: boolean;
  members: number;
}

export interface RolesResponse {
  permissions: Permission[];
  roles: RoleItem[];
}

export interface CategoriesResponse {
  categories: Category[];
}
