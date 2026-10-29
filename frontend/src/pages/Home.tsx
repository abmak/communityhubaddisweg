import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenSquare, Sparkles } from "lucide-react";
import type { Category } from "../types";
import { useAuth } from "../store/auth";
import { usePaginatedPosts, useQuery } from "../hooks/useApi";
import { categoryIcon, categoryPath, cn } from "../lib/utils";
import { amharicGreeting, categoryAmharic, localizedCategoryName, oromoGreeting, tigrinyaGreeting } from "../lib/brand";
import { tt } from "../lib/i18n";
import { useTranslation } from "../store/i18n";
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
  const { lang, t } = useTranslation();
  const categories = categoryData?.categories ?? [];
  const greeting =
    lang === "ti" ? tigrinyaGreeting() : lang === "om" ? oromoGreeting() : amharicGreeting();

  return (
    <div className="space-y-5">
      <header className="panel px-5 py-6 sm:px-7 sm:py-7">
        <span aria-hidden="true" className="app-grid absolute inset-0 opacity-50" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
              </span>
              <span lang="am" className="font-ethiopic text-[13px] normal-case tracking-normal text-brand-800 dark:text-brand-300">
                {greeting}
                {user ? "," : ""}
              </span>
              {user && <span className="normal-case tracking-normal text-ink">{user.displayName.split(" ")[0]}</span>}
              <span className="text-muted/40">·</span>
              <span>Addis Gebeta</span>
            </p>
            <h1 className="mt-2.5 font-display text-[1.65rem] font-semibold leading-tight tracking-tight text-ink sm:text-[1.9rem]">
              እንኳን ደህና መጡ — pull up a chair.
            </h1>
            <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted">
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
              <PenSquare className="h-3.5 w-3.5" /> {user ? tt("Post") : tt("Join")}
            </Link>
          </div>
        </div>
        <span aria-hidden="true" className="eth-band absolute inset-x-0 bottom-0 h-0.5 opacity-70" />
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
              const roomName = localizedCategoryName(category, lang);
              return (
                <Link
                  key={category.id}
                  to={categoryPath(category)}              className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,20,0.04)] transition hover:-translate-y-0.5 hover:border-brand-500/35 hover:shadow-soft">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${category.color}14`, color: category.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold leading-tight text-ink">
                      {roomName}
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

      <div className="flex items-center justify-between gap-3">
        <div
          className="no-scrollbar inline-flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(16,24,20,0.04)]"
          role="tablist"
          aria-label="Feed sorting"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
                tab === item.id
                  ? "bg-raised text-ink shadow-[0_1px_2px_rgba(16,24,20,0.06),inset_0_0_0_1px_rgba(16,24,20,0.04)]"
                  : "text-muted hover:bg-raised/60 hover:text-ink",
              )}
            >
              {tt(item.label)}
              <span lang="am" className="ml-1.5 hidden font-ethiopic text-[10px] text-muted/70 sm:inline">
                {item.amharic}
              </span>
            </button>
          ))}
        </div>
        <Badge tone="brand" className="hidden shrink-0 sm:inline-flex">
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
