import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Flag,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import { cn, timeAgo } from "../../lib/utils";
import type { Report, ReportsResponse, ReportsSummary } from "../../lib/adminTypes";
import { Badge, ConfirmDialog, PageLoader, Spinner } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader, BarList, MiniStat, Panel, StatCard, formatHours } from "./parts";

const STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
const TARGETS = ["POST", "COMMENT", "USER"] as const;

export function AdminReports() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.reports.manage");
  const pushToast = useUI((state) => state.pushToast);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("OPEN");
  const [targetType, setTargetType] = useState<(typeof TARGETS)[number] | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);

  const targetQuery = targetType === "ALL" ? "" : `&targetType=${targetType}`;
  const summary = useQuery<ReportsSummary>("/api/admin/reports/summary");
  const queue = useQuery<ReportsResponse>(
    `/api/admin/reports?status=${status}&page=${page}&limit=15${targetQuery}`,
  );

  const setReportStatus = async (report: Report, next: "RESOLVED" | "DISMISSED") => {
    setBusyId(report.id);
    try {
      await api.patch(`/api/admin/reports/${report.id}`, { status: next });
      pushToast(next === "RESOLVED" ? "Report resolved." : "Report dismissed.", { tone: "success" });
      queue.refetch();
      summary.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const deleteContent = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      if (deleteTarget.targetType === "POST" || deleteTarget.targetType === "COMMENT") {
        await api.delete(`/api/admin/content/${deleteTarget.targetType}/${deleteTarget.targetId}`);
      }
      await api.patch(`/api/admin/reports/${deleteTarget.id}`, { status: "RESOLVED" });
      pushToast("Content removed and report resolved.", { tone: "success" });
      setDeleteTarget(null);
      queue.refetch();
      summary.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = (next: (typeof STATUSES)[number]) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Moderation"
        title="The report queue."
        description="Every report members file lands here. Resolve with a decision, dismiss noise, and remove content when it breaks the house rules."
        actions={<Badge tone="danger"><Flag className="h-3 w-3" /> {summary.data?.counts.open ?? 0} open</Badge>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open reports" value={summary.data?.counts.open ?? 0} icon={ShieldAlert} tone="danger" hint="currently in the queue" />
        <StatCard label="Resolved this week" value={summary.data?.counts.resolvedThisWeek ?? 0} icon={CheckCircle2} tone="brand" hint="by moderators and admins" />
        <StatCard label="Dismissed" value={summary.data?.counts.dismissed ?? 0} icon={XCircle} tone="neutral" hint="all time" />
        <StatCard label="Average resolution" value={formatHours(summary.data?.avgResolutionHours ?? null)} icon={Flag} tone="accent" hint="from filing to resolution" />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Open queue by reason" description="Where the pressure comes from right now.">
          <BarList
            rows={(summary.data?.byReason ?? []).map((reason) => ({
              label: reason.reason.replaceAll("_", " ").toLowerCase(),
              value: reason.count,
              color: "#e11d48",
            }))}
            emptyLabel="The queue is clear."
          />
        </Panel>
        <Panel title="What is being reported" description="Reports still awaiting a decision.">
          <div className="flex flex-wrap gap-2">
            {(summary.data?.byTargetType ?? []).map((target) => (
              <span
                key={target.targetType}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-raised/40 px-3 py-2 text-xs font-medium text-muted"
              >
                {target.targetType.toLowerCase()}
                <span className="font-display text-base font-semibold text-ink">{target.count}</span>
              </span>
            ))}
            {(summary.data?.byTargetType ?? []).length === 0 && (
              <p className="text-sm text-muted">No open reports to break down.</p>
            )}
          </div>
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-5 text-muted">
            Deleting content also resolves the report. Comments are tombstoned so threads keep their shape;
            posts are removed completely.
          </p>
        </Panel>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeStatus(option)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize transition",
                status === option ? "bg-brand-700 text-white" : "text-muted hover:text-ink",
              )}
            >
              {option.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(["ALL", ...TARGETS] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setTargetType(option);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] font-semibold capitalize transition",
                targetType === option ? "bg-raised text-ink" : "text-muted hover:text-ink",
              )}
            >
              {option === "ALL" ? "Everything" : `${option.toLowerCase()}s`}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted">{queue.data?.meta.total ?? 0} reports</span>
      </div>

      {queue.loading && !queue.data ? (
        <PageLoader label="Loading the queue…" />
      ) : queue.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{queue.error}</div>
      ) : (queue.data?.reports.length ?? 0) === 0 ? (
        <div className="card p-10 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="font-display text-lg font-semibold text-ink">Nothing waiting in this queue.</p>
          <p className="mt-1 text-sm text-muted">The community is behaving itself.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.data?.reports.map((report) => (
            <article key={report.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="danger">{report.reason.replaceAll("_", " ")}</Badge>
                <span className="text-xs text-muted">
                  {report.targetType.toLowerCase()} · reported by{" "}
                  <Link to={`/u/${report.reporter.username}`} className="font-medium hover:underline">
                    @{report.reporter.username}
                  </Link>{" "}
                  · {timeAgo(report.createdAt)}
                </span>
                <span className="ml-auto text-[11px] font-medium capitalize text-muted">
                  {report.status.toLowerCase()}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-line bg-raised/40 p-3 text-sm">
                {report.targetType === "POST" && report.target && "title" in report.target ? (
                  <Link to={`/posts/${report.target.id}`} className="block hover:text-brand-700">
                    <p className="font-medium text-ink">{report.target.title ?? "Untitled post"}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{report.target.body}</p>
                    <p className="mt-1 text-[11px] text-muted">by @{report.target.author.username}</p>
                  </Link>
                ) : report.targetType === "COMMENT" && report.target && "postId" in report.target ? (
                  <Link to={`/posts/${report.target.postId}#comments`} className="block hover:text-brand-700">
                    <p className={cn("text-ink", report.target.deletedAt && "italic text-muted line-through")}>
                      {report.target.deletedAt ? "This comment has since been removed." : report.target.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">by @{report.target.author.username}</p>
                  </Link>
                ) : report.target && "username" in report.target ? (
                  <Link to={`/u/${report.target.username}`} className="block hover:text-brand-700">
                    <p className="text-ink">{report.target.displayName}</p>
                    <p className="text-[11px] text-muted">@{report.target.username}</p>
                  </Link>
                ) : (
                  <p className="text-muted">The reported content has already been removed.</p>
                )}
                {report.details && (
                  <p className="mt-2 border-t border-line pt-2 text-xs italic text-muted">“{report.details}”</p>
                )}
              </div>

              {report.status === "OPEN" && canManage && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => setReportStatus(report, "RESOLVED")}
                    disabled={busyId === report.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setReportStatus(report, "DISMISSED")}
                    disabled={busyId === report.id}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Dismiss
                  </button>
                  {(report.targetType === "POST" ||
                    (report.targetType === "COMMENT" &&
                      report.target &&
                      !("deletedAt" in report.target && report.target.deletedAt))) &&
                    report.target && (
                    <button
                      type="button"
                      className="btn-danger btn-sm ml-auto"
                      onClick={() => setDeleteTarget(report)}
                      disabled={busyId === report.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete content
                    </button>
                  )}
                  {busyId === report.id && <Spinner className="h-4 w-4" />}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {queue.data && queue.data.reports.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="text-xs text-muted">Page {page}</span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={!queue.data.meta.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this content?"
        description="The content will be removed from the community and the report marked resolved. This is recorded in the audit log."
        confirmLabel="Delete content"
        busy={busyId === deleteTarget?.id}
        onConfirm={deleteContent}
      />
    </div>
  );
}
