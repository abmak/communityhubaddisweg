import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenSquare, Sparkles } from "lucide-react";
import type { Category } from "../types";
import { useAuth } from "../store/auth";
import { usePaginatedPosts, useQuery } from "../hooks/useApi";
import { categoryIcon, categoryPath, cn } from "../lib/utils";
import { amharicGreeting, categoryAmharic } from "../lib/brand";
import { Badge } from "../components/ui";
import { PostFeed } from "../components/PostFeed";
import { PostComposer } from "../components/PostComposer";

const TABS = [
  { id: "for-you", label: "For you", amharic: "ለእርስዎ" },
  { id: "following", label: "Following", amharic: "የሚከተሏቸው" },
  { id: "latest", label: "Latest", amharic: "አዲስ" },
  { id: "popular", label: "Popular", amharic: "ተወዳጅ" },
  { id: "trending", label: "Trending", amharic: "ሞቃት" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function HomePage() {
  const user = useAuth((state) => state.user);
  const { data: categoryData } = useQuery<{ categories: Category[] }>("/api/categories");
  const [tab, setTab] = useState<TabId>("for-you");

  const params =
    tab === "following"
      ? { feed: "following" }
      : tab === "popular"
        ? { sort: "popular" }
        : tab === "trending"
          ? { sort: "trending" }
          : tab === "latest"
            ? { sort: "latest" }
            : {};

  const feed = usePaginatedPosts("/api/posts", params);
  const categories = categoryData?.categories ?? [];
  const greeting = amharicGreeting();

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface px-5 py-6 shadow-card sm:px-7 sm:py-7">
        <span aria-hidden="true" className="eth-hero-glow absolute inset-0" />
        <span aria-hidden="true" className="tilet-strip absolute inset-y-0 right-0 w-16 opacity-35 sm:w-40" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <span lang="am" className="font-ethiopic text-base">
                {greeting}
                {user ? "," : ""}
              </span>
              {user && <span className="text-muted">{user.displayName.split(" ")[0]}</span>}
              <span className="text-muted/50">·</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Addis Weg</span>
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
              እንኳን ደህና መጡ — pull up a chair.
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              Coffee-table talk, cinema, books, trails and the stories happening across the
              community today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Link to="/explore" className="btn-secondary btn-sm">
                <Sparkles className="h-3.5 w-3.5" /> Discovery
              </Link>
            )}
            <Link to={user ? "/create" : "/register"} className="btn-primary btn-sm">
              <PenSquare className="h-3.5 w-3.5" /> {user ? "Post" : "Join"}
            </Link>
          </div>
        </div>
        <span className="eth-band absolute inset-x-0 bottom-0 h-[3px]" />
      </header>

      {categories.length > 0 && (
        <section aria-label="Community rooms">
          <div className="mb-2 flex items-center justify-between">
            <p className="kicker">Community rooms · ምድቦች</p>
            <Link
              to="/categories"
              className="text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              All rooms
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon);
              const amharic = categoryAmharic(category.slug);
              return (
                <Link
                  key={category.id}
                  to={categoryPath(category)}
                  className="group inline-flex shrink-0 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400/50 hover:shadow-card"
                >
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${category.color}18`, color: category.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold leading-tight text-ink">
                      {category.name}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {amharic ? `${amharic} · ` : ""}
                      {category.postCount ?? 0}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <PostComposer onCreated={feed.refetch} />

      <div className="flex items-center justify-between gap-3 border-b border-line">
        <div className="no-scrollbar flex gap-1 overflow-x-auto" role="tablist" aria-label="Feed sorting">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-sm font-medium transition",
                tab === item.id
                  ? "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-700"
                  : "text-muted hover:text-ink",
              )}
            >
              {item.label}
              <span lang="am" className="ml-1.5 hidden font-ethiopic text-[10px] text-muted/70 sm:inline">
                {item.amharic}
              </span>
            </button>
          ))}
        </div>
        <Badge tone="brand" className="hidden sm:inline-flex">
          <span className="mr-1 inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
          Live
        </Badge>
      </div>

      {tab === "following" && !user ? (
        <div className="card p-6 text-center">
          <p className="font-display text-lg font-semibold text-ink">Sign in to see your following feed</p>
          <p className="mt-1 text-sm text-muted">
            Follow members and their conversations will appear here.
          </p>
          <Link to="/login" className="btn-primary mt-4">
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
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
          emptyTitle={tab === "following" ? "Your following feed is quiet" : "No stories yet"}
          emptyDescription={
            tab === "following"
              ? "Follow a few members from Explore and their posts will show up here."
              : "Start the first conversation — ask a question, share a recommendation, or tell a story."
          }
          emptyAction={
            tab === "following" ? (
              <Link to="/explore" className="btn-primary btn-sm">
                Find people to follow
              </Link>
            ) : user ? (
              <Link to="/create" className="btn-primary btn-sm">
                <PenSquare className="h-3.5 w-3.5" /> Start a conversation
              </Link>
            ) : (
              <Link to="/register" className="btn-primary btn-sm">
                Join the community
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
