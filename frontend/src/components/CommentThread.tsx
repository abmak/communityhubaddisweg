import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import type { Comment, User } from "../types";
import { api, apiError } from "../lib/api";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { cn, formatCount, timeAgo } from "../lib/utils";
import { useQuery } from "../hooks/useApi";
import { Avatar, ConfirmDialog, Dropdown, EmptyState, Spinner } from "./ui";
import { ReportDialog } from "./ReportDialog";

interface CommentsResponse {
  comments: Comment[];
  total: number;
  sort: string;
  truncated: boolean;
}

export function CommentThread({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange?: (count: number) => void;
}) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useQuery<CommentsResponse>(
    `/api/posts/${postId}/comments?sort=${sort}`,
  );

  // Keep the latest callback in a ref: parents pass inline handlers, and
  // depending on the callback identity here would re-trigger the parent's
  // state update on every render.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  });
  useEffect(() => {
    if (data) onCountChangeRef.current?.(data.total);
  }, [data?.total]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await api.post(`/api/posts/${postId}/comments`, { body: body.trim() });
      setBody("");
      refetch();
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="comments" className="card scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-700" />
          <h2 className="font-display text-base font-semibold text-ink">
            Conversation {data ? <span className="text-muted">({formatCount(data.total)})</span> : null}
          </h2>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["new", "top"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 font-medium transition",
                sort === option ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200" : "text-muted hover:text-ink",
              )}
            >
              {option === "new" ? "Newest" : "Most relevant"}
            </button>
          ))}
        </div>
      </div>

      {user ? (
        <form onSubmit={submit} className="flex gap-3 border-b border-line px-5 py-4">
          <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Add to the conversation…"
              className="input min-h-[44px] resize-none border-0 bg-raised/70 focus:bg-surface"
              aria-label="Write a comment"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-muted">{body.length}/2000</span>
              <button type="submit" className="btn-primary btn-sm" disabled={!body.trim() || busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Comment
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-raised/40 px-5 py-4">
          <p className="text-sm text-muted">Sign in to join this conversation.</p>
          <Link to="/login" state={{ from: window.location.pathname }} className="btn-primary btn-sm">
            Sign in to comment
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center text-sm text-rose-600">{error}</div>
      ) : !data || data.comments.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No comments yet"
          description="Be the first to add something thoughtful."
          className="py-10"
        />
      ) : (
        <div className="divide-y divide-line">
          {data.comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              viewer={user}
              onRefresh={refetch}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CommentItem({
  comment,
  viewer,
  onRefresh,
  depth,
}: {
  comment: Comment;
  viewer: User | null;
  onRefresh: () => void;
  depth: number;
}) {
  const pushToast = useUI((state) => state.pushToast);
  const [data, setData] = useState(comment);
  const [showReplies, setShowReplies] = useState(true);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => setData(comment), [comment]);

  const canManage = viewer && (viewer.id === data.author?.id || viewer.role === "ADMIN" || viewer.role === "MODERATOR");
  const isMine = viewer && viewer.id === data.author?.id;

  const toggleLike = async () => {
    if (!viewer) return;
    const next = !data.likedByMe;
    setData((current) => ({
      ...current,
      likedByMe: next,
      likeCount: Math.max(0, current.likeCount + (next ? 1 : -1)),
    }));
    try {
      const response = next
        ? await api.post<{ liked: boolean; likeCount: number }>(`/api/comments/${data.id}/like`)
        : await api.delete<{ liked: boolean; likeCount: number }>(`/api/comments/${data.id}/like`);
      setData((current) => ({ ...current, likedByMe: response.data.liked, likeCount: response.data.likeCount }));
    } catch (err) {
      setData(comment);
      pushToast(apiError(err), { tone: "error" });
    }
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!replyBody.trim() || busy) return;
    setBusy(true);
    try {
      await api.post(`/api/posts/${comment.postId}/comments`, {
        body: replyBody.trim(),
        parentId: data.id,
      });
      setReplyBody("");
      setReplyOpen(false);
      setShowReplies(true);
      onRefresh();
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editBody.trim() || busy) return;
    setBusy(true);
    try {
      const response = await api.patch<{ comment: Comment }>(`/api/comments/${data.id}`, {
        body: editBody.trim(),
      });
      setData((current) => ({ ...current, body: response.data.comment.body, updatedAt: response.data.comment.updatedAt }));
      setEditing(false);
      pushToast("Comment updated.", { tone: "success" });
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/comments/${data.id}`);
      setData((current) => ({ ...current, body: "", isDeleted: true, author: null, likedByMe: false, likeCount: 0 }));
      setConfirmOpen(false);
      onRefresh();
      pushToast("Comment deleted.", { tone: "success" });
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const edited =
    !data.isDeleted && new Date(data.updatedAt).getTime() - new Date(data.createdAt).getTime() > 1500;
  const indent = depth > 0;

  return (
    <div
      className={cn(
        "px-5 py-4",
        indent && "border-l-2 border-line/80 bg-raised/20 pl-4 sm:ml-6",
        depth > 1 && "sm:ml-12",
      )}
    >
      <div className="flex gap-3">
        {data.isDeleted ? (
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted/50">
            <MessageCircle className="h-4 w-4" />
          </span>
        ) : (
          <Link to={`/u/${data.author?.username}`} className="mt-0.5 shrink-0">
            <Avatar
              name={data.author?.displayName}
              username={data.author?.username}
              src={data.author?.avatarUrl}
              size="sm"
            />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs">
              {data.isDeleted ? (
                <span className="italic text-muted">Comment deleted</span>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Link to={`/u/${data.author?.username}`} className="font-semibold text-ink hover:text-brand-700">
                    {data.author?.displayName}
                  </Link>
                  <span className="text-muted">@{data.author?.username}</span>
                  <span className="text-muted/50">·</span>
                  <span className="text-muted">{timeAgo(data.createdAt)}</span>
                  {edited && <span className="text-[10px] italic text-muted/70">edited</span>}
                </span>
              )}
            </div>

            {viewer && !data.isDeleted && (
              <Dropdown trigger={<MoreHorizontal className="h-4 w-4" />} className="p-1">
                {!isMine && (
                  <button type="button" className="menu-item" onClick={() => setReportOpen(true)}>
                    <Flag className="h-4 w-4 text-muted" /> Report
                  </button>
                )}
                {isMine && (
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setEditing(true);
                      setEditBody(data.body);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-muted" /> Edit
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="menu-item text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </Dropdown>
            )}
          </div>

          {data.isDeleted ? (
            <p className="mt-1 text-sm italic text-muted/70">This comment is no longer available.</p>
          ) : editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                rows={3}
                maxLength={2000}
                className="input resize-y"
              />
              <div className="flex gap-2">
                <button type="button" className="btn-primary btn-sm" onClick={saveEdit} disabled={busy || !editBody.trim()}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink/90">{data.body}</p>
          )}

          {!data.isDeleted && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
              <button
                type="button"
                onClick={toggleLike}
                disabled={!viewer}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-muted transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-default dark:hover:bg-rose-500/10",
                  data.likedByMe && "text-rose-600",
                )}
                aria-pressed={data.likedByMe}
              >
                <Heart className={cn("h-3.5 w-3.5", data.likedByMe && "fill-current")} />
                {data.likeCount > 0 ? formatCount(data.likeCount) : "Like"}
              </button>

              {viewer && depth < 2 && (
                <button
                  type="button"
                  onClick={() => setReplyOpen((value) => !value)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-muted transition hover:bg-raised hover:text-ink"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Reply
                </button>
              )}

              {data.replies.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowReplies((value) => !value)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  {showReplies ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showReplies ? "Hide" : "Show"} {data.replies.length}{" "}
                  {data.replies.length === 1 ? "reply" : "replies"}
                </button>
              )}
            </div>
          )}

          {replyOpen && (
            <form onSubmit={submitReply} className="mt-3 flex gap-2">
              <Avatar
                name={viewer?.displayName}
                username={viewer?.username}
                src={viewer?.avatarUrl}
                size="xs"
              />
              <div className="min-w-0 flex-1">
                <textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={`Reply to ${data.author?.displayName ?? "this comment"}…`}
                  className="input resize-none text-sm"
                  autoFocus
                />
                <div className="mt-1.5 flex gap-2">
                  <button type="submit" className="btn-primary btn-sm" disabled={busy || !replyBody.trim()}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Reply
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setReplyOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {showReplies && data.replies.length > 0 && (
            <div className="-mx-5 mt-3 divide-y divide-line border-t border-line/70">
              {data.replies.map((reply) => (
                <div key={reply.id} className="-ml-4 pl-4">
                  <CommentItem
                    comment={reply}
                    viewer={viewer}
                    onRefresh={onRefresh}
                    depth={depth + 1}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="comment"
        targetId={data.id}
      />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this comment?"
        description="Replies will stay visible, but your comment will be removed."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}
