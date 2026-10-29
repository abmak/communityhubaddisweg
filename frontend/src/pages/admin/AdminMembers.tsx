import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Eye,
  MessageCircle,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useDebounced, useQuery } from "../../hooks/useApi";
import { useAuth } from "../../store/auth";
import { useUI } from "../../store/ui";
import { cn, formatDate, formatDateTime, timeAgo } from "../../lib/utils";
import { ROLE_LABELS } from "../../lib/rbac";
import type { AdminMember, MemberDetailResponse, MembersResponse } from "../../lib/adminTypes";
import { tt } from "../../lib/i18n";
import { Avatar, Badge, ConfirmDialog, Dropdown, EmptyState, Modal, PageLoader, Spinner } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader, MiniStat, Panel, StatCard } from "./parts";

const ROLE_OPTIONS = ["ADMIN", "MODERATOR", "USER"] as const;
const STATUS_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
] as const;
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "recent", label: "Recently seen" },
  { value: "posts", label: "Most posts" },
  { value: "comments", label: "Most comments" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number];
type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function roleTone(role: string): "danger" | "brand" | "neutral" {
  return role === "ADMIN" ? "danger" : role === "MODERATOR" ? "brand" : "neutral";
}

export function AdminMembers() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.users.manage");
  const canManageRoles = permissions.includes("admin.roles.manage");
  const canDelete = permissions.includes("admin.users.delete");
  const currentUser = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);

  const [term, setTerm] = useState("");
  const [role, setRole] = useState<RoleValue | "">("");
  const [status, setStatus] = useState<StatusValue>("all");
  const [sort, setSort] = useState<SortValue>("newest");
  const [page, setPage] = useState(1);
  const q = useDebounced(term, 350);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminMember | null>(null);
  const [nextRole, setNextRole] = useState<RoleValue>("USER");
  const [suspendTarget, setSuspendTarget] = useState<AdminMember | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<AdminMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMember | null>(null);
  const [busy, setBusy] = useState(false);

  const query = useQuery<MembersResponse>(
    `/api/admin/users?page=${page}&limit=20&status=${status}&sort=${sort}` +
      `${q ? `&q=${encodeURIComponent(q)}` : ""}${role ? `&role=${role}` : ""}`,
  );

  useEffect(() => {
    setPage(1);
  }, [q, role, status, sort]);

  const applyPatch = async (member: AdminMember, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api.patch(`/api/admin/users/${member.id}`, body);
      pushToast(message, { tone: "success" });
      setRoleTarget(null);
      setSuspendTarget(null);
      setRestoreTarget(null);
      setSuspendReason("");
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submitRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!roleTarget) return;
    await applyPatch(roleTarget, { role: nextRole }, `${roleTarget.displayName} is now ${ROLE_LABELS[nextRole].toLowerCase()}.`);
  };

  const submitSuspend = async (event: FormEvent) => {
    event.preventDefault();
    if (!suspendTarget) return;
    await applyPatch(
      suspendTarget,
      { banned: true, reason: suspendReason.trim() },
      `${suspendTarget.displayName} has been suspended.`,
    );
  };

  const removeMember = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/users/${deleteTarget.id}`);
      pushToast("Member account deleted.", { tone: "success" });
      setDeleteTarget(null);
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const summary = query.data?.summary;

  return (
    <div>
      <AdminPageHeader
        eyebrow="People"
        title="Members and their access."
        description="Search the whole membership, review activity, and act with the least privilege needed. Every role change and suspension is written to the audit log."
        actions={
          <Badge tone="brand">
            <Users className="h-3 w-3" /> {summary?.total ?? 0} accounts
          </Badge>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="All members" value={summary?.total ?? 0} icon={Users} tone="brand" hint={`${summary?.newThisWeek ?? 0} joined this week`} />
        <StatCard label="Moderators" value={summary?.moderators ?? 0} icon={Shield} tone="accent" hint="can moderate content and members" />
        <StatCard label="Administrators" value={summary?.admins ?? 0} icon={ShieldCheck} tone="sky" hint="full platform access" />
        <StatCard label="Suspended" value={summary?.suspended ?? 0} icon={UserX} tone="danger" hint="signed out and blocked" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search name, username or email…"
            className="input pl-9"
          />
        </label>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as RoleValue | "")}
          className="input w-auto"
          aria-label="Filter by role"
        >
          <option value="">Every role</option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {tt(option === "ADMIN" ? "Administrators" : option === "MODERATOR" ? "Moderators" : "Members")}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusValue)}
          className="input w-auto"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {tt(option.label)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortValue)}
          className="input w-auto"
          aria-label="Sort members"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {tt(option.label)}
            </option>
          ))}
        </select>
        {query.loading && query.data && <Spinner className="h-4 w-4" />}
      </div>

      {query.loading && !query.data ? (
        <PageLoader label="Loading members…" />
      ) : query.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{query.error}</div>
      ) : (query.data?.users.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="No members match that search."
            description="Try a different name, role or status. Suspended accounts appear under the Suspended filter."
          />
        </div>
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-raised/40 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Activity</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5">Last seen</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data?.users.map((member) => {
                  const isSelf = member.id === currentUser?.id;
                  return (
                  <tr key={member.id} className="transition hover:bg-raised/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.displayName} username={member.username} src={member.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <Link to={`/u/${member.username}`} className="block truncate font-semibold text-ink hover:text-brand-700">
                            {member.displayName}
                          </Link>
                          <span className="block truncate text-[11px] text-muted">@{member.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={roleTone(member.role)}>{tt(ROLE_LABELS[member.role])}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {member.banned ? <Badge tone="danger">Suspended</Badge> : <Badge tone="brand">Active</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-muted">
                      {member.postCount} posts
                      <br />
                      {member.commentCount} comments
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-muted">
                      {member.createdAt ? formatDate(member.createdAt) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-muted">
                      {member.lastSeenAt ? timeAgo(member.lastSeenAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Dropdown trigger={<span className="px-2 py-1 text-xs font-semibold">Manage</span>}>
                        <button type="button" className="menu-item" onClick={() => setDetailId(member.id)}>
                          <Eye className="h-4 w-4 text-muted" /> View record
                        </button>
                        {canManageRoles && !isSelf && (
                          <button
                            type="button"
                            className="menu-item"
                            onClick={() => {
                              setRoleTarget(member);
                              setNextRole(member.role);
                            }}
                          >
                            <ShieldCheck className="h-4 w-4 text-muted" /> Change role
                          </button>
                        )}
                        {canManage &&
                          !isSelf &&
                          (member.banned ? (
                            <button type="button" className="menu-item" onClick={() => setRestoreTarget(member)}>
                              <UserCheck className="h-4 w-4 text-muted" /> Restore access
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="menu-item"
                              onClick={() => {
                                setSuspendTarget(member);
                                setSuspendReason("");
                              }}
                            >
                              <UserX className="h-4 w-4 text-muted" /> Suspend member
                            </button>
                          ))}
                        {canDelete && !isSelf && member.role !== "ADMIN" && (
                          <button
                            type="button"
                            className="menu-item text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleteTarget(member)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete account
                          </button>
                        )}
                        {isSelf && (
                          <p className="px-2 py-1.5 text-[10px] text-muted">This is your account.</p>
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {query.data?.users.map((member) => {
              const isSelf = member.id === currentUser?.id;
              return (
              <div key={member.id} className="card p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={member.displayName} username={member.username} src={member.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/u/${member.username}`} className="block truncate text-sm font-semibold text-ink">
                      {member.displayName}
                    </Link>
                    <p className="truncate text-[11px] text-muted">@{member.username}</p>
                  </div>
                  <Dropdown trigger={<span className="px-2 py-1 text-xs font-semibold">Manage</span>}>
                    <button type="button" className="menu-item" onClick={() => setDetailId(member.id)}>
                      <Eye className="h-4 w-4 text-muted" /> View record
                    </button>
                    {canManageRoles && !isSelf && (
                      <button
                        type="button"
                        className="menu-item"
                        onClick={() => {
                          setRoleTarget(member);
                          setNextRole(member.role);
                        }}
                      >
                        <ShieldCheck className="h-4 w-4 text-muted" /> Change role
                      </button>
                    )}
                    {canManage &&
                      !isSelf &&
                      (member.banned ? (
                        <button type="button" className="menu-item" onClick={() => setRestoreTarget(member)}>
                          <UserCheck className="h-4 w-4 text-muted" /> Restore access
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="menu-item"
                          onClick={() => {
                            setSuspendTarget(member);
                            setSuspendReason("");
                          }}
                        >
                          <UserX className="h-4 w-4 text-muted" /> Suspend member
                        </button>
                      ))}
                    {canDelete && !isSelf && member.role !== "ADMIN" && (
                      <button
                        type="button"
                        className="menu-item text-rose-600"
                        onClick={() => setDeleteTarget(member)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete account
                      </button>
                    )}
                    {isSelf && (
                      <p className="px-2 py-1.5 text-[10px] text-muted">This is your account.</p>
                    )}
                  </Dropdown>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={roleTone(member.role)}>{tt(ROLE_LABELS[member.role])}</Badge>
                  {member.banned ? <Badge tone="danger">Suspended</Badge> : <Badge tone="brand">Active</Badge>}
                  <span className="text-[10px] text-muted">
                    {member.postCount} posts · {member.commentCount} comments
                  </span>
                </div>
              </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="text-xs text-muted">
              Page {page} · {query.data?.meta.total ?? 0} members
            </span>
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!query.data?.meta.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      <MemberDetailModal id={detailId} onClose={() => setDetailId(null)} />

      <Modal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        title="Change role"
        description={`Choose the capabilities ${roleTarget?.displayName ?? "this member"} should have.`}
      >
        <form onSubmit={submitRole} className="space-y-4">
          <div className="space-y-2">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                  nextRole === option ? "border-brand-600/40 bg-brand-50/50 dark:bg-brand-500/5" : "border-line",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={nextRole === option}
                  onChange={() => setNextRole(option)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{tt(ROLE_LABELS[option])}</span>
                  <span className="block text-[11px] leading-5 text-muted">
                    {option === "ADMIN"
                      ? "Full access: roles, deletions, rooms, announcements and the audit trail."
                      : option === "MODERATOR"
                        ? "Reports, content removal and member suspensions. No role changes or deletions."
                        : "Standard community access with no admin surfaces."}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {roleTarget?.role === "ADMIN" && nextRole !== "ADMIN" && (
            <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Demoting the last administrator would remove every account that can manage roles. The API rejects
              this change if it would leave the community without one.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRoleTarget(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || nextRole === roleTarget?.role}>
              {busy ? <Spinner className="h-4 w-4 text-white" /> : <ShieldCheck className="h-4 w-4" />}
              Save role
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title={`Suspend ${suspendTarget?.displayName ?? "this member"}?`}
        description="They will be signed out immediately and cannot sign in until access is restored. Their content stays visible."
      >
        <form onSubmit={submitSuspend} className="space-y-3">
          <div>
            <label htmlFor="suspend-reason" className="label">
              Reason (shared with the team)
            </label>
            <textarea
              id="suspend-reason"
              className="input resize-y"
              rows={3}
              minLength={3}
              maxLength={500}
              required
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
              placeholder="e.g. Repeated spam after two warnings."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setSuspendTarget(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4 text-white" /> : <UserX className="h-4 w-4" />}
              Suspend member
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title={`Restore ${restoreTarget?.displayName ?? "this member"}?`}
        description="They will be able to sign in again. The suspension stays in the audit log."
        confirmLabel="Restore access"
        busy={busy}
        onConfirm={() => restoreTarget && void applyPatch(restoreTarget, { banned: false }, "Access restored.")}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.displayName ?? "this member"}?`}
        description="Their profile, posts, comments, messages and media will be permanently removed. This cannot be undone."
        confirmLabel="Delete account"
        busy={busy}
        onConfirm={removeMember}
      />
    </div>
  );
}

function MemberDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery<MemberDetailResponse>(id ? `/api/admin/users/${id}` : null);

  return (
    <Modal
      open={Boolean(id)}
      onClose={onClose}
      title={detail.data?.user.displayName ?? "Member record"}
      description={detail.data ? `@${detail.data.user.username} · ${detail.data.user.email ?? "no email"}` : "Loading the account…"}
      className="sm:max-w-2xl"
    >
      {detail.loading && !detail.data ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : detail.error ? (
        <p className="py-6 text-sm text-rose-600">{detail.error}</p>
      ) : detail.data ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={detail.data.user.displayName} username={detail.data.user.username} src={detail.data.user.avatarUrl} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={roleTone(detail.data.user.role)}>{tt(ROLE_LABELS[detail.data.user.role])}</Badge>
                {detail.data.user.banned ? <Badge tone="danger">Suspended</Badge> : <Badge tone="brand">Active</Badge>}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Joined {detail.data.user.createdAt ? formatDate(detail.data.user.createdAt) : "—"}
                {detail.data.user.lastSeenAt ? ` · last seen ${formatDateTime(detail.data.user.lastSeenAt)}` : ""}
              </p>
            </div>
            <Link to={`/u/${detail.data.user.username}`} className="btn-secondary btn-sm ml-auto">
              Open profile
            </Link>
          </div>

          {detail.data.user.banned && detail.data.user.suspendedReason && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] leading-5 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              <strong>Suspended:</strong> {detail.data.user.suspendedReason}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Posts" value={String(detail.data.user.postCount)} />
            <MiniStat label="Comments" value={String(detail.data.user.commentCount)} />
            <MiniStat label="Followers" value={String(detail.data.user.followerCount)} />
            <MiniStat label="Following" value={String(detail.data.user.followingCount)} />
            <MiniStat label="Bookmarks" value={String(detail.data.user.bookmarkCount)} />
            <MiniStat label="Reports filed" value={String(detail.data.user.reportCount)} />
          </div>

          <Panel title="Recent posts" description="The five newest conversations." className="border-0 p-0 shadow-none">
            {detail.data.recentPosts.length === 0 ? (
              <p className="text-xs text-muted">No posts yet.</p>
            ) : (
              <ul className="space-y-2">
                {detail.data.recentPosts.map((post) => (
                  <li key={post.id} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: post.category.color }} />
                    <Link to={`/posts/${post.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:text-brand-700">
                      {post.title ?? "Untitled post"}
                    </Link>
                    <span className="shrink-0 text-[10px] text-muted">
                      {post.likeCount} ♥ · {post.commentCount} 💬
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {(detail.data.reportsAgainst.length > 0 || detail.data.recentActions.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Reports against them
                </p>
                {detail.data.reportsAgainst.length === 0 ? (
                  <p className="text-xs text-muted">None.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.data.reportsAgainst.map((report) => (
                      <li key={report.id} className="rounded-lg border border-line p-2 text-[11px]">
                        <span className="font-semibold text-ink">{report.reason.replaceAll("_", " ").toLowerCase()}</span>
                        <span className="text-muted"> · {report.status.toLowerCase()} · {timeAgo(report.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Admin history
                </p>
                {detail.data.recentActions.length === 0 ? (
                  <p className="text-xs text-muted">No administrative actions.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {detail.data.recentActions.map((action) => (
                      <li key={action.id} className="rounded-lg border border-line p-2 text-[11px]">
                        <span className="text-ink">{action.summary}</span>
                        <span className="block text-[10px] text-muted">
                          {action.actor.displayName} · {timeAgo(action.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[10px] text-muted">
            <CalendarDays className="h-3 w-3" /> Joined {detail.data.user.createdAt ? formatDate(detail.data.user.createdAt) : "—"}
            <MessageCircle className="ml-2 h-3 w-3" /> {detail.data.user.commentCount} comments
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
