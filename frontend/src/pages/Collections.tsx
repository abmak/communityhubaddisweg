import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Clock,
  MapPin,
  Mountain,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import type { CinemaScheduleGroup, CinemasResponse, Place, Post } from "../types";
import { useDebounced, useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import {
  cn,
  difficultyStyles,
  formatCount,
  postPath,
  timeAgo,
} from "../lib/utils";
import { Badge, EmptyState, Spinner, Stars } from "../components/ui";
import { SafeImage } from "../components/Media";
import { tt } from "../lib/i18n";
import { KIND_META, placePath } from "../lib/places";

interface ListResponse {
  posts: Post[];
  meta: { page: number; limit: number; hasMore: boolean };
}

function Pagination({
  page,
  hasMore,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-line pt-5">
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Previous
      </button>
      <span className="text-xs text-muted">Page {page}</span>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        Next <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Filters({
  children,
  search,
  onSearch,
  placeholder,
  sort,
}: {
  children?: React.ReactNode;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  sort?: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void };
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">{placeholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className="input h-10 rounded-full pl-9 text-sm"
          />
        </label>
        {sort && (
          <select
            value={sort.value}
            onChange={(event) => sort.onChange(event.target.value)}
            className="h-10 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted focus:border-brand-400 focus:outline-none"
            aria-label="Sort"
          >
            {sort.options.map((option) => (
              <option key={option.value} value={option.value}>
                {tt(option.label)}
              </option>
            ))}
          </select>
        )}
        {children}
      </div>
    </div>
  );
}

function MovieTile({ post }: { post: Post }) {
  return (
    <Link
      to={postPath(post)}
      className="card group overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-raised">
        <SafeImage
          src={post.movie?.posterUrl}
          alt={post.movie?.movieTitle ?? "Film"}
          className="h-full w-full transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
        {post.ratingAvg !== null ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-amber-300 backdrop-blur">
            <Star className="h-3 w-3 fill-current" /> {post.ratingAvg}/10
          </span>
        ) : (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
            New
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="line-clamp-2 font-display text-sm font-semibold leading-snug">
            {post.movie?.movieTitle}
          </p>
          <p className="mt-0.5 text-[10px] text-white/65">
            {[post.movie?.director, post.movie?.year].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-xs leading-5 text-muted">{post.title ?? post.body}</p>
        <p className="mt-2 text-[10px] font-medium text-muted/80">
          {post.reviewCount} {post.reviewCount === 1 ? "review" : "reviews"} · {timeAgo(post.createdAt)}
        </p>
      </div>
    </Link>
  );
}

function BookTile({ post }: { post: Post }) {
  return (
    <Link
      to={postPath(post)}
      className="card group flex gap-3 overflow-hidden p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <SafeImage
        src={post.book?.coverUrl}
        alt={post.book?.bookTitle ?? "Book cover"}
        className="h-32 w-24 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1 py-1">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
          <BookOpen className="h-3 w-3" /> {post.book?.genre ?? "Book review"}
        </p>
        <p className="mt-1 line-clamp-2 font-display text-base font-semibold leading-snug text-ink transition group-hover:text-brand-700">
          {post.book?.bookTitle}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">{post.book?.author}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <Stars value={post.ratingAvg ?? 0} size={12} />
          <span className="text-[11px] font-semibold text-amber-600">
            {post.ratingAvg ?? "—"}
          </span>
          <span className="text-[10px] text-muted">({post.reviewCount})</span>
        </div>
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted">{post.title ?? post.body}</p>
      </div>
    </Link>
  );
}

function HikeTile({ post, featured }: { post: Post; featured?: boolean }) {
  return (
    <Link
      to={postPath(post)}
      className={cn(
        "card group relative overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        featured && "sm:col-span-2",
      )}
    >
      <div className={cn("relative overflow-hidden bg-raised", featured ? "h-64 sm:h-72" : "h-44")}>
        <SafeImage
          src={post.media[0]?.thumbnailUrl ?? post.media[0]?.url}
          alt={post.hike?.location ?? "Trail"}
          className="h-full w-full transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset backdrop-blur",
            difficultyStyles[post.hike?.difficulty ?? "MODERATE"],
          )}
        >
          {post.hike?.difficulty}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
            <MapPin className="h-3 w-3" /> {post.hike?.location}
          </p>
          <p className={cn("mt-1 font-display font-semibold leading-snug", featured ? "text-xl" : "line-clamp-2 text-sm")}>
            {post.title ?? "Trail notes"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
            {post.hike?.distanceKm ? <span>{post.hike.distanceKm} km</span> : null}
            {post.hike?.durationHours ? <span>{post.hike.durationHours} hours</span> : null}
            <span>{formatCount(post.likeCount)} likes</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Cinema
// ---------------------------------------------------------------------------

const MOVIE_GENRES = ["All", "Drama", "Romance", "Historical", "Documentary", "Comedy"];

function CinemaSchedules({
  data,
  loading,
  error,
}: {
  data: CinemasResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const cinemas = data?.cinemas ?? [];
  const schedules = data?.schedules ?? [];
  const screeningCount = schedules.reduce((total, group) => total + group.screenings.length, 0);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Popular cinemas</h2>
            <p className="mt-0.5 text-xs text-muted">The halls members rate highest in Addis Ababa.</p>
          </div>
          <Link to="/places?kind=CINEMA" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
            All cinemas <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-52 rounded-3xl" />
            ))}
          </div>
        ) : cinemas.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No cinema halls have been added yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cinemas.map((place) => (
              <CinemaCard key={place.id} place={place} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
              <Clock className="h-4 w-4 text-rose-500" /> Current schedules
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Screenings published by the venues over the next 30 days. Times are local; confirm with the cinema before travelling.
            </p>
          </div>
          {screeningCount > 0 ? (
            <span className="text-[11px] font-medium text-muted">
              {screeningCount} {screeningCount === 1 ? "screening" : "screenings"}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner className="h-6 w-6 text-rose-500" />
          </div>
        ) : error ? (
          <div className="card p-6 text-center text-sm text-rose-600">{error}</div>
        ) : schedules.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Clapperboard}
              title="No showtimes published yet"
              description="Venue feeds post screenings here as soon as they announce them. In the meantime, browse the halls above or the community's film reviews."
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {schedules.map((group) => (
              <ScheduleCard key={group.venue} group={group} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CinemaCard({ place }: { place: Place }) {
  const photo = KIND_META.CINEMA.photo;
  // OSM-imported halls carry an import notice instead of an editorial blurb.
  const imported = /OpenStreetMap/i.test(`${place.highlight ?? ""} ${place.description}`);
  const blurb = imported ? null : (place.highlight ?? place.description);
  return (
    <Link
      to={placePath(place)}
      className="card group relative overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative h-36 overflow-hidden bg-raised">
        <SafeImage src={photo} alt={place.name} className="h-full w-full transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
          <p className="line-clamp-1 font-display text-base font-semibold">{place.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/70">
            <MapPin className="h-3 w-3" /> {[place.area, place.city].filter(Boolean).join(", ")}
          </p>
        </div>
        {place.reviewCount > 0 ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-amber-300 backdrop-blur">
            <Star className="h-3 w-3 fill-current" /> {place.rating.toFixed(1)}
            <span className="font-medium text-white/60">({formatCount(place.reviewCount)})</span>
          </span>
        ) : null}
      </div>
      <div className="p-3.5">
        {blurb ? <p className="line-clamp-1 text-xs font-medium text-ink">{blurb}</p> : null}
        <div className={cn("flex items-center justify-between gap-2", blurb && "mt-2")}>
          <div className="flex flex-wrap gap-1">
            {place.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-raised px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                {tag}
              </span>
            ))}
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-brand-700 dark:text-brand-300">View venue</span>
        </div>
      </div>
    </Link>
  );
}

function ScheduleCard({ group }: { group: CinemaScheduleGroup }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-raised/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{group.venue}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {group.cinema ? (
              <Link to={`/places/${group.cinema.slug}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                {group.cinema.area ?? "View venue"}
              </Link>
            ) : (
              "From the venue's feed"
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-300">
          {group.screenings.length} {group.screenings.length === 1 ? "show" : "shows"}
        </span>
      </div>
      <div className="divide-y divide-line">
        {group.screenings.map((screening) => {
          const start = new Date(screening.startDate);
          const end = screening.endDate ? new Date(screening.endDate) : null;
          return (
            <Link
              key={screening.id}
              to={`/events/${screening.slug}`}
              className="group flex items-center gap-3 px-4 py-3 transition hover:bg-raised/60"
            >
              <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border border-line bg-surface px-1.5 py-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wide text-rose-500">
                  {start.toLocaleDateString(undefined, { month: "short" })}
                </span>
                <span className="text-base font-black leading-tight text-ink">{start.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{screening.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-ink">
                    <Clock className="h-3 w-3" />
                    {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    {end ? ` – ${end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </span>
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CinemaPage() {
  const [view, setView] = useState<"schedule" | "reviews">("schedule");
  const [sort, setSort] = useState("newest");
  const [genre, setGenre] = useState("All");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(term, 350);

  useEffect(() => setPage(1), [sort, genre, q]);

  const { data: cinemaData, loading: cinemaLoading, error: cinemaError } = useQuery<CinemasResponse>("/api/events/cinemas");
  const { data, loading, error } = useQuery<ListResponse>(
    `/api/movies?sort=${sort}&page=${page}&limit=12${genre !== "All" ? `&genre=${encodeURIComponent(genre)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    { enabled: view === "reviews" },
  );
  const posts = data?.posts ?? [];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-[#1b1012] px-6 py-8 text-white sm:px-9">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_120%_at_15%_0%,rgba(225,29,72,0.35),transparent_55%),radial-gradient(90%_90%_at_100%_100%,rgba(245,158,11,0.22),transparent_60%)]"
        />
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
            <Clapperboard className="h-3.5 w-3.5" /> Ethiopian cinema
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            What's showing, and where to watch it.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            Popular cinema halls, current schedules, and honest film reviews from the community.
          </p>
        </div>
      </header>

      <div className="inline-flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Cinema view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "schedule"}
          onClick={() => setView("schedule")}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-semibold transition",
            view === "schedule" ? "bg-rose-600 text-white shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          Cinemas & schedules
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "reviews"}
          onClick={() => setView("reviews")}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-semibold transition",
            view === "reviews" ? "bg-rose-600 text-white shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          Film reviews
        </button>
      </div>

      {view === "schedule" ? (
        <CinemaSchedules data={cinemaData} loading={cinemaLoading} error={cinemaError} />
      ) : (
        <>

      <Filters
        search={term}
        onSearch={setTerm}
        placeholder="Search films, directors…"
        sort={{
          value: sort,
          onChange: setSort,
          options: [
            { value: "newest", label: "Newest" },
            { value: "top", label: "Top rated" },
            { value: "trending", label: "Trending" },
          ],
        }}
      >
        <Badge tone="accent" className="hidden sm:inline-flex">
          <TrendingUp className="h-3 w-3" /> {formatCount(posts.length)} films
        </Badge>
      </Filters>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {MOVIE_GENRES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGenre(option)}
            className={cn("chip shrink-0", genre === option && "chip-active")}
          >
            {option}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{error}</div>
      ) : posts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Clapperboard}
            title="No films match that search"
            description="Try a different title or director, or be the first to recommend a film."
            action={
              <Link to="/create?category=ethiopian-cinema" className="btn-primary btn-sm">
                Recommend a film
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {posts.map((post) => (
              <MovieTile key={post.id} post={post} />
            ))}
          </div>
          <Pagination page={page} hasMore={Boolean(data?.meta.hasMore)} onChange={setPage} />
        </>
      )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

const BOOK_GENRES = ["All", "Fiction", "Historical", "Poetry", "Non-fiction", "Memoir"];

export function BooksPage() {
  const [sort, setSort] = useState("newest");
  const [genre, setGenre] = useState("All");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(term, 350);
  const { data, loading, error } = useQuery<ListResponse>(
    `/api/books?sort=${sort}&page=${page}&limit=12${genre !== "All" ? `&genre=${encodeURIComponent(genre)}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
  );

  useEffect(() => setPage(1), [sort, genre, q]);
  const posts = data?.posts ?? [];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-[#0c2b27] px-6 py-8 text-white sm:px-9">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(20,184,166,0.3),transparent_55%),radial-gradient(90%_90%_at_100%_100%,rgba(245,158,11,0.18),transparent_60%)]"
        />
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-200">
            <BookOpen className="h-3.5 w-3.5" /> Book reviews
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            The books we're reading, and the ones we can't stop recommending.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            Honest reviews, favourite quotations and a growing shelf for every kind of reader.
          </p>
        </div>
      </header>

      <Filters
        search={term}
        onSearch={setTerm}
        placeholder="Search titles, authors…"
        sort={{
          value: sort,
          onChange: setSort,
          options: [
            { value: "newest", label: "Newest" },
            { value: "top", label: "Top rated" },
          ],
        }}
      />

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {BOOK_GENRES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGenre(option)}
            className={cn("chip shrink-0", genre === option && "chip-active")}
          >
            {option}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{error}</div>
      ) : posts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="No book reviews match that search"
            description="Try another author or genre — or add the book you just finished."
            action={
              <Link to="/create?category=book-reviews" className="btn-primary btn-sm">
                Review a book
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <BookTile key={post.id} post={post} />
            ))}
          </div>
          <Pagination page={page} hasMore={Boolean(data?.meta.hasMore)} onChange={setPage} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hiking
// ---------------------------------------------------------------------------

const DIFFICULTIES = ["All", "EASY", "MODERATE", "HARD", "EXPERT"] as const;

export function HikingPage() {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("All");
  const [sort, setSort] = useState("newest");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(term, 350);

  useEffect(() => setPage(1), [difficulty, sort, q]);

  const { data, loading, error } = useQuery<ListResponse>(
    `/api/hikes?sort=${sort}&page=${page}&limit=12${difficulty !== "All" ? `&difficulty=${difficulty}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
  );
  const posts = data?.posts ?? [];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-[#0c2318] px-6 py-8 text-white sm:px-9">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_120%_at_15%_0%,rgba(34,197,94,0.32),transparent_55%),radial-gradient(90%_90%_at_100%_100%,rgba(20,184,166,0.2),transparent_60%)]"
        />
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            <Mountain className="h-3.5 w-3.5" /> Hiking experiences
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            Field notes from the trail.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            Real routes, real difficulty, and the practical details nobody puts in the brochure.
          </p>
          <div className="mt-5">
            <Link to={user ? "/create?category=hiking-experiences" : "/login"} className="btn bg-white px-4 py-2.5 text-[#0c2318] hover:bg-emerald-50">
              Share a hike
            </Link>
          </div>
        </div>
      </header>

      <Filters
        search={term}
        onSearch={setTerm}
        placeholder="Search trails, locations…"
        sort={{
          value: sort,
          onChange: setSort,
          options: [
            { value: "newest", label: "Newest" },
            { value: "trending", label: "Trending" },
          ],
        }}
      />

      <div className="flex flex-wrap gap-2">
        {DIFFICULTIES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDifficulty(option)}
            className={cn("chip", difficulty === option && "chip-active")}
          >
            {option === "All" ? "All difficulties" : option.charAt(0) + option.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-sm text-rose-600">{error}</div>
      ) : posts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Mountain}
            title="No trail stories match that search"
            description="Try a different difficulty or region — or write up your last hike."
            action={
              <Link to={user ? "/create?category=hiking-experiences" : "/login"} className="btn-primary btn-sm">
                Share a trail
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {posts.map((post, index) => (
              <HikeTile key={post.id} post={post} featured={index === 0} />
            ))}
          </div>
          <Pagination page={page} hasMore={Boolean(data?.meta.hasMore)} onChange={setPage} />
        </>
      )}
    </div>
  );
}
