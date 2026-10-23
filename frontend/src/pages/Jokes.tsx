import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Clock,
  Heart,
  Laugh,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { Joke, JokeComment, JokeFeedResponse } from "../types";
import { useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { cn, formatDateTime, timeAgo } from "../lib/utils";
import { Avatar, PageLoader, Spinner } from "../components/ui";

function remainingLabel(target: string, now: number): string {
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return "moments";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function JokesPage() {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const { data, loading, error, refetch, setData } = useQuery<JokeFeedResponse>("/api/jokes");

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const share = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const response = await api.post<{ joke: Joke }>("/api/jokes", { body: body.trim() });
      setData((current) =>
        current
          ? { ...current, jokes: [response.data.joke, ...current.jokes] }
          : current,
      );
      setBody("");
      pushToast("Joke shared — good luck!", { tone: "success" });
    } catch (err) {
      pushToast(apiError(err), { tone: "error" });
    } finally {
      setSending(false);
    }
  };

  const session = data?.session ?? null;
  const status = session?.status ?? null;
  const jokes = data?.jokes ?? [];
  const winner = data?.winner ?? null;

  const updateJoke = (next: Joke) =>
    setData((current) =>
      current
        ? { ...current, jokes: current.jokes.map((joke) => (joke.id === next.id ? next : joke)) }
        : current,
    );

  if (loading && !data) return <PageLoader label="Opening Joke Time…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="card relative overflow-hidden p-5 sm:p-6">
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1.5" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Laugh className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-ink">Joke Time</h1>
            <p lang="am" className="font-ethiopic text-[11px] text-muted">
              የቀልድ ሰዓት · share a laugh, crown the best one
            </p>
          </div>
          <span className="ml-auto">
            {status === "OPEN" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Open now
              </span>
            )}
            {status === "CLOSED" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/10 px-2.5 py-1 text-[11px] font-semibold text-muted ring-1 ring-inset ring-line">
                <Lock className="h-3 w-3" /> Closed
              </span>
            )}
            {!session && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/10 px-2.5 py-1 text-[11px] font-semibold text-muted ring-1 ring-inset ring-line">
                <CalendarClock className="h-3 w-3" /> Not scheduled
              </span>
            )}
          </span>
        </div>

        {status === "OPEN" && session && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Clock className="h-4 w-4 text-brand-700 dark:text-brand-300" />
            Jokes close in <strong className="font-semibold text-ink">{remainingLabel(session.closesAt, now)}</strong>
            <span className="text-muted/50">·</span>
            sharing stops at {formatDateTime(session.closesAt)}
          </p>
        )}

        {status === "CLOSED" && session && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Trophy className="h-4 w-4 text-amber-600" />
            This session closed {formatDateTime(session.closesAt)}. The best joke is crowned below.
          </p>
        )}

        {!session && data?.upcoming && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <CalendarClock className="h-4 w-4 text-brand-700 dark:text-brand-300" />
            Next Joke Time opens {formatDateTime(data.upcoming.opensAt)} and runs until{" "}
            {formatDateTime(data.upcoming.closesAt)}.
          </p>
        )}

        {!session && !data?.upcoming && (
          <p className="mt-3 text-sm text-muted">
            No Joke Time has been scheduled yet. An administrator can open a session from the
            dashboard.
          </p>
        )}
      </header>

      {winner && (
        <section className="relative overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent p-5 shadow-lift dark:border-amber-500/30 dark:from-amber-500/10 dark:via-amber-500/5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            <Trophy className="h-4 w-4" /> Joke of the day
          </div>
          <p className="mt-2 whitespace-pre-wrap font-display text-lg font-semibold leading-relaxed text-ink">
            “{winner.body}”
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Avatar
                name={winner.author.displayName}
                username={winner.author.username}
                src={winner.author.avatarUrl}
                size="xs"
              />
              <Link to={`/u/${winner.author.username}`} className="font-semibold text-ink hover:underline">
                {winner.author.displayName}
              </Link>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> {winner.score} points
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {winner.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {winner.commentCount}
            </span>
          </div>
        </section>
      )}

      {data?.canPost && (
        <form onSubmit={share} className="card p-4 sm:p-5">
          <div className="flex gap-3">
            <Avatar name={user?.displayName ?? "You"} username={user?.username} src={user?.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <label htmlFor="joke-body" className="sr-only">
                Your joke
              </label>
              <textarea
                id="joke-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Share your best joke — the room will decide if it lands."
                className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm leading-6 text-ink placeholder:text-muted/70 focus:border-brand-400 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">{body.length}/2000</span>
                <button type="submit" className="btn-primary btn-sm" disabled={!body.trim() || sending}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Share joke
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {!user && status === "OPEN" && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <Laugh className="h-5 w-5 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-muted">
            Joke Time is open. Sign in to share a joke and vote for your favourites.
          </p>
          <Link to="/login" className="btn-primary btn-sm">
            Sign in
          </Link>
        </div>
      )}

      {error && (
        <div className="card p-4 text-sm text-rose-600 dark:text-rose-300">{error}</div>
      )}

      {session && (
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {status === "CLOSED" ? "All jokes" : "Jokes shared"} · {jokes.length}
          </h2>
          {status === "CLOSED" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <ShieldCheck className="h-3 w-3" /> ranked by likes + comments
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {jokes.map((joke) => (
          <JokeCard
            key={joke.id}
            joke={joke}
            onJokeChange={updateJoke}
            sessionClosed={status === "CLOSED"}
          />
        ))}
      </div>

      {session && jokes.length === 0 && (
        <div className="card p-8 text-center">
          <Laugh className="mx-auto mb-2 h-7 w-7 text-muted/60" />
          <p className="font-display text-base font-semibold text-ink">The mic is open</p>
          <p className="mt-1 text-sm text-muted">No jokes yet — you could be the first to make the room laugh.</p>
        </div>
      )}

      {!session && data?.upcoming && (
        <div className="card p-6 text-center">
          <CalendarClock className="mx-auto mb-2 h-6 w-6 text-brand-700 dark:text-brand-300" />
          <p className="font-display text-base font-semibold text-ink">
            Next session: {data.upcoming.title}
          </p>
          <p className="mt-1 text-sm text-muted">
            Opens {formatDateTime(data.upcoming.opensAt)} and closes {formatDateTime(data.upcoming.closesAt)}.
          </p>
        </div>
      )}
    </div>
  );
}

function JokeCard({
  joke,
  onJokeChange,
  sessionClosed,
}: {
  joke: Joke;
  onJokeChange: (joke: Joke) => void;
  sessionClosed: boolean;
}) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const [likeBusy, setLikeBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<JokeComment[] | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const toggleLike = async () => {
    if (sessionClosed) {
      pushToast("Voting is closed — the results are final.", { tone: "error" });
      return;
    }
    if (!user) {
      pushToast("Sign in to vote for a joke.", { tone: "error" });
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const nextLiked = !joke.likedByMe;
    onJokeChange({
      ...joke,
      likedByMe: nextLiked,
      likeCount: Math.max(0, joke.likeCount + (nextLiked ? 1 : -1)),
      score: Math.max(0, joke.score + (nextLiked ? 1 : -1)),
    });
    try {
      const response = nextLiked
        ? await api.post<{ liked: boolean; likeCount: number }>(`/api/jokes/${joke.id}/like`)
        : await api.delete<{ liked: boolean; likeCount: number }>(`/api/jokes/${joke.id}/like`);
      onJokeChange({
        ...joke,
        likedByMe: response.data.liked,
        likeCount: response.data.likeCount,
        score: response.data.likeCount + joke.commentCount,
      });
    } catch (error) {
      onJokeChange(joke);
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setLikeBusy(false);
    }
  };

  const openComments = async () => {
    const next = !open;
    setOpen(next);
    if (next && comments === null) {
      try {
        const response = await api.get<{ comments: JokeComment[] }>(`/api/jokes/${joke.id}/comments`);
        setComments(response.data.comments);
      } catch {
        setComments([]);
      }
    }
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (sessionClosed) {
      pushToast("Commenting is closed — the results are final.", { tone: "error" });
      return;
    }
    if (!user) {
      pushToast("Sign in to comment.", { tone: "error" });
      return;
    }
    if (!commentBody.trim() || commentBusy) return;
    setCommentBusy(true);
    try {
      const response = await api.post<{ comment: JokeComment }>(`/api/jokes/${joke.id}/comments`, {
        body: commentBody.trim(),
      });
      setComments((current) => [...(current ?? []), response.data.comment]);
      setCommentBody("");
      onJokeChange({ ...joke, commentCount: joke.commentCount + 1, score: joke.score + 1 });
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Link to={`/u/${joke.author.username}`} aria-label={`View ${joke.author.displayName}'s profile`}>
          <Avatar
            name={joke.author.displayName}
            username={joke.author.username}
            src={joke.author.avatarUrl}
            size="sm"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <Link to={`/u/${joke.author.username}`} className="font-semibold text-ink hover:underline">
              {joke.author.displayName}
            </Link>
            <span className="text-muted">@{joke.author.username}</span>
            <span className="text-muted/50">·</span>
            <span className="text-muted">{timeAgo(joke.createdAt)}</span>
            {joke.mine && (
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                You
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-7 text-ink">{joke.body}</p>

          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={likeBusy}
              aria-pressed={joke.likedByMe}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10",
                joke.likedByMe && "text-rose-600",
              )}
            >
              <Heart className={cn("h-4 w-4", joke.likedByMe && "fill-current")} />
              {joke.likeCount}
            </button>
            <button
              type="button"
              onClick={() => void openComments()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10"
              aria-expanded={open}
            >
              <MessageCircle className="h-4 w-4" />
              {joke.commentCount}
            </button>
            {sessionClosed && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <Sparkles className="h-3 w-3" /> {joke.score} pts
              </span>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3 sm:ml-11">
          {comments === null ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Spinner className="h-3.5 w-3.5" /> Loading comments…
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted">No comments yet — be the first to laugh out loud.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-2">
                  <Avatar
                    name={comment.author.displayName}
                    username={comment.author.username}
                    src={comment.author.avatarUrl}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted">
                      <span className="font-semibold text-ink">{comment.author.displayName}</span>
                      {" · "}
                      {timeAgo(comment.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-ink">{comment.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addComment} className="flex items-center gap-2 pt-1">
            <input
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              maxLength={1000}
              placeholder={sessionClosed ? "Voting closed" : user ? "Add a comment…" : "Sign in to comment"}
              disabled={!user || sessionClosed}
              className="input h-9 flex-1"
              aria-label="Joke comment"
            />
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={!user || sessionClosed || !commentBody.trim() || commentBusy}
            >
              {commentBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
