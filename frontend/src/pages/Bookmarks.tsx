import { Link } from "react-router-dom";
import { Bookmark, Compass } from "lucide-react";
import { usePaginatedPosts } from "../hooks/useApi";
import { PostFeed } from "../components/PostFeed";

export function BookmarksPage() {
  const feed = usePaginatedPosts("/api/bookmarks", {}, 10);

  return (
    <div className="space-y-5">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
          <Bookmark className="h-3.5 w-3.5" /> Saved for later
          <span lang="am" className="font-ethiopic normal-case tracking-normal text-muted">
            የተቀመጡ
          </span>
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          Your bookmarks.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Films to watch, books to find and trails to plan. Only you can see this list.
        </p>
      </header>

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
        emptyTitle="Nothing saved yet"
        emptyDescription="Tap the bookmark icon on any post and it will wait for you here."
        emptyAction={
          <Link to="/explore" className="btn-primary btn-sm">
            <Compass className="h-3.5 w-3.5" /> Find something worth saving
          </Link>
        }
      />
    </div>
  );
}
