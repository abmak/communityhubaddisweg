import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Heart, MessageCircle, Search, Trash2 } from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useDebounced, useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import { cn, formatCount, timeAgo } from "../../lib/utils";
import type { Category } from "../../types";
import type { ContentItem, ContentResponse } from "../../lib/adminTypes";
import { Avatar, Badge, ConfirmDialog, EmptyState, PageLoader, Spinner } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader } from "./parts";

type ContentType = "POST" | "COMMENT";
type ContentStatus = "visible" | "removed" | "all";

export function AdminContent() {
  const { permissions } = useAdminAccess();
  const canManage = permissions.includes("admin.content.manage");
  const pushToast = useUI((state) => state.pushToast);

  const [type, setType] = useState<ContentType>("POST");
  const [status, setStatus] = useState<ContentStatus>("visible");
  const [category, setCategory] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [removeTarget, setRemoveTarget] = useState<ContentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(term, 350);

  const categories = useQuery<{ categories: Category[] }>("/api/categories");
  const query = useQuery<ContentResponse>(
    `/api/admin/content?type=${type}&status=${status}&page=${page}&limit=20` +
      `${q ? `&q=${encodeURIComponent(q)}` : ""}${category ? `&category=${encodeURIComponent(category)}` : ""}`,
  );

  useEffect(() => {
    setPage(1);
  }, [type, status, category, q]);

  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/content/${removeTarget.type}/${removeTarget.id}`);
      pushToast(
        removeTarget.type === "POST" ? "Post deleted." : "Comment removed from public view.",
        { tone: "success" },
      );
      setRemoveTarget(null);
      query.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Moderation"
        title="Everything published, reviewable."
        description="Search across conversations and comments. Removing a post deletes it and its thread; removing a comment leaves a tombstone so replies keep their context."
        actions={<Badge tone="neutral"><FileText className="h-3 w-3" /> {formatCount(query.data?.meta.total ?? 0)} results</Badge>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(["POST", "COMMENT"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
                type === option ? "bg-brand-700 text-white" : "text-muted hover:text-ink",
              )}
            >
              {option === "POST" ? "Posts" : "Comments"}
            </button>
          ))}
        </div>

        {type === "COMMENT" && (
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ContentStatus)}
            className="input w-auto"
            aria-label="Filter comments by visibility"
          >
            <option value="visible">Visible</option>
            <option value="removed">Removed</option>
            <option value="all">All comments</option>
          </select>
        )}

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="input w-auto"
          aria-label="Filter by room"
        >
          <option value="">Every room</option>
          {categories.data?.categories.map((room) => (
            <option key={room.id} value={room.slug}>
              {room.name}
            </option>
          ))}
        </select>

        <label className="relative block w-full sm:ml-auto sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={type === "POST" ? "Search post text…" : "Search comment text…"}
            className="input pl-9"
          />
        </label>
      </div>

      {query.loading && !query.data ? (
        <PageLoader label="Searching content…" />
      ) : query.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{query.error}</div>
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileText}
            title="No content matches."
            description="Try a different room, visibility filter or search phrase."
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {query.data?.items.map((item) => {
            const removed = Boolean(item.removedAt);
            const postId = item.type === "POST" ? item.id : item.post?.id;
            return (
              <article key={`${item.type}-${item.id}`} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <Avatar name={item.author.displayName} username={item.author.username} src={item.author.avatarUrl} size="xs" />
                  <Link to={`/u/${item.author.username}`} className="font-semibold text-ink hover:text-brand-700">
                    {item.author.displayName}
                  </Link>
                  <span>·</span>
                  <span>{timeAgo(item.createdAt)}</span>
                  {item.category && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.category.color }} />
                        {item.category.name}
                      </span>
                    </>
                  )}
                  {item.post && (
                    <>
                      <span>·</span>
                      <span className="truncate">in {item.post.title ?? "Untitled post"}</span>
                    </>
                  )}
                  {item.type === "COMMENT" && <Badge tone="neutral">Comment</Badge>}
                  {removed && <Badge tone="danger">Removed</Badge>}
                </div>

                <div className="mt-2">
                  {item.title && <p className="font-display text-sm font-semibold text-ink">{item.title}</p>}
                  <p className={cn("mt-0.5 line-clamp-3 text-sm leading-6 text-muted", removed && "italic line-through opacity-60")}>
                    {removed ? "This comment has been removed." : item.body}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {item.likeCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {item.commentCount ?? item.replyCount ?? 0}
                  </span>
                  {typeof item.viewCount === "number" && <span>{formatCount(item.viewCount)} views</span>}
                  {postId && (
                    <Link to={`/posts/${postId}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                      Open in context
                    </Link>
                  )}
                  {canManage && !removed && (
                    <button
                      type="button"
                      className="btn-danger btn-sm ml-auto"
                      onClick={() => setRemoveTarget(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {item.type === "POST" ? "Delete post" : "Remove comment"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {query.data && query.data.items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="text-xs text-muted">
            Page {page} · {query.data.meta.total} items
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

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget?.type === "POST" ? "Delete this post?" : "Remove this comment?"}
        description={
          removeTarget?.type === "POST"
            ? "The post, its comments and media are permanently deleted. This is recorded in the audit log."
            : "The comment stays in the thread as a tombstone but its text is cleared. This is recorded in the audit log."
        }
        confirmLabel={removeTarget?.type === "POST" ? "Delete post" : "Remove comment"}
        busy={busy}
        onConfirm={remove}
      />
      {busy && (
        <div className="pointer-events-none fixed bottom-5 right-5">
          <Spinner className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
