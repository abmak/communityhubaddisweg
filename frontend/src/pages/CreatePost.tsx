import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Clapperboard,
  Info,
  Loader2,
  Mic,
  Mountain,
  Sparkles,
  X,
} from "lucide-react";
import type { Category, Media, Post } from "../types";
import { useQuery } from "../hooks/useApi";
import { useUI } from "../store/ui";
import { api, apiError } from "../lib/api";
import { categoryIcon, cn, postPath } from "../lib/utils";
import { categoryAmharic } from "../lib/brand";
import { PageLoader } from "../components/ui";
import { ImageUploader } from "../components/ImageUploader";
import { VoiceRecorder } from "../components/VoiceRecorder";
import { AudioPlayer } from "../components/Media";
import { PollComposer, emptyPollDraft, pollDraftIsValid, type PollDraft } from "../components/PollComposer";

const DIFFICULTIES = ["EASY", "MODERATE", "HARD", "EXPERT"] as const;

export function CreatePostPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pushToast = useUI((state) => state.pushToast);

  const { data, loading } = useQuery<{ categories: Category[] }>("/api/categories");
  const categories = data?.categories ?? [];
  const initialSlug = params.get("category");

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [posterMedia, setPosterMedia] = useState<Media[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [movieTitle, setMovieTitle] = useState("");
  const [director, setDirector] = useState("");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [trailerUrl, setTrailerUrl] = useState("");

  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookGenre, setBookGenre] = useState("");

  const [location, setLocation] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("MODERATE");
  const [distanceKm, setDistanceKm] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [tips, setTips] = useState("");

  useEffect(() => {
    if (!categories.length || categoryId) return;
    const initial = initialSlug ? categories.find((category) => category.slug === initialSlug) : undefined;
    setCategoryId(initial?.id ?? categories[0].id);
  }, [categories, initialSlug, categoryId]);

  const category = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const audio = media.filter((item) => item.kind === "AUDIO");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!category) return;
    setError(null);

    if (
      body.trim().length < 1 &&
      media.length === 0 &&
      posterMedia.length === 0 &&
      !title.trim() &&
      !pollOpen
    ) {
      setError("Write something, attach a photo or voice note, or add a poll.");
      return;
    }
    if (pollOpen && !pollDraftIsValid(pollDraft)) {
      setError("Add a poll question and at least two different options.");
      return;
    }
    if (category.kind === "MOVIE" && !movieTitle.trim()) {
      setError("Add the film title.");
      return;
    }
    if (category.kind === "BOOK" && !bookTitle.trim()) {
      setError("Add the book title.");
      return;
    }
    if (category.kind === "HIKE" && !location.trim()) {
      setError("Add where the hike took place.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        categoryId: category.id,
        title: title.trim() || undefined,
        body: body.trim(),
        mediaIds: [...media, ...posterMedia].map((item) => item.id),
      };

      if (pollOpen && pollDraftIsValid(pollDraft)) {
        payload.poll = {
          question: pollDraft.question.trim(),
          options: pollDraft.options.map((option) => option.trim()).filter(Boolean),
        };
      }

      if (category.kind === "MOVIE") {
        payload.movie = {
          movieTitle: movieTitle.trim(),
          director: director.trim() || undefined,
          year: year ? Number(year) : undefined,
          genre: genre.trim() || undefined,
          synopsis: synopsis.trim() || undefined,
          trailerUrl: trailerUrl.trim() || undefined,
          posterUrl: posterMedia[0]?.url,
        };
      }
      if (category.kind === "BOOK") {
        payload.book = {
          bookTitle: bookTitle.trim(),
          author: bookAuthor.trim() || undefined,
          genre: bookGenre.trim() || undefined,
          synopsis: synopsis.trim() || undefined,
          coverUrl: posterMedia[0]?.url,
        };
      }
      if (category.kind === "HIKE") {
        payload.hike = {
          location: location.trim(),
          difficulty,
          distanceKm: distanceKm ? Number(distanceKm) : undefined,
          durationHours: durationHours ? Number(durationHours) : undefined,
          tips: tips.trim() || undefined,
        };
      }

      const response = await api.post<{ post: Post }>("/api/posts", payload);
      pushToast("Shared with the community.", { tone: "success" });
      navigate(postPath(response.data.post));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader label="Opening the editor…" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          Draft · not published
        </p>
      </div>

      <form onSubmit={submit} className="card overflow-hidden">
        <div className="relative overflow-hidden border-b border-line bg-gradient-to-br from-brand-50/70 to-transparent px-5 py-5 dark:from-brand-500/5 sm:px-6">
          <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1.5" />
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" /> New story
            <span lang="am" className="font-ethiopic normal-case tracking-normal text-muted">
              አዲስ ወግ
            </span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Share something worth talking about.</h1>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <span className="label">Choose a room</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((item) => {
                const Icon = categoryIcon(item.icon);
                const active = item.id === categoryId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategoryId(item.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition",
                      active
                        ? "border-brand-600 bg-brand-50 text-brand-900 dark:bg-brand-500/10 dark:text-brand-100"
                        : "border-line bg-surface text-muted hover:border-brand-300 hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                    <span className="min-w-0 truncate">
                      {item.name}
                      {categoryAmharic(item.slug) && (
                        <span lang="am" className="ml-1 font-ethiopic text-[10px] text-muted/70">
                          {categoryAmharic(item.slug)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="post-title" className="label">
              Title <span className="normal-case tracking-normal text-muted/60">(optional)</span>
            </label>
            <input
              id="post-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="A headline that makes people want to read on"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="post-body" className="label">
              Your thoughts
            </label>
            <textarea
              id="post-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={7}
              maxLength={10000}
              placeholder="Tell the story, ask the question, share the recommendation — or let a photo or voice note speak…"
              className="input resize-y leading-7"
            />
            <p className="mt-1 text-right text-[10px] text-muted">{body.length}/10000</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="label mb-0">Poll</span>
              {!pollOpen && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setPollOpen(true)}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Add a poll
                </button>
              )}
            </div>
            {pollOpen ? (
              <PollComposer
                className="mt-2"
                value={pollDraft}
                onChange={setPollDraft}
                onRemove={() => {
                  setPollOpen(false);
                  setPollDraft(emptyPollDraft());
                }}
              />
            ) : (
              <p className="mt-1 text-xs text-muted">
                Ask the community a question — results update live as members vote.
              </p>
            )}
          </div>

          {category?.kind === "MOVIE" && (
            <fieldset className="rounded-2xl border border-line bg-raised/40 p-4">
              <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                <Clapperboard className="h-3.5 w-3.5 text-rose-600" /> Film details
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="movie-title">Film title</label>
                  <input id="movie-title" className="input" value={movieTitle} onChange={(e) => setMovieTitle(e.target.value)} placeholder="Lambadina" />
                </div>
                <div>
                  <label className="label" htmlFor="movie-director">Director</label>
                  <input id="movie-director" className="input" value={director} onChange={(e) => setDirector(e.target.value)} placeholder="Messay Getahun" />
                </div>
                <div>
                  <label className="label" htmlFor="movie-year">Year</label>
                  <input id="movie-year" type="number" min={1888} max={2100} className="input" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2015" />
                </div>
                <div>
                  <label className="label" htmlFor="movie-genre">Genre</label>
                  <input id="movie-genre" className="input" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Drama / Romance" />
                </div>
                <div>
                  <label className="label" htmlFor="movie-trailer">Trailer link</label>
                  <input id="movie-trailer" className="input" value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="movie-synopsis">Synopsis</label>
                  <textarea id="movie-synopsis" rows={2} className="input resize-y" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="A sentence or two about the film." />
                </div>
                <div className="sm:col-span-2">
                  <span className="label">Poster</span>
                  <ImageUploader media={posterMedia} onChange={setPosterMedia} max={1} label="Add poster" />
                </div>
              </div>
            </fieldset>
          )}

          {category?.kind === "BOOK" && (
            <fieldset className="rounded-2xl border border-line bg-raised/40 p-4">
              <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                <BookOpen className="h-3.5 w-3.5 text-brand-700" /> Book details
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="book-title">Book title</label>
                  <input id="book-title" className="input" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="The Shadow King" />
                </div>
                <div>
                  <label className="label" htmlFor="book-author">Author</label>
                  <input id="book-author" className="input" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} placeholder="Maaza Mengiste" />
                </div>
                <div>
                  <label className="label" htmlFor="book-genre">Genre</label>
                  <input id="book-genre" className="input" value={bookGenre} onChange={(e) => setBookGenre(e.target.value)} placeholder="Literary fiction" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="book-synopsis">What is it about?</label>
                  <textarea id="book-synopsis" rows={2} className="input resize-y" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} placeholder="A short summary for other readers." />
                </div>
                <div className="sm:col-span-2">
                  <span className="label">Cover image</span>
                  <ImageUploader media={posterMedia} onChange={setPosterMedia} max={1} label="Add cover" />
                </div>
              </div>
            </fieldset>
          )}

          {category?.kind === "HIKE" && (
            <fieldset className="rounded-2xl border border-line bg-raised/40 p-4">
              <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                <Mountain className="h-3.5 w-3.5 text-emerald-700" /> Trail details
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="hike-location">Location</label>
                  <input id="hike-location" className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mount Entoto, Addis Ababa" />
                </div>
                <div>
                  <label className="label" htmlFor="hike-difficulty">Difficulty</label>
                  <select id="hike-difficulty" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
                    {DIFFICULTIES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="hike-distance">Distance (km)</label>
                    <input id="hike-distance" type="number" step="0.1" min="0" className="input" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="7.5" />
                  </div>
                  <div>
                    <label className="label" htmlFor="hike-duration">Hours</label>
                    <input id="hike-duration" type="number" step="0.5" min="0" className="input" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} placeholder="2.5" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="hike-tips">Practical advice</label>
                  <textarea id="hike-tips" rows={3} className="input resize-y" value={tips} onChange={(e) => setTips(e.target.value)} placeholder="Start early, carry water, and tell someone where you're going…" />
                </div>
              </div>
            </fieldset>
          )}

          <div>
            <span className="label">Photos</span>
            <ImageUploader
              media={media.filter((item) => item.kind === "IMAGE")}
              onChange={(images) =>
                setMedia((current) => [...current.filter((item) => item.kind !== "IMAGE"), ...images])
              }
              max={6}
            />
          </div>

          <div>
            <span className="label">Voice note</span>
            {audio.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {audio.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <AudioPlayer src={item.url} durationMs={item.durationMs} compact />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setMedia((current) => current.filter((entry) => entry.id !== item.id))}
                      aria-label="Remove voice note"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : voiceOpen ? (
              <VoiceRecorder
                onUploaded={(uploaded) => {
                  setMedia((current) => [...current, uploaded]);
                  setVoiceOpen(false);
                }}
                onCancel={() => setVoiceOpen(false)}
              />
            ) : (
              <button type="button" className="btn-secondary btn-sm" onClick={() => setVoiceOpen(true)}>
                <Mic className="h-3.5 w-3.5" /> Record a voice note
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Info className="h-3.5 w-3.5" /> Be generous, be specific, and assume good faith.
            </p>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Share with the room
              </button>
            </div>
          </div>
        </div>
      </form>

      <p className="px-2 text-center text-[11px] text-muted">
        Posted publicly in the room you chose. You can edit or delete it any time.{" "}
        <Link to="/settings" className="underline hover:text-ink">
          Community guidelines
        </Link>
      </p>
    </div>
  );
}
