import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  Compass,
  Flame,
  Mountain,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ExploreData, Post } from "../types";
import { useQuery } from "../hooks/useApi";
import { Avatar, Badge, PageLoader, SectionHeading } from "../components/ui";
import { CategoryCard } from "../components/CategoryCard";
import { SafeImage } from "../components/Media";
import { FollowButton } from "../components/UserCard";
import { formatCount, postPath, timeAgo } from "../lib/utils";

function FilmTile({ post }: { post: Post }) {
  return (
    <Link to={postPath(post)} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[3/4] overflow-hidden bg-raised">
        <SafeImage
          src={post.movie?.posterUrl}
          alt={post.movie?.movieTitle ?? "Film"}
          className="h-full w-full transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 text-white">
          <p className="font-display text-sm font-semibold leading-snug">
            {post.movie?.movieTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-white/65">
            {[post.movie?.director, post.movie?.year].filter(Boolean).join(" · ")}
          </p>
        </div>
        {post.ratingAvg !== null && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-amber-300 backdrop-blur">
            <Star className="h-3 w-3 fill-current" /> {post.ratingAvg}/10
          </span>
        )}
      </div>
    </Link>
  );
}

function BookTile({ post }: { post: Post }) {
  return (
    <Link to={postPath(post)} className="card group flex gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-lift">
      <SafeImage
        src={post.book?.coverUrl}
        alt={post.book?.bookTitle ?? "Book"}
        className="h-24 w-[68px] shrink-0 rounded-lg"
      />
      <div className="min-w-0 py-0.5">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
          <BookOpen className="h-3 w-3" /> Review
        </p>
        <p className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug text-ink">
          {post.book?.bookTitle}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{post.book?.author}</p>
        {post.ratingAvg !== null && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
            <Star className="h-3 w-3 fill-current" /> {post.ratingAvg}/5
            <span className="font-normal text-muted">({post.reviewCount})</span>
          </p>
        )}
      </div>
    </Link>
  );
}

export function ExplorePage() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const { data, loading, error } = useQuery<ExploreData>("/api/explore");

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (term.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  if (loading) return <PageLoader label="Gathering what's happening…" />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">Discovery is taking a short break.</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-9 text-white sm:px-9">
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-20 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl"
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">
            <Compass className="h-3.5 w-3.5" /> Discovery
            <span lang="am" className="font-ethiopic normal-case tracking-normal text-accent-200">
              ዳሰሳ
            </span>
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            Follow your curiosity, not an algorithm.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            A live look at what the community is watching, reading and climbing this week.
          </p>

          <form onSubmit={search} className="mt-6 flex max-w-xl items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search everything</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search films, books, trails, people…"
                className="h-11 w-full rounded-xl border border-white/15 bg-white/10 pl-10 pr-3 text-sm text-white placeholder:text-white/45 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </label>
            <button type="submit" className="btn bg-white px-4 py-2.5 text-brand-900 hover:bg-brand-50">
              Search
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {formatCount(data.stats.members)} members
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> {formatCount(data.stats.posts)} conversations
            </span>
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" /> {data.stats.categories} community rooms
            </span>
          </div>
        </div>
      </header>

      <section>
        <SectionHeading
          title="Trending discussions"
          subtitle="Recency-weighted, so new conversations can rise."
          action={
            <Badge tone="accent">
              <Flame className="h-3 w-3" /> This week
            </Badge>
          }
        />
        {data.trending.length === 0 ? (
          <div className="card p-6 text-sm text-muted">No trending conversations yet.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.trending.map((post, index) => (
              <Link
                key={post.id}
                to={postPath(post)}
                className="card group flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="font-display text-2xl font-semibold text-brand-700/25 dark:text-brand-200/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: post.category.color }}>
                    {post.category.name}
                  </p>
                  <p className="mt-1 line-clamp-2 font-display text-base font-semibold leading-snug text-ink transition group-hover:text-brand-700">
                    {post.title || post.body}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">
                    {post.author.displayName} · {timeAgo(post.createdAt)} · {post.likeCount} likes ·{" "}
                    {post.commentCount} replies
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Community rooms"
          subtitle="Eleven places to start, each with its own regulars."
          action={
            <Link to="/categories" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              All categories
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.categories.map((category) => (
            <CategoryCard key={category.id} category={category} compact />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="In Ethiopian cinema"
          subtitle="What everyone is watching and arguing about."
          action={
            <Link to="/cinema" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              All films
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.movies.map((post) => (
            <FilmTile key={post.id} post={post} />
          ))}
        </div>
        {data.movies.length === 0 && (
          <div className="card p-6 text-sm text-muted">No film discussions yet.</div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading
            title="From the bookshelf"
            subtitle="Reviews worth adding to your list."
            action={
              <Link to="/books" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                All books
              </Link>
            }
          />
          <div className="space-y-3">
            {data.books.map((post) => (
              <BookTile key={post.id} post={post} />
            ))}
            {data.books.length === 0 && (
              <div className="card p-6 text-sm text-muted">No book reviews yet.</div>
            )}
          </div>
        </section>

        <section>
          <SectionHeading
            title="On the trail"
            subtitle="Field notes from the mountains."
            action={
              <Link to="/hiking" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                All trails
              </Link>
            }
          />
          <div className="space-y-3">
            {data.hikes.slice(0, 3).map((post) => (
              <Link
                key={post.id}
                to={postPath(post)}
                className="card group flex gap-3 overflow-hidden p-3 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <SafeImage
                  src={post.media[0]?.thumbnailUrl ?? post.media[0]?.url}
                  alt={post.hike?.location ?? "Trail"}
                  className="h-20 w-24 shrink-0 rounded-lg"
                />
                <div className="min-w-0 py-0.5">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                    <Mountain className="h-3 w-3" /> {post.hike?.difficulty}
                  </p>
                  <p className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug text-ink">
                    {post.title || post.hike?.location}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted">
                    {post.hike?.location} · {post.hike?.distanceKm} km
                  </p>
                </div>
              </Link>
            ))}
            {data.hikes.length === 0 && (
              <div className="card p-6 text-sm text-muted">No trail stories yet.</div>
            )}
          </div>
        </section>
      </div>

      <section>
        <SectionHeading
          title="People you might like"
          subtitle="Members who are active in the rooms you care about."
          action={
            <Link to="/search?type=members" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Find members
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.suggestedUsers.map((user) => (
            <div key={user.id} className="card p-4">
              <Link to={`/u/${user.username}`} className="flex items-center gap-3">
                <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="md" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{user.displayName}</span>
                  <span className="block truncate text-xs text-muted">@{user.username}</span>
                </span>
              </Link>
              <p className="mt-2 line-clamp-2 min-h-[32px] text-xs leading-5 text-muted">
                {user.bio || "Curious member of the community."}
              </p>
              <div className="mt-3">
                <FollowButton user={user} className="w-full" />
              </div>
            </div>
          ))}
          {data.suggestedUsers.length === 0 && (
            <div className="card col-span-full p-6 text-sm text-muted">
              You already follow everyone here. Time to recruit a friend.
            </div>
          )}
        </div>
      </section>

      {data.announcements.length > 0 && (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-700" />
            <h2 className="text-sm font-semibold text-ink">Community announcements</h2>
          </div>
          <div className="divide-y divide-line">
            {data.announcements.map((post) => (
              <Link key={post.id} to={postPath(post)} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                  <Clapperboard className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{post.title}</span>
                  <span className="text-[11px] text-muted">{timeAgo(post.createdAt)}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

