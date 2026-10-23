import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { Post } from "../types";
import { useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { categoryPath, postPath } from "../lib/utils";
import { PageLoader } from "../components/ui";

export function EditPostPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const { data, loading, error } = useQuery<{ post: Post }>(`/api/posts/${id}`);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.post) {
      setTitle(data.post.title ?? "");
      setBody(data.post.body);
    }
  }, [data?.post]);

  if (loading) return <PageLoader label="Opening the editor…" />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">This post could not be loaded.</p>
        <p className="mt-1 text-sm text-muted">{error ?? "It may have been deleted."}</p>
        <Link to="/home" className="btn-primary mt-4">
          Back to the feed
        </Link>
      </div>
    );
  }

  const post = data.post;
  const canEdit =
    user && (user.id === post.authorId || user.role === "ADMIN" || user.role === "MODERATOR");

  if (!canEdit) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">You can only edit your own posts.</p>
        <Link to={postPath(post)} className="btn-primary mt-4">
          Back to the post
        </Link>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) {
      setFormError("Posts cannot be empty.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.patch(`/api/posts/${post.id}`, {
        title: title.trim() || null,
        body: body.trim(),
      });
      pushToast("Post updated.", { tone: "success" });
      navigate(postPath(post));
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <Link to={categoryPath(post.category)} className="text-xs font-medium text-muted hover:text-ink">
          {post.category.name}
        </Link>
      </div>

      <form onSubmit={submit} className="card p-5 sm:p-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Edit your conversation</h1>
        <p className="mt-1 text-sm text-muted">
          You can update the title and text. Attachments stay as they were.
        </p>

        {formError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {formError}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="edit-title" className="label">Title</label>
            <input
              id="edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              className="input"
              placeholder="Optional title"
            />
          </div>
          <div>
            <label htmlFor="edit-body" className="label">Post</label>
            <textarea
              id="edit-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              maxLength={10000}
              className="input resize-y leading-7"
            />
            <p className="mt-1 text-right text-[10px] text-muted">{body.length}/10000</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !body.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
