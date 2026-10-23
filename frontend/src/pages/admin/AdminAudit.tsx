import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { useDebounced, useQuery } from "../../hooks/useApi";
import { cn, formatDateTime, timeAgo } from "../../lib/utils";
import type { AuditResponse } from "../../lib/adminTypes";
import { Avatar, Badge, EmptyState, PageLoader } from "../../components/ui";
import { AdminPageHeader } from "./parts";

const ACTION_LABELS: Record<string, string> = {
  "user.role_changed": "Role changed",
  "user.suspended": "Member suspended",
  "user.restored": "Access restored",
  "user.deleted": "Account deleted",
  "report.resolved": "Report resolved",
  "report.dismissed": "Report dismissed",
  "content.post_deleted": "Post deleted",
  "content.comment_removed": "Comment removed",
  "category.created": "Room created",
  "category.updated": "Room updated",
  "category.deleted": "Room deleted",
  "announcement.published": "Announcement published",
};

function toneFor(action: string): "danger" | "brand" | "accent" | "neutral" {
  if (action.includes("deleted") || action.includes("suspended") || action.includes("removed")) return "danger";
  if (action.startsWith("user.")) return "accent";
  if (action.startsWith("report.") || action.startsWith("content.")) return "brand";
  return "neutral";
}

export function AdminAudit() {
  const [term, setTerm] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(term, 350);

  const query = useQuery<AuditResponse>(
    `/api/admin/audit?page=${page}&limit=30${q ? `&q=${encodeURIComponent(q)}` : ""}${action ? `&action=${encodeURIComponent(action)}` : ""}`,
  );

  useEffect(() => {
    setPage(1);
  }, [q, action]);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Accountability"
        title="The audit trail."
        description="An append-only record of every consequential action taken from this dashboard: who did it, what changed and when."
        actions={<Badge tone="neutral"><History className="h-3 w-3" /> {query.data?.meta.total ?? 0} entries</Badge>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search summaries or target IDs…"
            className="input pl-9"
          />
        </label>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="input w-auto"
          aria-label="Filter by action"
        >
          <option value="">Every action</option>
          {(query.data?.kinds ?? []).map((kind) => (
            <option key={kind.action} value={kind.action}>
              {ACTION_LABELS[kind.action] ?? kind.action} ({kind.count})
            </option>
          ))}
        </select>
        {action && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setAction("")}>
            Clear filter
          </button>
        )}
      </div>

      {query.loading && !query.data ? (
        <PageLoader label="Reading the log…" />
      ) : query.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{query.error}</div>
      ) : (query.data?.actions.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            icon={History}
            title="Nothing recorded yet."
            description="Resolve a report, change a role or publish an announcement and it will appear here."
          />
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {query.data?.actions.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <Avatar name={entry.actor.displayName} username={entry.actor.username} src={entry.actor.avatarUrl} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={toneFor(entry.action)}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </Badge>
                  <span className="text-[11px] font-medium text-ink">{entry.actor.displayName}</span>
                  <span className="text-[10px] text-muted">@{entry.actor.username}</span>
                  <span className="text-[10px] text-muted/50">·</span>
                  <span className="text-[10px] text-muted" title={formatDateTime(entry.createdAt)}>
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-5 text-muted">{entry.summary}</p>
                <p className="mt-0.5 font-mono text-[9px] text-muted/60">
                  {entry.targetType.toLowerCase()}
                  {entry.targetId ? ` · ${entry.targetId}` : ""}
                </p>
              </div>
              <span className={cn("shrink-0 text-[10px] text-muted/70")}>
                {formatDateTime(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {query.data && query.data.actions.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="text-xs text-muted">
            Page {page} · {query.data.meta.total} entries
          </span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={!query.data.meta.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
