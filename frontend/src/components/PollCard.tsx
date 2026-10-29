import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Check, Lock, Loader2 } from "lucide-react";
import type { Poll } from "../types";
import { api, apiError } from "../lib/api";
import { connectSocket } from "../lib/socket";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { cn } from "../lib/utils";
import { tt } from "../lib/i18n";

interface PollCardProps {
  postId: string;
  poll: Poll;
  onChange?: (poll: Poll) => void;
}

interface PollUpdatePayload {
  postId: string;
  totalVotes: number;
  options: Array<{ id: string; voteCount: number }>;
}

/**
 * Poll attached to a post. Votes land on the API and movement is broadcast over
 * the shared Socket.IO connection, so every viewer sees new counts at once
 * while the voter's own choice stays highlighted.
 */
export function PollCard({ postId, poll, onChange }: PollCardProps) {
  const user = useAuth((state) => state.user);
  const pushToast = useUI((state) => state.pushToast);
  const navigate = useNavigate();

  const [data, setData] = useState(poll);
  const [busyOption, setBusyOption] = useState<string | null>(null);
  // Keep the callback in a ref so the socket subscription is not torn down on
  // every parent render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setData(poll), [poll]);

  const closed = Boolean(data.endsAt && new Date(data.endsAt).getTime() <= Date.now());

  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();

    const onUpdate = (payload: PollUpdatePayload) => {
      if (payload.postId !== postId) return;
      setData((current) => {
        const counts = new Map(payload.options.map((option) => [option.id, option.voteCount]));
        const next: Poll = {
          ...current,
          totalVotes: payload.totalVotes,
          options: current.options.map((option) => ({
            ...option,
            voteCount: counts.get(option.id) ?? option.voteCount,
          })),
        };
        onChangeRef.current?.(next);
        return next;
      });
    };

    socket.on("poll:update", onUpdate);
    return () => {
      socket.off("poll:update", onUpdate);
    };
  }, [postId, user?.id]);

  const apply = (next: Poll) => {
    setData(next);
    onChange?.(next);
  };

  const vote = async (optionId: string) => {
    if (closed || busyOption) return;
    if (!user) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    if (data.myOptionId === optionId) return;

    const previous = data;
    const previousOption = data.myOptionId;
    setBusyOption(optionId);
    apply({
      ...data,
      myOptionId: optionId,
      totalVotes: data.totalVotes + (previousOption ? 0 : 1),
      options: data.options.map((option) => {
        if (option.id === optionId) return { ...option, voteCount: option.voteCount + 1 };
        if (option.id === previousOption) {
          return { ...option, voteCount: Math.max(0, option.voteCount - 1) };
        }
        return option;
      }),
    });

    try {
      const response = await api.post<{ poll: Poll }>(`/api/posts/${postId}/poll/vote`, {
        optionId,
      });
      apply(response.data.poll);
    } catch (error) {
      apply(previous);
      pushToast(apiError(error), { tone: "error" });
    } finally {
      setBusyOption(null);
    }
  };

  const leader = Math.max(0, ...data.options.map((option) => option.voteCount));
  const showResults = Boolean(data.myOptionId) || closed;

  return (
    <div className="rounded-2xl border border-line bg-raised/40 p-3.5 sm:p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-ink">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
        <span className="min-w-0 flex-1">{data.question}</span>
      </p>

      <ul className="mt-3 space-y-2">
        {data.options.map((option) => {
          const percent = data.totalVotes
            ? Math.round((option.voteCount / data.totalVotes) * 100)
            : 0;
          const mine = data.myOptionId === option.id;
          const winning = showResults && option.voteCount > 0 && option.voteCount === leader;
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => void vote(option.id)}
                disabled={closed || Boolean(busyOption)}
                aria-pressed={mine}
                className={cn(
                  "relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition",
                  mine
                    ? "border-brand-600 bg-brand-50/70 dark:bg-brand-500/10"
                    : "border-line bg-surface hover:border-brand-300",
                  closed && "cursor-default",
                )}
              >
                {showResults && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 z-0 rounded-l-xl transition-all duration-500",
                      mine ? "bg-brand-600/15" : "bg-brand-600/10",
                    )}
                    style={{ width: `${percent}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      mine
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-line bg-surface text-transparent",
                    )}
                  >
                    {busyOption === option.id ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Check className="h-2.5 w-2.5" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm",
                      mine || winning ? "font-semibold text-ink" : "text-ink/90",
                    )}
                  >
                    {option.label}
                  </span>
                  {showResults && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
                      {percent}%
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <span className="tabular-nums">
          {data.totalVotes} {tt(data.totalVotes === 1 ? "vote" : "votes")}
          {!showResults && ` · ${tt("pick one to see results")}`}
        </span>
        {closed ? (
          <span className="inline-flex items-center gap-1 font-medium">
            <Lock className="h-3 w-3" /> Closed
          </span>
        ) : (
          data.myOptionId && <span className="font-medium text-brand-700 dark:text-brand-300">Your vote counts</span>
        )}
      </div>
    </div>
  );
}
