import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Megaphone, Send } from "lucide-react";
import { api, apiError } from "../../lib/api";
import { useQuery } from "../../hooks/useApi";
import { useUI } from "../../store/ui";
import { postPath, timeAgo } from "../../lib/utils";
import type { Post } from "../../types";
import { Badge } from "../../components/ui";
import { useAdminAccess } from "./AdminLayout";
import { AdminPageHeader, Panel } from "./parts";

export function AdminAnnouncements() {
  const { permissions } = useAdminAccess();
  const canPublish = permissions.includes("admin.announcements.publish");
  const pushToast = useUI((state) => state.pushToast);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useQuery<{ posts: Post[] }>("/api/posts?category=whats-new&sort=latest&limit=6");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.post<{ post: Post; notified: number }>("/api/admin/announcements", {
        title: title.trim(),
        body: body.trim(),
      });
      pushToast(`Announcement published to ${response.data.notified} members.`, { tone: "success" });
      setTitle("");
      setBody("");
      history.refetch();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Platform"
        title="Announcements."
        description="A single message to every member: it publishes to What's New and drops a notification into each inbox. Use it for outages, policy changes and community moments."
        actions={<Badge tone="brand"><Megaphone className="h-3 w-3" /> Broadcast</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Panel title="Compose" description="Keep it short, concrete and kind.">
          {canPublish ? (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label htmlFor="announcement-title" className="label">
                  Title
                </label>
                <input
                  id="announcement-title"
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  minLength={3}
                  required
                  placeholder="e.g. Coffee meetup this Saturday"
                />
                <p className="mt-1 text-right text-[10px] text-muted">{title.length}/120</p>
              </div>
              <div>
                <label htmlFor="announcement-body" className="label">
                  Message
                </label>
                <textarea
                  id="announcement-body"
                  className="input resize-y"
                  rows={7}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={4000}
                  minLength={5}
                  required
                  placeholder="What is happening, where, and what should members do?"
                />
                <p className="mt-1 text-right text-[10px] text-muted">{body.length}/4000</p>
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish to everyone
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted">
              Your role can read announcements but not publish them. Ask an administrator for the
              <span className="font-mono text-[10px]"> admin.announcements.publish </span>
              capability.
            </p>
          )}
        </Panel>

        <Panel
          title="Recently sent"
          description="The newest posts in What's New."
          action={
            <Link to="/c/whats-new" className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Open room
            </Link>
          }
        >
          <div className="divide-y divide-line">
            {history.data?.posts.map((post) => (
              <Link key={post.id} to={postPath(post)} className="block py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-ink hover:text-brand-700">{post.title ?? "Untitled"}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">{post.body}</p>
                <p className="mt-1 text-[10px] text-muted/80">
                  {timeAgo(post.createdAt)} · by {post.author.displayName}
                </p>
              </Link>
            ))}
            {history.data?.posts.length === 0 && (
              <p className="py-4 text-sm text-muted">No announcements yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
