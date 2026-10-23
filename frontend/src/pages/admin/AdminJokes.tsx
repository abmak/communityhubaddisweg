import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Laugh, Loader2, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import type { AdminJokeSession } from "../../types";
import { Badge, ConfirmDialog, EmptyState, PageLoader } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader } from "./parts";
import { formatDateTime } from "../../lib/utils";

interface SessionsResponse {
  sessions: AdminJokeSession[];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO string → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toInputValue(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function defaultWindow(): { opensAt: string; closesAt: string } {
  const now = new Date();
  now.setMinutes(now.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (now.getMinutes() === 0) now.setHours(now.getHours() + 1);
  const close = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return { opensAt: toInputValue(now), closesAt: toInputValue(close) };
}

export function AdminJokes() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.jokes.manage");
  const pushToast = useUI((state) => state.pushToast);
  const query = useQuery<SessionsResponse>("/api/admin/joke-sessions");

  const [editing, setEditing] = useState<AdminJokeSession | null>(null);
  const [form, setForm] = useState(() => ({ title: "Joke Time", ...defaultWindow() }));
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminJokeSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sessions = query.data?.sessions ?? [];

  const reset = () => {
    setEditing(null);
    setForm({ title: "Joke Time", ...defaultWindow() });
  };

  const startEdit = (session: AdminJokeSession) => {
    setEditing(session);
    setForm({
      title: session.title,
      opensAt: toInputValue(session.opensAt),
      closesAt: toInputValue(session.closesAt),
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!form.opensAt || !form.closesAt) {
      pushToast("Choose both an opening and a closing time.", { tone: "error" });
      return;
    }
    const payload = {
      title: form.title.trim() || "Joke Time",
      opensAt: new Date(form.opensAt).toISOString(),
      closesAt: new Date(form.closesAt).toISOString(),
    };
    if (new Date(payload.closesAt) <= new Date(payload.opensAt)) {
      pushToast("Closing time must be after the opening time.", { tone: "error" });
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/api/admin/joke-sessions/${editing.id}`, payload);
        pushToast("Joke Time rescheduled.", { tone: "success" });
      } else {
        await api.post("/api/admin/joke-sessions", payload);
        pushToast("Joke Time scheduled.", { tone: "success" });
      }
      reset();
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/joke-sessions/${deleteTarget.id}`);
      pushToast("Joke Time session deleted.", { tone: "success" });
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) reset();
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Community games"
        title="Joke Time"
        description="Schedule the windows when members can share jokes. When a session closes, the joke with the most likes and comments is crowned for the day."
        actions={
          <Link to="/jokes" className="btn-secondary btn-sm">
            <ArrowUpRight className="h-3.5 w-3.5" /> View Joke Time
          </Link>
        }
      />

      {canManage && (
        <form onSubmit={submit} className="card p-5">
          <div className="flex items-center gap-2">
            <Laugh className="h-4 w-4 text-amber-600" />
            <h2 className="font-display text-base font-semibold text-ink">
              {editing ? "Reschedule session" : "Schedule a session"}
            </h2>
            {editing && (
              <button type="button" className="btn-ghost btn-sm ml-auto" onClick={reset}>
                Cancel
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="label" htmlFor="joke-title">
                Title
              </label>
              <input
                id="joke-title"
                className="input"
                value={form.title}
                maxLength={80}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Joke Time"
              />
            </div>
            <div>
              <label className="label" htmlFor="joke-opens">
                Opens
              </label>
              <input
                id="joke-opens"
                type="datetime-local"
                className="input"
                value={form.opensAt}
                onChange={(event) => setForm({ ...form, opensAt: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="joke-closes">
                Closes
              </label>
              <input
                id="joke-closes"
                type="datetime-local"
                className="input"
                value={form.closesAt}
                onChange={(event) => setForm({ ...form, closesAt: event.target.value })}
                required
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editing ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editing ? "Save changes" : "Schedule"}
              </button>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
            <Clock className="h-3 w-3" /> Times use this device's time zone. Sessions cannot overlap.
          </p>
        </form>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-base font-semibold text-ink">Scheduled sessions</h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {sessions.length} total
          </span>
        </div>

        {query.loading && !query.data ? (
          <PageLoader label="Loading sessions…" />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Laugh}
            title="No Joke Time scheduled"
            description="Schedule the first session and members can start sharing jokes the moment it opens."
          />
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <Trophy className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {session.title}
                    <Badge
                      tone={
                        session.status === "OPEN"
                          ? "brand"
                          : session.status === "UPCOMING"
                            ? "accent"
                            : "neutral"
                      }
                    >
                      {session.status}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDateTime(session.opensAt)} → {formatDateTime(session.closesAt)} ·{" "}
                    {session.jokeCount} {session.jokeCount === 1 ? "joke" : "jokes"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => startEdit(session)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-rose-600"
                      onClick={() => setDeleteTarget(session)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this session?"
        description="The jokes shared in this window are deleted with it. This cannot be undone."
        busy={deleting}
        onConfirm={remove}
      />
    </div>
  );
}
