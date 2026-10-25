import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  MessageCircle,
  Mic,
  PenSquare,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import type { Category, PlacesResponse } from "../types";
import { usePaginatedPosts, useQuery } from "../hooks/useApi";
import {
  KIND_META,
  ROOM_PLACE_COPY,
  ROOM_PLACE_KIND,
  placePath,
} from "../lib/places";
import { useAuth } from "../store/auth";
import { categoryIcon, categoryPath, cn, formatCount } from "../lib/utils";
import { categoryAmharic } from "../lib/brand";
import { roomArt } from "../lib/roomArt";
import { PostFeed } from "../components/PostFeed";
import { PostComposer } from "../components/PostComposer";
import { Avatar, Badge, PageLoader } from "../components/ui";
import { KindMedia } from "../components/KindMedia";

const SORTS = ["Latest", "Popular", "Trending"] as const;
type Sort = (typeof SORTS)[number];

/** Turns a room into a short list of places you could actually go to tonight. */
function RoomPlaces({ slug }: { slug: string }) {
  const kind = ROOM_PLACE_KIND[slug];
  const { data } = useQuery<PlacesResponse>(kind ? `/api/places?kind=${kind}&limit=3` : null);
  if (!kind) return null;

  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const places = data?.places ?? [];

  return (
    <section className="card overflow-hidden">
      <div className="relative flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span
          aria-hidden="true"
          className="tilet-strip absolute inset-y-0 right-0 hidden w-10 opacity-25 sm:block"
        />
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 basis-[12rem]">
          <h2 className="font-display text-base font-semibold text-ink">Take this room offline</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {ROOM_PLACE_COPY[slug] ?? `Places around the city that suit this room.`}
          </p>
        </div>
        <Link
          to={`/places?kind=${kind}`}
          className="btn-secondary btn-sm w-full justify-center sm:ml-auto sm:w-auto"
        >
          All {meta.plural ?? `${meta.label.toLowerCase()}s`} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {places.length === 0 ? (
        <p className="px-5 py-4 text-xs text-muted">Loading places nearby…</p>
      ) : (
        <div className="grid gap-px bg-line sm:grid-cols-3">
          {places.map((place) => (
            <Link
              key={place.id}
              to={placePath(place)}
              className="group flex items-center gap-3 bg-surface p-3.5 transition hover:bg-raised/60"
            >
              <KindMedia
                kind={place.kind}
                className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10"
                iconClassName="h-6 w-6"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {place.name}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {place.area ? `${place.area} · ` : ""}
                  {place.city}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ink">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {place.rating.toFixed(1)}
                  <span className="font-normal text-muted">({place.reviewCount})</span>
                </span>
              </span>
              <Icon className="h-4 w-4 shrink-0 text-muted/50 transition group-hover:text-brand-700 dark:group-hover:text-brand-300" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function CategoryPage() {
  const { slug = "" } = useParams();
  const user = useAuth((state) => state.user);
  const [sort, setSort] = useState<Sort>("Latest");

  const { data, loading, error } = useQuery<{ category: Category }>(`/api/categories/${slug}`);
  const { data: allCategories } = useQuery<{ categories: Category[] }>("/api/categories");

  const sortParam = sort === "Popular" ? "popular" : sort === "Trending" ? "trending" : "latest";
  const feed = usePaginatedPosts("/api/posts", { category: slug, sort: sortParam });

  const activeMembers = useMemo(() => {
    const seen = new Map<string, (typeof feed.posts)[number]["author"]>();
    for (const post of feed.posts) {
      if (!seen.has(post.author.id)) seen.set(post.author.id, post.author);
    }
    return Array.from(seen.values()).slice(0, 5);
  }, [feed.posts]);

  if (loading) return <PageLoader label="Opening the room…" />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">This room doesn't exist.</p>
        <p className="mt-1 text-sm text-muted">It may have been renamed or removed by an administrator.</p>
        <Link to="/categories" className="btn-primary mt-4">
          <ArrowLeft className="h-4 w-4" /> All categories
        </Link>
      </div>
    );
  }

  const category = data.category;
  const Icon = categoryIcon(category.icon);
  const amharic = categoryAmharic(category.slug);
  const art = roomArt(category.slug);
  const related = (allCategories?.categories ?? []).filter((item) => item.id !== category.id).slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/categories" className="btn-ghost btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" /> All rooms
        </Link>
        <span className="text-muted/40">/</span>
        <span className="text-xs font-medium text-muted">{category.name}</span>
      </div>

      <header className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-90"
          style={{
            background: `linear-gradient(135deg, ${category.color}1f, transparent 62%)`,
          }}
        />
        <span aria-hidden="true" className="tilet-strip absolute inset-y-0 right-0 w-16 opacity-40 sm:w-40" />
        {art && (
          <div className="absolute inset-y-0 right-0 hidden w-1/3 overflow-hidden sm:block">
            <img
              src={art.photo}
              alt={art.alt}
              width={640}
              height={480}
              className="h-full w-full object-cover opacity-90"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: `linear-gradient(90deg, ${category.color}59, transparent 55%)` }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/2 bg-surface"
              style={{ maskImage: "linear-gradient(90deg, #000, transparent)", WebkitMaskImage: "linear-gradient(90deg, #000, transparent)" }}
            />
          </div>
        )}
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ring-black/5"
                  style={{ backgroundColor: `${category.color}22`, color: category.color }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                {amharic && (
                  <span lang="am" className="font-ethiopic text-sm font-semibold text-muted">
                    {amharic}
                  </span>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.15rem]">
                {category.name}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{category.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{formatCount(category.postCount ?? 0)} conversations</Badge>
                <Badge>{category.kind === "DISCUSSION" ? "Open room" : `${category.kind.toLowerCase()} reviews`}</Badge>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <Mic className="h-3.5 w-3.5" /> Text, photos & voice notes
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <Link
                to={user ? `/create?category=${category.slug}` : "/login"}
                className="btn-primary btn-sm"
              >
                <PenSquare className="h-3.5 w-3.5" /> Full editor
              </Link>
              {activeMembers.length > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-2.5 py-1.5 backdrop-blur">
                  <div className="flex -space-x-2">
                    {activeMembers.map((member) => (
                      <Avatar
                        key={member.id}
                        name={member.displayName}
                        username={member.username}
                        src={member.avatarUrl}
                        size="xs"
                      />
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-medium text-muted">
                    <Users className="h-3 w-3" /> active here
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <span className="eth-band absolute inset-x-0 bottom-0 h-[3px]" />
      </header>

      <PostComposer
        fixedCategory={category}
        onCreated={() => {
          setSort("Latest");
          feed.refetch();
        }}
      />

      <section className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
          <MessageCircle className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 text-xs leading-5 text-muted">
          <span className="font-semibold text-ink">This is a table, not a stage.</span> Share a photo
          from your day, record a thought, or reply to someone — likes and threaded comments keep
          the conversation going.
        </p>
        <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted/70 sm:block">
          አንድ ላይ እንወያይ
        </span>
      </section>

      <div className="flex items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-1">
          {SORTS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSort(option)}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium transition",
                sort === option
                  ? "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-700"
                  : "text-muted hover:text-ink",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-muted">
          {formatCount(feed.posts.length)}
          {feed.hasMore ? "+" : ""} shown
        </span>
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
        emptyTitle={`${category.name} is waiting for its first story`}
        emptyDescription="Be the first to open the conversation — share a thought, a photo or a voice note."
        emptyAction={
          <Link to={user ? `/create?category=${category.slug}` : "/login"} className="btn-primary btn-sm">
            <PenSquare className="h-3.5 w-3.5" /> Write the first post
          </Link>
        }
      />

      <RoomPlaces slug={category.slug} />

      {related.length > 0 && (
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-700 dark:text-brand-300" />
            <h2 className="text-sm font-semibold text-ink">Other rooms you might enjoy</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {related.map((item) => {
              const RelatedIcon = categoryIcon(item.icon);
              return (
                <Link key={item.id} to={categoryPath(item)} className="chip hover:border-brand-300">
                  <RelatedIcon className="h-3.5 w-3.5" style={{ color: item.color }} />
                  {item.name}
                  {categoryAmharic(item.slug) && (
                    <span lang="am" className="font-ethiopic text-muted/70">
                      {categoryAmharic(item.slug)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
