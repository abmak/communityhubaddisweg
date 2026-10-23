import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clapperboard,
  ExternalLink,
  Loader2,
  MapPin,
  Mountain,
  Star,
  Trash2,
} from "lucide-react";
import type { Post, RatingStats, Review } from "../types";
import { useQuery } from "../hooks/useApi";
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
import { Avatar, Badge, EmptyState, PageLoader, Spinner, Stars } from "../components/ui";
import { SafeImage } from "../components/Media";
import { PostCard } from "../components/PostCard";
import { CommentThread } from "../components/CommentThread";

interface ReviewResponse {
  post: Post;
  stats: RatingStats;
  reviews: Review[];
  myReview: Review | null;
  related: Post[];
}

function Distribution({ stats, max }: { stats: RatingStats; max: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: max }).map((_, index) => {
        const score = max - index;
        const count = stats.distribution[String(score)] ?? 0;
        const percent = stats.count > 0 ? (count / stats.count) * 100 : 0;
        return (
          <div key={score} className="flex items-center gap-2 text-[11px] text-muted">
            <span className="w-5 text-right tabular-nums">{score}</span>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-5 tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function RatingForm({
  kind,
  postId,
  myReview,
  onSaved,
}: {
  kind: "movie" | "book";
  postId: string;
  myReview: Review | null;
  onSaved: () => void;
}) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const max = kind === "movie" ? 10 : 5;
  const endpoint = kind === "movie" ? `/api/movies/${postId}/reviews` : `/api/books/${postId}/reviews`;

  const [score, setScore] = useState(myReview?.rating ?? 0);
  const [body, setBody] = useState(myReview?.body ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScore(myReview?.rating ?? 0);
    setBody(myReview?.body ?? "");
  }, [myReview]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-raised/40 p-4 text-center">
        <p className="text-sm text-muted">
          <Link to="/login" className="link">
            Sign in
          </Link>{" "}
          to rate {kind === "movie" ? "this film" : "this book"} and add your review.
        </p>
      </div>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!score) {
      pushToast("Choose a rating first.", { tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await api.put(endpoint, { rating: score, body: body.trim() || undefined });
      pushToast("Your review is saved.", { tone: "success" });
      onSaved();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`${endpoint.replace("/reviews", "/reviews/mine")}`);
      setScore(0);
      setBody("");
      pushToast("Your review was removed.", { tone: "success" });
      onSaved();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-raised/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {myReview ? "Your review" : "Rate it yourself"}
        </p>
        {myReview && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {Array.from({ length: max }).map((_, index) => {
          const value = index + 1;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setScore(value)}
              className="rounded p-0.5 transition hover:scale-110"
              aria-label={`Rate ${value} out of ${max}`}
              aria-pressed={score === value}
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  value <= score ? "fill-amber-400 text-amber-400" : "fill-transparent text-line",
                )}
              />
            </button>
          );
        })}
        <span className="ml-1 text-xs font-semibold text-ink">
          {score ? `${score}/${max}` : "—"}
        </span>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={3000}
        placeholder={
          kind === "movie"
            ? "What stayed with you? Favourite scene, performance, pacing…"
            : "What did you think? Favourite passage, characters, who should read it…"
        }
        className="input mt-3 resize-y text-sm"
      />
      <button type="submit" className="btn-primary btn-sm mt-2" disabled={busy || !score}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
        {myReview ? "Update review" : "Publish review"}
      </button>
    </form>
  );
}

function ReviewList({ reviews, onDeleted }: { reviews: Review[]; onDeleted: () => void }) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);

  if (reviews.length === 0) {
    return (
      <p className="rounded-xl bg-raised/50 px-4 py-6 text-center text-sm text-muted">
        No reviews yet. Yours could be the first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
          <div className="flex items-start gap-3">
            <Link to={`/u/${review.user.username}`} className="shrink-0">
              <Avatar
                name={review.user.displayName}
                username={review.user.username}
                src={review.user.avatarUrl}
                size="sm"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/u/${review.user.username}`} className="text-sm font-semibold text-ink hover:text-brand-700">
                  {review.user.displayName}
                </Link>
                <span className="text-[11px] text-muted">{timeAgo(review.createdAt)}</span>
                {user?.id === review.userId && (
                  <button
                    type="button"
                    className="ml-auto text-[11px] text-muted hover:text-rose-600"
                    onClick={async () => {
                      try {
                        await api.delete(
                          `/api/${review.rating > 5 ? "movies" : "books"}/${review.postId}/reviews/mine`,
                        );
                        pushToast("Review removed.", { tone: "success" });
                        onDeleted();
                      } catch (error) {
                        pushToast(apiError(error), { tone: "error" });
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Stars value={review.rating} max={review.rating > 5 ? 10 : 5} size={12} />
                <span className="text-[11px] font-semibold text-amber-600">
                  {review.rating}/{review.rating > 5 ? 10 : 5}
                </span>
              </div>
              {review.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/85">{review.body}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewDetailPage({ kind }: { kind: "movie" | "book" }) {
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const endpoint = kind === "movie" ? `/api/movies/${postId}` : `/api/books/${postId}`;
  const { data, loading, error, refetch, setData } = useQuery<ReviewResponse>(endpoint);
  const max = kind === "movie" ? 10 : 5;

  useEffect(() => {
    if (data?.post) {
      const title = kind === "movie" ? data.post.movie?.movieTitle : data.post.book?.bookTitle;
      document.title = `${title ?? "Review"} · አዲስ ወግ`;
    }
    return () => {
      document.title = "አዲስ ወግ · Addis Weg — a new way, shared stories";
    };
  }, [data?.post, kind]);

  if (loading) return <PageLoader label={kind === "movie" ? "Rolling the film…" : "Opening the book…"} />;

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">This review isn't here.</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Link to={kind === "movie" ? "/cinema" : "/books"} className="btn-primary mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to the shelf
        </Link>
      </div>
    );
  }

  const { post, stats, reviews, myReview, related } = data;
  const isMovie = kind === "movie";
  const detail = isMovie ? post.movie : post.book;
  const title = isMovie ? post.movie?.movieTitle : post.book?.bookTitle;
  const creator = isMovie ? post.movie?.director : post.book?.author;
  const cover = isMovie ? post.movie?.posterUrl : post.book?.coverUrl;
  const genre = isMovie ? post.movie?.genre : post.book?.genre;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <Link
          to={isMovie ? "/cinema" : "/books"}
          className="text-xs font-medium text-muted hover:text-ink"
        >
          All {isMovie ? "films" : "books"}
        </Link>
      </div>

      <header
        className={cn(
          "card overflow-hidden",
          isMovie ? "bg-[#170f11]" : "bg-[#0d2421]",
        )}
      >
        <div
          className="flex flex-col gap-5 p-5 text-white sm:flex-row sm:p-6"
          style={{
            background: isMovie
              ? "linear-gradient(135deg, rgba(190,18,60,0.22), transparent 55%)"
              : "linear-gradient(135deg, rgba(13,148,136,0.22), transparent 55%)",
          }}
        >
          <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-44">
            <SafeImage
              src={cover}
              alt={title ?? "Cover"}
              className="aspect-[3/4] w-full rounded-xl shadow-2xl ring-1 ring-white/10"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                isMovie ? "text-rose-300" : "text-brand-200",
              )}
            >
              {isMovie ? <Clapperboard className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {isMovie ? "Ethiopian cinema" : "Book review"}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-medium leading-tight tracking-tight">
              {title}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {creator}
              {isMovie && post.movie?.year ? ` · ${post.movie.year}` : ""}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold text-white">
                  {stats.average ?? "—"}
                </span>
                <span className="text-xs text-white/50">/{max}</span>
              </span>
              <Stars value={stats.average ?? 0} max={max} size={14} />
              <span className="text-xs text-white/60">
                {formatCount(stats.count)} {stats.count === 1 ? "review" : "reviews"}
              </span>
            </div>

            {genre && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genre.split("/").map((tag) => (
                  <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/75">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {isMovie && post.movie?.trailerUrl && (
                <a
                  href={post.movie.trailerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn bg-white/10 px-3 py-2 text-xs text-white ring-1 ring-inset ring-white/15 hover:bg-white/15"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Trailer
                </a>
              )}
              <Link
                to={`/u/${post.author.username}`}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/75 transition hover:bg-white/10"
              >
                <Avatar
                  name={post.author.displayName}
                  username={post.author.username}
                  src={post.author.avatarUrl}
                  size="xs"
                />
                Recommended by {post.author.displayName}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {(isMovie ? post.movie?.synopsis : post.book?.synopsis) && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold text-ink">About</h2>
          <p className="mt-2 text-sm leading-7 text-ink/80">
            {isMovie ? post.movie?.synopsis : post.book?.synopsis}
          </p>
        </div>
      )}

      <PostCard
        post={post}
        detail
        onChange={(updated) => setData({ ...data, post: updated })}
        onRemove={() => navigate(isMovie ? "/cinema" : "/books")}
      />

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Ratings &amp; reviews
            </h2>
            <p className="mt-1 text-sm text-muted">
              {stats.count > 0
                ? `Readers average ${stats.average}/${max}.`
                : "No ratings yet. Be the first."}
            </p>
          </div>
        </div>

        <div className="mb-5 grid gap-5 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold text-ink">{stats.average ?? "—"}</span>
              <span className="text-sm text-muted">/{max}</span>
            </div>
            <Stars value={stats.average ?? 0} max={max} size={14} className="mt-1" />
            <p className="mt-1 text-xs text-muted">
              {formatCount(stats.count)} {stats.count === 1 ? "rating" : "ratings"}
            </p>
          </div>
          <Distribution stats={stats} max={max} />
        </div>

        <div className="mb-5">
          <RatingForm kind={kind} postId={post.id} myReview={myReview} onSaved={refetch} />
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Latest reviews</h3>
          <ReviewList reviews={reviews} onDeleted={refetch} />
        </div>
      </section>

      <CommentThread postId={post.id} />

      {related.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">
              {isMovie ? "More from the cinema" : "More from the shelf"}
            </h2>
            <Link
              to={isMovie ? "/cinema" : "/books"}
              className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {related.map((item) => {
              const relatedTitle = isMovie ? item.movie?.movieTitle : item.book?.bookTitle;
              const relatedCover = isMovie ? item.movie?.posterUrl : item.book?.coverUrl;
              return (
                <Link key={item.id} to={postPath(item)} className="group">
                  <SafeImage
                    src={relatedCover}
                    alt={relatedTitle ?? "Recommended"}
                    className="aspect-[3/4] w-full rounded-xl transition group-hover:opacity-90"
                  />
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-4 text-ink group-hover:text-brand-700">
                    {relatedTitle}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export function MovieDetailPage() {
  return <ReviewDetailPage kind="movie" />;
}

export function BookDetailPage() {
  return <ReviewDetailPage kind="book" />;
}

export function HikeDetailPage() {
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<{ post: Post; related: Post[] }>(`/api/hikes/${postId}`);

  useEffect(() => {
    if (data?.post) {
      document.title = `${data.post.hike?.location ?? data.post.title ?? "Trail"} · አዲስ ወግ`;
    }
    return () => {
      document.title = "አዲስ ወግ · Addis Weg — a new way, shared stories";
    };
  }, [data?.post]);

  if (loading) return <PageLoader label="Lacing up…" />;
  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg font-semibold text-ink">This trail story isn't here.</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Link to="/hiking" className="btn-primary mt-4">
          <ArrowLeft className="h-4 w-4" /> Back to trails
        </Link>
      </div>
    );
  }

  const { post, related } = data;
  const hike = post.hike;
  const image = post.media[0]?.url;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <Link to="/hiking" className="text-xs font-medium text-muted hover:text-ink">
          All trails
        </Link>
      </div>

      <header className="relative overflow-hidden rounded-3xl bg-[#0b2015] text-white">
        {image ? (
          <SafeImage src={image} alt={hike?.location ?? "Hike"} className="absolute inset-0 h-full w-full opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="relative flex min-h-[260px] flex-col justify-end p-6 sm:min-h-[300px] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset backdrop-blur",
                difficultyStyles[hike?.difficulty ?? "MODERATE"],
              )}
            >
              {hike?.difficulty}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-medium text-white/85 backdrop-blur">
              <MapPin className="h-3 w-3" /> {hike?.location}
            </span>
          </div>
          <h1 className="mt-3 max-w-xl font-display text-3xl font-medium leading-tight">
            {post.title ?? "Trail notes"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/70">
            <span>{hike?.distanceKm ? `${hike.distanceKm} km` : "Distance not listed"}</span>
            <span>{hike?.durationHours ? `${hike.durationHours} hours` : "Duration not listed"}</span>
            <span>{formatCount(post.likeCount)} likes</span>
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </header>

      {hike?.tips && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-emerald-900 dark:text-emerald-100">
            <Mountain className="h-4 w-4" /> Before you go
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/80">
            {hike.tips}
          </p>
        </section>
      )}

      <PostCard
        post={post}
        detail
        onChange={() => undefined}
        onRemove={() => navigate("/hiking")}
      />

      <CommentThread postId={post.id} />

      {related.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">More trail stories</h2>
            <Link to="/hiking" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
              See all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.slice(0, 2).map((item) => (
              <Link key={item.id} to={postPath(item)} className="card group flex gap-3 p-3 transition hover:shadow-lift">
                <SafeImage
                  src={item.media[0]?.thumbnailUrl ?? item.media[0]?.url}
                  alt="Trail"
                  className="h-16 w-20 shrink-0 rounded-lg"
                />
                <div className="min-w-0 py-0.5">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink group-hover:text-brand-700">
                    {item.title ?? item.hike?.location}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {item.hike?.location} · {item.hike?.difficulty}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="text-center">
        <Link to="/hiking" className="btn-secondary btn-sm">
          Browse more trails <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
