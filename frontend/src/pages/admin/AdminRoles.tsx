import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Minus,
  Shield,
  ShieldCheck,
  User,
  Users,
  Plus,
  Edit3,
  Trash2,
  X,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useQuery } from "../../hooks/useApi";
import { api, apiError } from "../../lib/api";
import { useUI } from "../../store/ui";
import { cn, formatCount } from "../../lib/utils";
import { tt } from "../../lib/i18n";
import {
  PERMISSION_GROUPS,
  type Permission,
} from "../../lib/rbac";
import type { RolesResponse, RoleItem } from "../../lib/adminTypes";
import { PageLoader, Spinner } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader, Panel } from "./parts";

export function AdminRoles() {
  const { permissions, role: myRole } = useAdminAccess();
  const canManageRoles = permissions.includes("admin.roles.manage");
  const pushToast = useUI((state) => state.pushToast);
  const query = useQuery<RolesResponse>("/api/admin/roles");

  // Create Role Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createRank, setCreateRank] = useState("20");
  const [createPermissions, setCreatePermissions] = useState<Permission[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit Role Modal State
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRank, setEditRank] = useState("20");
  const [editPermissions, setEditPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenEdit = (roleItem: RoleItem) => {
    setEditingRole(roleItem);
    setEditName(roleItem.name);
    setEditDescription(roleItem.description);
    setEditRank(String(roleItem.rank));
    setEditPermissions([...roleItem.permissions]);
  };

  const toggleEditPermission = (perm: Permission) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const toggleCreatePermission = (perm: Permission) => {
    setCreatePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!createSlug.trim() || !createName.trim()) {
      pushToast("Please enter a role slug and name.", { tone: "error" });
      return;
    }

    try {
      setCreating(true);
      await api.post("/api/admin/roles", {
        slug: createSlug.trim().toUpperCase(),
        name: createName.trim(),
        description: createDescription.trim(),
        rank: parseInt(createRank, 10) || 20,
        permissions: createPermissions,
      });

      pushToast(`Role ${createName} created successfully.`, { tone: "success" });
      setCreateOpen(false);
      setCreateSlug("");
      setCreateName("");
      setCreateDescription("");
      setCreateRank("20");
      setCreatePermissions([]);
      query.refetch();
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    try {
      setSaving(true);
      await api.patch(`/api/admin/roles/${editingRole.id || editingRole.slug}`, {
        name: editName.trim(),
        description: editDescription.trim(),
        rank: parseInt(editRank, 10) || editingRole.rank,
        permissions: editPermissions,
      });

      pushToast(`Role ${editName} updated successfully.`, { tone: "success" });
      setEditingRole(null);
      query.refetch();
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleItem: RoleItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete the role "${roleItem.name}"?`)) {
      return;
    }

    try {
      setDeletingId(roleItem.id);
      await api.delete(`/api/admin/roles/${roleItem.id || roleItem.slug}`);
      pushToast(`Role ${roleItem.name} removed.`, { tone: "success" });
      query.refetch();
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const roles = query.data?.roles ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Access control"
        title="Roles & Permissions Management"
        description="Configure exact capabilities for each role or create custom roles tailored for community leaders, editors, or event guides."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/members" className="btn-secondary btn-sm">
              <Users className="h-3.5 w-3.5" /> Assign to Members
            </Link>
            {canManageRoles && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="btn-primary btn-sm"
              >
                <Plus className="h-3.5 w-3.5" /> New Role
              </button>
            )}
          </div>
        }
      />

      {query.loading && !query.data ? (
        <PageLoader label="Loading role definitions…" />
      ) : query.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{query.error}</div>
      ) : query.data ? (
        <div className="space-y-6">
          {/* Roles Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((roleItem) => {
              const isMe = roleItem.slug === myRole;
              const isSystem = roleItem.system;
              const Icon = roleItem.slug === "ADMIN" ? ShieldCheck : roleItem.slug === "MODERATOR" ? Shield : User;

              return (
                <div
                  key={roleItem.slug}
                  className={cn(
                    "card flex flex-col justify-between p-5 transition hover:shadow-lift",
                    isMe && "border-brand-600/40 ring-1 ring-brand-600/20",
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold shadow-sm",
                            roleItem.slug === "ADMIN"
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                              : roleItem.slug === "MODERATOR"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                : "bg-raised text-muted",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-ink">{roleItem.name}</h3>
                            {isSystem && (
                              <span className="inline-flex items-center gap-1 rounded bg-raised px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
                                <Lock className="h-2.5 w-2.5" /> System
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted">
                            <code>{roleItem.slug}</code> · Rank {roleItem.rank}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full bg-raised px-2.5 py-0.5 text-[10px] font-semibold text-muted">
                        {formatCount(roleItem.members)} {roleItem.members === 1 ? "user" : "users"}
                        {isMe ? " · (you)" : ""}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-muted line-clamp-3">
                      {roleItem.description || "No description provided."}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3 text-[11px]">
                      <span className="font-semibold text-muted">
                        {roleItem.permissions.length} capabilities granted
                      </span>
                    </div>
                  </div>

                  {canManageRoles && (
                    <div className="mt-4 flex items-center gap-2 border-t border-line/60 pt-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(roleItem)}
                        className="btn-secondary btn-xs flex-1 justify-center gap-1.5"
                      >
                        <Edit3 className="h-3 w-3" /> Edit Permissions
                      </button>

                      {!isSystem && (
                        <button
                          type="button"
                          disabled={deletingId === roleItem.id}
                          onClick={() => void handleDeleteRole(roleItem)}
                          className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-600 hover:bg-rose-500/20 disabled:opacity-50"
                          title="Delete Role"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Permission Matrix */}
          <Panel
            title="Permission Matrix"
            description="Complete capability overview across all active roles."
            action={<span className="text-[10px] text-muted">Live enforced by API</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    <th className="py-2.5 pr-4">Capability</th>
                    {roles.map((r) => (
                      <th key={r.slug} className="py-2.5 text-center min-w-[80px]">
                        {r.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map((group) => (
                    <tr key={group.label} className="contents">
                      <tr>
                        <td
                          colSpan={roles.length + 1}
                          className="pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300"
                        >
                          {tt(group.label)}
                        </td>
                      </tr>
                      {group.permissions.map((perm) => (
                        <tr key={perm.id} className="border-b border-line/50 last:border-0 hover:bg-raised/40">
                          <td className="py-2.5 pr-4">
                            <p className="text-xs font-semibold text-ink">{tt(perm.label)}</p>
                            <p className="text-[10px] leading-4 text-muted">{tt(perm.description)}</p>
                          </td>
                          {roles.map((r) => {
                            const allowed = r.permissions.includes(perm.id);
                            return (
                              <td key={r.slug} className="py-2.5 text-center">
                                {allowed ? (
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-3 w-3 stroke-[2.5]" />
                                  </span>
                                ) : (
                                  <span className="inline-flex h-5 w-5 items-center justify-center text-muted/30">
                                    <Minus className="h-3 w-3" />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      {/* Create New Role Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-brand-500/10 p-2.5 text-brand-600 dark:text-brand-300">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Create New Role</h2>
                <p className="text-xs text-muted">
                  Define a new custom role with specific administrative and moderation capabilities.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">Role Slug *</label>
                  <input
                    type="text"
                    required
                    value={createSlug}
                    onChange={(e) => setCreateSlug(e.target.value.toUpperCase())}
                    placeholder="e.g. EDITOR, EVENT_LEADER"
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-mono uppercase text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-[10px] text-muted">Uppercase letters and underscores only.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">Role Display Name *</label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Community Editor"
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Description</label>
                <textarea
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Explain what members with this role are responsible for…"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Hierarchy Rank (11–99)</label>
                <input
                  type="number"
                  min="11"
                  max="99"
                  value={createRank}
                  onChange={(e) => setCreateRank(e.target.value)}
                  className="mt-1 w-32 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <p className="mt-1 text-[10px] text-muted">
                  Higher rank roles outrank lower rank roles. (Member = 10, Moderator = 50, Admin = 100).
                </p>
              </div>

              {/* Permissions Checklist */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Grant Capabilities</h3>
                  <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                    {createPermissions.length} selected
                  </span>
                </div>

                <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label} className="rounded-2xl border border-line/60 bg-surface-raised/30 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {tt(group.label)}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((p) => {
                          const checked = createPermissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-2 rounded-xl border p-2 text-xs transition",
                                checked
                                  ? "border-brand-500/50 bg-brand-500/10 text-ink"
                                  : "border-line/60 bg-surface text-muted hover:border-line hover:text-ink",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCreatePermission(p.id)}
                                className="mt-0.5 rounded border-line text-brand-600 focus:ring-brand-500"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-[11px] text-ink">{tt(p.label)}</p>
                                <p className="text-[9px] text-muted line-clamp-1">{p.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {creating && <Spinner className="h-3.5 w-3.5" />}
                  <span>{creating ? "Creating…" : "Create Role"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role & Permissions Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-lift sm:p-8">
            <button
              type="button"
              onClick={() => setEditingRole(null)}
              className="absolute right-5 top-5 rounded-full p-2 text-muted hover:bg-raised hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-brand-500/10 p-2.5 text-brand-600 dark:text-brand-300">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Edit Role: {editingRole.name}</h2>
                <p className="text-xs text-muted">
                  Update role details and customize granted administrative capabilities.
                </p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">Role Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">Rank</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editRank}
                    onChange={(e) => setEditRank(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Permissions Checklist */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Capabilities & Permissions</h3>
                  <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                    {editPermissions.length} enabled
                  </span>
                </div>

                <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label} className="rounded-2xl border border-line/60 bg-surface-raised/30 p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {tt(group.label)}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((p) => {
                          const checked = editPermissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-2 rounded-xl border p-2 text-xs transition",
                                checked
                                  ? "border-brand-500/50 bg-brand-500/10 text-ink"
                                  : "border-line/60 bg-surface text-muted hover:border-line hover:text-ink",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEditPermission(p.id)}
                                className="mt-0.5 rounded border-line text-brand-600 focus:ring-brand-500"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-[11px] text-ink">{tt(p.label)}</p>
                                <p className="text-[9px] text-muted line-clamp-1">{p.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {saving && <Spinner className="h-3.5 w-3.5" />}
                  <span>{saving ? "Saving…" : "Save Permissions"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
