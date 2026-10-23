import { useCallback, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Post } from "../types";
import { useQuery } from "../hooks/useApi";
import { categoryPath, formatCount } from "../lib/utils";
import { PostCard } from "../components/PostCard";
import { CommentThread } from "../components/CommentThread";
import { PageLoader } from "../components/ui";

export function PostDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, setData } = useQuery<{ post: Post }>(`/api/posts/${id}`);

  const updatePost = useCallback(
    (updated: Post) => setData({ post: updated }),
    [setData],
  );

  const handleCommentCount = useCallback(
    (count: number) =>
      setData((current) =>
        current ? { post: { ...current.post, commentCount: count } } : current,
      ),
    [setData],
  );

  useEffect(() => {
    if (data?.post) {
      document.title = `${data.post.title ?? "Conversation"} · አዲስ ወግ`;
    }
    return () => {
      document.title = "አዲስ ወግ · Addis Weg — a new way, shared stories";
    };
  }, [data?.post]);

  if (loading) return <PageLoader label="Opening the conversation…" />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">This conversation isn't here.</p>
        <p className="mt-1 text-sm text-muted">{error ?? "It may have been deleted by its author."}</p>
        <Link to="/home" className="btn-primary mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to the feed
        </Link>
      </div>
    );
  }

  const post = data.post;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-3 text-xs text-muted">
          <Link to={categoryPath(post.category)} className="font-medium hover:text-ink">
            {post.category.name}
          </Link>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> {formatCount(post.commentCount)} comments
          </span>
        </div>
      </div>

      <PostCard
        post={post}
        detail
        onChange={updatePost}
        onRemove={() => navigate("/home")}
      />

      <CommentThread postId={post.id} onCountChange={handleCommentCount} />
    </div>
  );
}
