import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  PenSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { User } from "../types";
import { usePaginatedPosts, useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { api, apiError } from "../lib/api";
import { useUI } from "../store/ui";
import { cn, formatCount, monthYear, timeAgo } from "../lib/utils";
import { Avatar, Badge, PageLoader } from "../components/ui";
import { SafeImage } from "../components/Media";
import { PostFeed } from "../components/PostFeed";
import { FollowButton } from "../components/UserCard";

export function ProfilePage() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const [followers, setFollowers] = useState<number | null>(null);
  const [messageBusy, setMessageBusy] = useState(false);

  const { data, loading, error } = useQuery<{ user: User }>(`/api/users/${username}`);
  const feed = usePaginatedPosts(`/api/users/${username}/posts`, {}, 10);

  useEffect(() => {
    if (data?.user) document.title = `${data.user.displayName} (@${data.user.username}) · አዲስ ገበታ`;
    return () => {
      document.title = "አዲስ ገበታ · Addis Gebeta — a new table, shared stories";
    };
  }, [data?.user]);

  if (loading) return <PageLoader label="Loading profile…" />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">We couldn't find that member.</p>
        <p className="mt-1 text-sm text-muted">{error ?? "The profile may have been removed."}</p>
        <Link to="/explore" className="btn-primary mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to explore
        </Link>
      </div>
    );
  }

  const user = data.user;
  const isMe = currentUser?.id === user.id;
  const followerCount = followers ?? user._count?.followers ?? user.followerCount ?? 0;
  const postCount = user._count?.posts ?? user.postCount ?? 0;

  const startConversation = async () => {
    if (!currentUser) {
      navigate("/login", { state: { from: `/u/${user.username}` } });
      return;
    }
    setMessageBusy(true);
    try {
      const response = await api.post<{ conversation: { id: string } }>("/api/conversations", {
        userId: user.id,
      });
      navigate(`/messages/${response.data.conversation.id}`);
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setMessageBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="relative h-36 bg-gradient-to-br from-brand-800 via-brand-600 to-emerald-400 sm:h-52">
          {user.coverUrl && (
            <SafeImage src={user.coverUrl} alt={`${user.displayName}'s cover`} className="h-full w-full opacity-90" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        <div className="px-5 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="-mt-12 flex items-end gap-4 sm:-mt-14">
              <Avatar
                name={user.displayName}
                username={user.username}
                src={user.avatarUrl}
                size="hero"
                className="ring-4 ring-surface"
                online={user.online}
              />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
                    {user.displayName}
                  </h1>
                  {user.role === "ADMIN" && (
                    <Badge tone="danger">
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </Badge>
                  )}
                  {user.role === "MODERATOR" && (
                    <Badge tone="brand">
                      <ShieldCheck className="h-3 w-3" /> Moderator
                    </Badge>
                  )}
                  {user.online && <Badge tone="brand">Online</Badge>}
                </div>
                <p className="text-sm text-muted">@{user.username}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              {isMe ? (
                <>
                  <Link to="/settings" className="btn-secondary btn-sm">
                    <Settings className="h-3.5 w-3.5" /> Edit profile
                  </Link>
                  <Link to="/create" className="btn-primary btn-sm">
                    <PenSquare className="h-3.5 w-3.5" /> New post
                  </Link>
                </>
              ) : (
                <>
                  <FollowButton
                    user={{ ...user, isFollowing: user.isFollowing }}
                    onChanged={(_following, count) => setFollowers(count)}
                  />
                  <button
                    type="button"
                    onClick={startConversation}
                    className="btn-secondary btn-sm"
                    disabled={messageBusy}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Message
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3.5 space-y-3">
            {user.bio && <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-ink/85">{user.bio}</p>}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              {user.createdAt && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Joined {monthYear(user.createdAt)}
                </span>
              )}
              {user.lastSeenAt && !user.online && (
                <span>Active {timeAgo(user.lastSeenAt)} ago</span>
              )}
              {user.phoneVerifiedAt && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Phone verified
                </span>
              )}
            </div>

            {(user.interests ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {user.interests?.map((interest) => (
                  <span key={interest} className="chip cursor-default">
                    {interest}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-5 border-t border-line pt-3 text-sm">
              <span>
                <strong className="font-semibold text-ink">{formatCount(postCount)}</strong>{" "}
                <span className="text-muted">posts</span>
              </span>
              <Link to={`/u/${user.username}/followers`} className="hover:text-ink">
                <strong className="font-semibold text-ink">{formatCount(followerCount)}</strong>{" "}
                <span className="text-muted">followers</span>
              </Link>
              <Link to={`/u/${user.username}/following`} className="hover:text-ink">
                <strong className="font-semibold text-ink">
                  {formatCount(user._count?.following ?? 0)}
                </strong>{" "}
                <span className="text-muted">following</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-line">
        <span className="relative px-3 py-2.5 text-sm font-semibold text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-700">
          {isMe ? "Your posts" : "Posts"}
        </span>
        {!isMe && (
          <Link
            to={`/u/${user.username}/followers`}
            className="px-3 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
          >
            Community
          </Link>
        )}
      </div>

      <PostFeed
        posts={feed.posts}
        loading={feed.loading}
        loadingMore={feed.loadingMore}
        hasMore={feed.hasMore}
        error={feed.error}
        loadMore={feed.loadMore}
        onPostChange={(updated) =>
          feed.setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)))
        }
        onPostRemove={(id) => feed.setPosts((current) => current.filter((post) => post.id !== id))}
        emptyTitle={isMe ? "You haven't posted yet" : `${user.displayName.split(" ")[0]} hasn't posted yet`}
        emptyDescription={
          isMe
            ? "Start a conversation — share what you're reading, watching or planning."
            : "Once they share something, it will appear here."
        }
        emptyAction={
          isMe ? (
            <Link to="/create" className={cn("btn-primary btn-sm")}>
              <PenSquare className="h-3.5 w-3.5" /> Write your first post
            </Link>
          ) : undefined
        }
      />

    </div>
  );
}
