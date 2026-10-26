import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Coffee, ImagePlus, Loader2, Mic, PenSquare, Send } from "lucide-react";
import type { Category, Post } from "../types";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { useQuery } from "../hooks/useApi";
import { api, apiError } from "../lib/api";
import { categoryIcon, categoryPath, cn } from "../lib/utils";
import { categoryAmharic } from "../lib/brand";
import { Avatar } from "./ui";
import { ImageUploader } from "./ImageUploader";
import { VoiceRecorder } from "./VoiceRecorder";
import { AudioPlayer } from "./Media";
import { PollComposer, emptyPollDraft, pollDraftIsValid, type PollDraft } from "./PollComposer";

interface PostComposerProps {
  onCreated: () => void;
  /** When set, the room is locked (used on individual category pages). */
  fixedCategory?: Category;
  className?: string;
}

/**
 * The community-table composer: text, photos and voice notes in one place.
 * Used on the home feed and inside every discussion room.
 */
export function PostComposer({ onCreated, fixedCategory, className }: PostComposerProps) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const { data } = useQuery<{ categories: Category[] }>("/api/categories");

  const rooms = useMemo(
    () =>
      (data?.categories ?? []).filter(
        (category) =>
          category.kind === "DISCUSSION" ||
          (fixedCategory ? category.id === fixedCategory.id : false),
      ),
    [data, fixedCategory],
  );

  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState(fixedCategory?.id ?? "");
  const [focused, setFocused] = useState(false);
  const [media, setMedia] = useState<Post["media"]>([]);
  const [showImages, setShowImages] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!fixedCategory && !categoryId && rooms[0]) setCategoryId(rooms[0].id);
  }, [rooms, categoryId, fixedCategory]);

  if (!user) {
    return (
      <div className={cn("card flex flex-wrap items-center gap-4 p-5", className)}>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300">
          <Coffee className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold text-ink">
            {fixedCategory ? `Join the table in ${fixedCategory.name}` : "Join the conversation"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            እንኳን ደህና መጡ — create an account to share photos, voice notes and stories.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/register" className="btn-primary btn-sm">
            Join free
          </Link>
          <Link to="/login" className="btn-secondary btn-sm">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const hasMedia = media.length > 0;
  const hasPoll = pollOpen && pollDraftIsValid(pollDraft);
  const canSubmit = (body.trim().length > 0 || hasMedia || hasPoll) && Boolean(categoryId) && !submitting;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const response = await api.post<{ post: Post }>("/api/posts", {
        categoryId,
        body: body.trim(),
        mediaIds: media.map((item) => item.id),
        ...(hasPoll
          ? {
              poll: {
                question: pollDraft.question.trim(),
                options: pollDraft.options.map((option) => option.trim()).filter(Boolean),
              },
            }
          : {}),
      });
      setBody("");
      setMedia([]);
      setShowImages(false);
      setShowVoice(false);
      setPollOpen(false);
      setPollDraft(emptyPollDraft());
      setFocused(false);
      pushToast(hasMedia ? "Shared with the community." : "Your story is live.", {
        tone: "success",
        href: `/posts/${response.data.post.id}`,
      });
      onCreated();
    } catch (error) {
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = rooms.find((category) => category.id === categoryId) ?? fixedCategory;
  const SelectedIcon = selectedCategory ? categoryIcon(selectedCategory.icon) : null;
  const first = user.displayName.split(" ")[0];

  return (
    <form
      onSubmit={submit}
      className={cn(
        "card relative overflow-hidden p-4 sm:p-5",
        focused && "ring-2 ring-brand-500/25",
        className,
      )}
    >
      <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-70" />
      <div className="flex gap-3">
        <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          {selectedCategory && (
            <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {SelectedIcon && (
                <SelectedIcon className="h-3.5 w-3.5" style={{ color: selectedCategory.color }} />
              )}
              <span lang="am" className="font-ethiopic normal-case tracking-normal">
                {categoryAmharic(selectedCategory.slug) ?? selectedCategory.name}
              </span>
              <span className="text-muted/50">·</span>
              {fixedCategory ? "posting in this room" : selectedCategory.name}
            </p>
          )}

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onFocus={() => setFocused(true)}
            rows={focused ? 3 : 2}
            maxLength={10000}
            placeholder={
              fixedCategory
                ? `Share something with ${fixedCategory.name} — a thought, a photo or a voice note…`
                : `ምን አዲስ ነው, ${first}? Share a story, a photo or a voice note…`
            }
            className="w-full resize-none border-0 bg-transparent p-1 text-[0.95rem] leading-6 text-ink placeholder:text-muted/70 focus:outline-none"
            aria-label="Write a post"
          />

          {media.length > 0 && (
            <div className="mt-2 space-y-2">
              {media
                .filter((item) => item.kind === "AUDIO")
                .map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-2">
                    <AudioPlayer src={item.url} durationMs={item.durationMs} compact />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() =>
                        setMedia((current) => current.filter((entry) => entry.id !== item.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              {media.some((item) => item.kind === "IMAGE") && (
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {media.filter((item) => item.kind === "IMAGE").length} photo
                  {media.filter((item) => item.kind === "IMAGE").length === 1 ? "" : "s"} attached
                </p>
              )}
            </div>
          )}

          {showImages && (
            <div className="mt-3">
              <ImageUploader
                media={media.filter((item) => item.kind === "IMAGE")}
                onChange={(images) =>
                  setMedia((current) => [
                    ...current.filter((item) => item.kind !== "IMAGE"),
                    ...images,
                  ])
                }
              />
            </div>
          )}

          {showVoice && (
            <div className="mt-3">
              <VoiceRecorder
                onUploaded={(uploaded) => {
                  setMedia((current) => [...current, uploaded]);
                  setShowVoice(false);
                }}
                onCancel={() => setShowVoice(false)}
              />
            </div>
          )}

          {pollOpen && (
            <div className="mt-3">
              <PollComposer
                value={pollDraft}
                onChange={setPollDraft}
                onRemove={() => {
                  setPollOpen(false);
                  setPollDraft(emptyPollDraft());
                }}
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            {!fixedCategory && (
              <>
                <label className="sr-only" htmlFor="composer-category">
                  Room
                </label>
                <select
                  id="composer-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-muted focus:border-brand-400 focus:outline-none sm:w-auto sm:max-w-[9.5rem]"
                  aria-label="Choose a room"
                >
                  {rooms.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowImages((value) => !value)}
              className={cn(
                "btn-ghost btn-sm",
                !fixedCategory && "ml-auto",
                showImages && "text-brand-700",
              )}
              aria-label="Add photos"
              aria-pressed={showImages}
            >
              <ImagePlus className="h-4 w-4" /> Photo
            </button>
            <button
              type="button"
              onClick={() => setShowVoice((value) => !value)}
              className={cn("btn-ghost btn-sm", showVoice && "text-brand-700")}
              aria-label="Record a voice message"
              aria-pressed={showVoice}
            >
              <Mic className="h-4 w-4" /> Voice
            </button>
            <button
              type="button"
              onClick={() => setPollOpen((value) => !value)}
              className={cn("btn-ghost btn-sm", pollOpen && "text-brand-700")}
              aria-label="Add a poll"
              aria-pressed={pollOpen}
            >
              <BarChart3 className="h-4 w-4" /> Poll
            </button>
            {fixedCategory ? (
              <Link to={`/c/${fixedCategory.slug}`} className="btn-ghost btn-sm hidden sm:inline-flex">
                <PenSquare className="h-3.5 w-3.5" /> Room
              </Link>
            ) : (
              <Link to="/create" className="btn-ghost btn-sm hidden sm:inline-flex">
                <PenSquare className="h-3.5 w-3.5" /> Full editor
              </Link>
            )}
            <button type="submit" className="btn-primary btn-sm" disabled={!canSubmit}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Share
            </button>
          </div>
        </div>
      </div>
      {selectedCategory && !fixedCategory && (
        <p className="mt-3 pl-14 text-[11px] text-muted">
          Posting in{" "}
          <Link
            to={categoryPath(selectedCategory)}
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            {selectedCategory.name}
          </Link>
        </p>
      )}
    </form>
  );
}
