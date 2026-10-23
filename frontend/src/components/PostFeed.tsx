import type { ReactNode } from "react";
import { AlertTriangle, MessageSquareDashed } from "lucide-react";
import type { Post } from "../types";
import { useInfiniteScroll } from "../hooks/useApi";
import { PostCard } from "./PostCard";
import { EmptyState, PostSkeleton, Spinner } from "./ui";

interface PostFeedProps {
  posts: Post[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  loadMore?: () => void;
  onPostChange?: (post: Post) => void;
  onPostRemove?: (id: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  compact?: boolean;
}

export function PostFeed({
  posts,
  loading,
  loadingMore,
  hasMore,
  error,
  loadMore,
  onPostChange,
  onPostRemove,
  emptyTitle = "No conversations yet",
  emptyDescription = "Be the first to start one — share a thought, a recommendation or a question.",
  emptyAction,
}: PostFeedProps) {
  const sentinelRef = useInfiniteScroll(() => loadMore?.(), Boolean(hasMore && !loading && loadMore));

  if (loading) {
    return (
      <div className="space-y-4">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="card p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h3 className="font-semibold text-ink">We couldn't load this feed</h3>
        <p className="mt-1 text-sm text-muted">{error}</p>
        {loadMore && (
          <button type="button" className="btn-secondary mt-4" onClick={loadMore}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={MessageSquareDashed}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onChange={onPostChange} onRemove={onPostRemove} />
      ))}

      {error && posts.length > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </p>
      )}

      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore ? (
            <Spinner />
          ) : (
            <button type="button" className="btn-secondary" onClick={loadMore}>
              Load more conversations
            </button>
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-muted">
          You've reached the end. Time for another cup of coffee.
        </p>
      )}
    </div>
  );
}
