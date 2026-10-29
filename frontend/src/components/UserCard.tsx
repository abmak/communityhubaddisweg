import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import type { User } from "../types";
import { api, apiError } from "../lib/api";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { cn, formatCount } from "../lib/utils";
import { tt } from "../lib/i18n";
import { Avatar } from "./ui";

export function FollowButton({
  user,
  onChanged,
  className,
}: {
  user: User;
  onChanged?: (following: boolean, followerCount: number) => void;
  className?: string;
}) {
  const currentUser = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();
  const [following, setFollowing] = useState(Boolean(user.isFollowing));
  const [busy, setBusy] = useState(false);

  if (currentUser?.id === user.id) return null;

  if (!currentUser) {
    return (
      <Link
        to="/login"
        state={{ from: window.location.pathname }}
        className={cn("btn-secondary btn-sm", className)}
      >
        Follow
      </Link>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const response = next
        ? await api.post<{ following: boolean; followerCount: number }>(`/api/users/${user.username}/follow`)
        : await api.delete<{ following: boolean; followerCount: number }>(`/api/users/${user.username}/follow`);
      setFollowing(response.data.following);
      onChanged?.(response.data.following, response.data.followerCount);
    } catch (error) {
      setFollowing(!next);
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={cn(following ? "btn-secondary btn-sm" : "btn-primary btn-sm", className)}
      aria-pressed={following}
    >
      {following ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      {tt(following ? "Following" : "Follow")}
    </button>
  );
}

export function UserCard({ user, variant = "card" }: { user: User; variant?: "card" | "rail" }) {
  const [followerCount, setFollowerCount] = useState(user.followerCount ?? user._count?.followers ?? 0);
  const online = user.online;

  if (variant === "rail") {
    return (
      <div className="flex items-center gap-3 py-2">
        <Link to={`/u/${user.username}`} className="shrink-0">
          <Avatar
            name={user.displayName}
            username={user.username}
            src={user.avatarUrl}
            size="sm"
            online={online}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${user.username}`} className="block truncate text-sm font-semibold text-ink hover:text-brand-700">
            {user.displayName}
          </Link>
          <p className="truncate text-xs text-muted">
            @{user.username}
            {followerCount > 0 && <span className="text-muted/70"> · {formatCount(followerCount)} followers</span>}
          </p>
        </div>
        <FollowButton
          user={user}
          onChanged={(_following, count) => setFollowerCount(count)}
          className="shrink-0"
        />
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/u/${user.username}`} className="flex min-w-0 items-center gap-3">
          <Avatar
            name={user.displayName}
            username={user.username}
            src={user.avatarUrl}
            size="lg"
            online={online}
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{user.displayName}</span>
            <span className="block truncate text-xs text-muted">@{user.username}</span>
            {(user.postCount !== undefined || user._count?.posts !== undefined) && (
              <span className="mt-1 block text-xs text-muted">
                {formatCount(user.postCount ?? user._count?.posts ?? 0)} posts · {formatCount(followerCount)} followers
              </span>
            )}
          </span>
        </Link>
      </div>
      {user.bio && <p className="line-clamp-2 text-sm leading-6 text-muted">{user.bio}</p>}
      <FollowButton user={user} onChanged={(_following, count) => setFollowerCount(count)} className="w-full" />
    </div>
  );
}
