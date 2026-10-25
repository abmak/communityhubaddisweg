import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Clapperboard,
  Eye,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Mountain,
  Pencil,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import type { Post } from "../types";
import { api, apiError } from "../lib/api";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import {
  categoryIcon,
  categoryPath,
  cn,
  copyToClipboard,
  difficultyStyles,
  formatCount,
  postPath,
  timeAgo,
} from "../lib/utils";
import { Avatar, ConfirmDialog, Dropdown } from "./ui";
import { MediaAttachments, SafeImage } from "./Media";
import { PollCard } from "./PollCard";
import { ReportDialog } from "./ReportDialog";

interface PostCardProps {
  post: Post;
  onChange?: (post: Post) => void;
  onRemove?: (id: string) => void;
  detail?: boolean;
}

export function PostCard({ post, onChange, onRemove, detail }: PostCardProps) {
  const currentUser = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  const [data, setData] = useState(post);
  const [expanded, setExpanded] = useState(Boolean(detail));
  const [likeBusy, setLikeBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => setData(post), [post]);

  const update = (patch: Partial<Post>) => {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  };

  const canManage =
    currentUser &&
    (currentUser.id === data.authorId ||
      currentUser.role === "ADMIN" ||
      currentUser.role === "MODERATOR");

  const requireAuth = () => {
    if (currentUser) return true;
    navigate("/login", { state: { from: window.location.pathname } });
    return false;
  };

  const handleLike = async () => {
    if (!requireAuth() || likeBusy) return;
    setLikeBusy(true);
    const nextLiked = !data.likedByMe;
    update({
      likedByMe: nextLiked,
      likeCount: Math.max(0, data.likeCount + (nextLiked ? 1 : -1)),
    });
    try {
      const response = nextLiked
        ? await api.post<{ liked: boolean; likeCount: number }>(`/api/posts/${data.id}/like`)
        : await api.delete<{ liked: boolean; likeCount: number }>(`/api/posts/${data.id}/like`);
      update({ likedByMe: response.data.liked, likeCount: response.data.likeCount });
    } catch (error) {
      update({
        likedByMe: data.likedByMe,
        likeCount: data.likeCount,
      });
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setLikeBusy(false);
    }
  };

  const handleBookmark = async () => {
    if (!requireAuth() || bookmarkBusy) return;
    setBookmarkBusy(true);
    const next = !data.bookmarkedByMe;
    update({
      bookmarkedByMe: next,
      bookmarkCount: Math.max(0, data.bookmarkCount + (next ? 1 : -1)),
    });
    try {
      if (next) await api.post(`/api/posts/${data.id}/bookmark`);
      else await api.delete(`/api/posts/${data.id}/bookmark`);
      pushToast(next ? "Saved to your bookmarks" : "Removed from bookmarks", {
        tone: next ? "success" : "default",
        href: next ? "/bookmarks" : undefined,
      });
    } catch (error) {
      update({ bookmarkedByMe: data.bookmarkedByMe, bookmarkCount: data.bookmarkCount });
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBookmarkBusy(false);
    }
  };

  const handleShare = async () => {
    const path = postPath(data);
    const url = `${window.location.origin}${path}`;
    try {
      const response = await api.post<{ shareCount: number }>(`/api/posts/${data.id}/share`);
      update({ shareCount: response.data.shareCount });
    } catch {
      // Sharing should still copy even if analytics fail.
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title ?? "Post on አዲስ ገበታ",
          text: data.title ?? undefined,
          url,
        });
        return;
      } catch {
        // User cancelled — fall back to copying.
      }
    }

    const copied = await copyToClipboard(url);
    pushToast(copied ? "Link copied to clipboard" : "Could not copy the link", {
      tone: copied ? "success" : "error",
    });
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.delete(`/api/posts/${data.id}`);
      pushToast("Post deleted.", { tone: "success" });
      setConfirmOpen(false);
      if (onRemove) onRemove(data.id);
      else navigate("/home");
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const CategoryIcon = categoryIcon(data.category.icon);
  const path = postPath(data);
  const isLong = data.body.length > 420;

  return (
    <article className="card overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={`/u/${data.author.username}`} aria-label={`View ${data.author.displayName}'s profile`}>
              <Avatar
                name={data.author.displayName}
                username={data.author.username}
                src={data.author.avatarUrl}
                size="md"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                <Link
                  to={`/u/${data.author.username}`}
                  className="truncate font-semibold text-ink hover:text-brand-700"
                >
                  {data.author.displayName}
                </Link>
                <span className="truncate text-muted">@{data.author.username}</span>
                <span className="text-muted/50">·</span>
                <Link to={path} className="shrink-0 text-muted transition hover:text-ink">
                  {timeAgo(data.createdAt)}
                </Link>
              </div>
              <Link
                to={categoryPath(data.category)}
                className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: data.category.color }}
              >
                <CategoryIcon className="h-3.5 w-3.5" />
                {data.category.name}
              </Link>
            </div>
          </div>

          <Dropdown trigger={<MoreHorizontal className="h-5 w-5" />} className="p-1">
            <button type="button" className="menu-item" onClick={handleShare}>
              <Link2 className="h-4 w-4 text-muted" /> Copy link
            </button>
            {currentUser && currentUser.id !== data.authorId && (
              <button type="button" className="menu-item" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4 text-muted" /> Report post
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className="menu-item"
                onClick={() => navigate(`/posts/${data.id}/edit`)}
              >
                <Pencil className="h-4 w-4 text-muted" /> Edit post
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className="menu-item text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete post
              </button>
            )}
          </Dropdown>
        </div>

        <div className="mt-3 sm:pl-[56px]">
          {data.title && (
            <Link to={path} className="block">
              <h3 className="mb-1.5 font-display text-lg font-semibold leading-snug text-ink transition hover:text-brand-700 sm:text-xl">
                {data.title}
              </h3>
            </Link>
          )}

          {data.body && (
            <div className={cn(!expanded && "line-clamp-5")}>
              <p className="post-body">{data.body}</p>
            </div>
          )}
          {isLong && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              Read more
            </button>
          )}
        </div>

        {(data.movie || data.book || data.hike) && (
          <div className="mt-3 sm:pl-[56px]">
            <SpecialDetailCard post={data} />
          </div>
        )}

        {data.poll && (
          <div className="mt-3 sm:pl-[56px]">
            <PollCard
              postId={data.id}
              poll={data.poll}
              onChange={(poll) => update({ poll })}
            />
          </div>
        )}

        {data.media.length > 0 && (
          <div className="mt-3 sm:pl-[56px]">
            <MediaAttachments media={data.media} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 border-t border-line px-2 py-1.5 sm:px-4">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleLike}
            disabled={likeBusy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10",
              data.likedByMe && "text-rose-600",
            )}
            aria-pressed={data.likedByMe}
            aria-label={data.likedByMe ? "Unlike post" : "Like post"}
          >
            <Heart className={cn("h-[18px] w-[18px]", data.likedByMe && "fill-current")} />
            <span className="tabular-nums">{formatCount(data.likeCount)}</span>
          </button>

          <Link
            to={`${path}#comments`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10"
            aria-label="View comments"
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            <span className="tabular-nums">{formatCount(data.commentCount)}</span>
          </Link>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition hover:bg-raised hover:text-ink"
            aria-label="Share post"
          >
            <Share2 className="h-[18px] w-[18px]" />
            <span className="hidden tabular-nums sm:inline">{formatCount(data.shareCount)}</span>
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <span className="mr-1 hidden items-center gap-1 text-xs text-muted/80 sm:flex">
            <Eye className="h-3.5 w-3.5" /> {formatCount(data.viewCount)}
          </span>
          <button
            type="button"
            onClick={handleBookmark}
            disabled={bookmarkBusy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10",
              data.bookmarkedByMe && "text-amber-600",
            )}
            aria-pressed={data.bookmarkedByMe}
            aria-label={data.bookmarkedByMe ? "Remove bookmark" : "Bookmark post"}
          >
            {data.bookmarkedByMe ? (
              <BookmarkCheck className="h-[18px] w-[18px] fill-current" />
            ) : (
              <Bookmark className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={data.id}
      />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this post?"
        description="This removes the post, its comments and any uploaded media. It cannot be undone."
        busy={deleteBusy}
        onConfirm={handleDelete}
      />
    </article>
  );
}

function SpecialDetailCard({ post }: { post: Post }) {
  const path = postPath(post);

  if (post.movie) {
    return (
      <Link
        to={path}
        className="group flex items-center gap-3 rounded-xl border border-line bg-raised p-2.5 transition hover:border-brand-300"
      >
        <SafeImage
          src={post.movie.posterUrl}
          alt={post.movie.movieTitle}
          className="h-20 w-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
            <Clapperboard className="h-3 w-3" /> Ethiopian cinema
          </p>
          <p className="truncate font-display text-base font-semibold text-ink">
            {post.movie.movieTitle}
          </p>
          <p className="truncate text-xs text-muted">
            {[post.movie.director, post.movie.year].filter(Boolean).join(" · ") || "Film discussion"}
          </p>
          {post.ratingAvg !== null && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-current" />
              {post.ratingAvg}/10
              <span className="font-normal text-muted">({post.reviewCount})</span>
            </p>
          )}
        </div>
      </Link>
    );
  }

  if (post.book) {
    return (
      <Link
        to={path}
        className="group flex items-center gap-3 rounded-xl border border-line bg-raised p-2.5 transition hover:border-brand-300"
      >
        <SafeImage
          src={post.book.coverUrl}
          alt={post.book.bookTitle}
          className="h-20 w-14 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
            <BookOpen className="h-3 w-3" /> Book review
          </p>
          <p className="truncate font-display text-base font-semibold text-ink">{post.book.bookTitle}</p>
          <p className="truncate text-xs text-muted">{post.book.author || "Reader discussion"}</p>
          {post.ratingAvg !== null && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-current" />
              {post.ratingAvg}/5
              <span className="font-normal text-muted">({post.reviewCount})</span>
            </p>
          )}
        </div>
      </Link>
    );
  }

  if (post.hike) {
    return (
      <Link
        to={path}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised px-3 py-2.5 transition hover:border-brand-300"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Mountain className="h-4 w-4 text-emerald-600" />
          {post.hike.location}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
              difficultyStyles[post.hike.difficulty],
            )}
          >
            {post.hike.difficulty}
          </span>
          {post.hike.distanceKm ? `${post.hike.distanceKm} km` : null}
          {post.hike.durationHours ? `${post.hike.durationHours} h` : null}
        </span>
      </Link>
    );
  }

  return null;
}
