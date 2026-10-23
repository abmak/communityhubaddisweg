import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import type { User } from "../types";
import { useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { Avatar, Badge, EmptyState, PageLoader } from "../components/ui";
import { FollowButton } from "../components/UserCard";
import { cn, formatCount } from "../lib/utils";

interface FollowListResponse {
  users: User[];
  page: number;
  hasMore: boolean;
}

export function FollowListPage() {
  const { username = "", tab = "followers" } = useParams();
  const viewer = useAuth((state) => state.user);
  const relation = tab === "following" ? "following" : "followers";
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [username, relation]);

  const { data, loading, error } = useQuery<{ user: User }>(`/api/users/${username}`);
  const list = useQuery<FollowListResponse>(`/api/users/${username}/${relation}?page=${page}&limit=20`);

  if (loading) return <PageLoader label="Loading members…" />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">Member not found</p>
        <Link to="/explore" className="btn-primary mt-4">
          Back to explore
        </Link>
      </div>
    );
  }

  const user = data.user;
  const isMe = viewer?.id === user.id;
  const users = list.data?.users ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to={`/u/${user.username}`} className="btn-ghost btn-sm">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {isMe ? "your profile" : user.displayName}
      </Link>

      <header className="flex items-center gap-3">
        <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="md" />
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            {isMe ? "Your community" : `${user.displayName}'s community`}
          </h1>
          <p className="text-xs text-muted">@{user.username}</p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-line">
        {(["followers", "following"] as const).map((option) => (
          <Link
            key={option}
            to={`/u/${user.username}/${option}`}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium capitalize transition",
              relation === option
                ? "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-700"
                : "text-muted hover:text-ink",
            )}
          >
            {option}
            {option === "followers" && (
              <span className="ml-1.5 text-xs text-muted">
                {formatCount(user._count?.followers ?? 0)}
              </span>
            )}
            {option === "following" && (
              <span className="ml-1.5 text-xs text-muted">
                {formatCount(user._count?.following ?? 0)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {list.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : list.error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{list.error}</div>
      ) : users.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={relation === "followers" ? "No followers yet" : "Not following anyone yet"}
            description={
              relation === "followers"
                ? "When people follow this profile, they'll show up here."
                : "Follow a few members from Explore to build your feed."
            }
            action={
              relation === "following" ? (
                <Link to="/explore" className="btn-primary btn-sm">
                  Find people
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {users.map((member) => (
            <div key={member.id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/u/${member.username}`} className="shrink-0">
                <Avatar
                  name={member.displayName}
                  username={member.username}
                  src={member.avatarUrl}
                  size="md"
                  online={member.online}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/u/${member.username}`} className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-ink hover:text-brand-700">
                    {member.displayName}
                  </span>
                  {member.role === "ADMIN" && <Badge tone="danger">Admin</Badge>}
                </Link>
                <p className="truncate text-xs text-muted">@{member.username}</p>
                {member.bio && <p className="mt-0.5 line-clamp-1 text-xs text-muted/80">{member.bio}</p>}
              </div>
              {viewer?.id !== member.id && <FollowButton user={member} className="shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {users.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-xs text-muted">Page {page}</span>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={!list.data?.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
