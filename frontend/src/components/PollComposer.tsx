import { BarChart3, Plus, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface PollDraft {
  question: string;
  options: string[];
}

export const MAX_POLL_OPTIONS = 6;

export function emptyPollDraft(): PollDraft {
  return { question: "", options: ["", ""] };
}

/** A draft is publishable with a question and two or more distinct options. */
export function pollDraftIsValid(draft: PollDraft): boolean {
  const labels = draft.options.map((option) => option.trim()).filter(Boolean);
  return (
    draft.question.trim().length > 0 &&
    labels.length >= 2 &&
    new Set(labels.map((label) => label.toLowerCase())).size === labels.length
  );
}

interface PollComposerProps {
  value: PollDraft;
  onChange: (draft: PollDraft) => void;
  onRemove: () => void;
  className?: string;
}

export function PollComposer({ value, onChange, onRemove, className }: PollComposerProps) {
  const setOption = (index: number, label: string) => {
    const options = value.options.map((option, i) => (i === index ? label : option));
    onChange({ ...value, options });
  };

  const addOption = () => {
    if (value.options.length >= MAX_POLL_OPTIONS) return;
    onChange({ ...value, options: [...value.options, ""] });
  };

  const removeOption = (index: number) => {
    if (value.options.length <= 2) return;
    onChange({ ...value, options: value.options.filter((_, i) => i !== index) });
  };

  return (
    <div className={cn("rounded-2xl border border-line bg-raised/40 p-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <BarChart3 className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" /> Poll
        </p>
        <button type="button" className="btn-ghost btn-sm" onClick={onRemove}>
          <X className="h-3.5 w-3.5" /> Remove
        </button>
      </div>

      <label className="mt-2.5 block">
        <span className="sr-only">Poll question</span>
        <input
          value={value.question}
          onChange={(event) => onChange({ ...value, question: event.target.value })}
          maxLength={200}
          placeholder="Ask the room — Best Ethiopian movie of the decade?"
          className="input"
          aria-label="Poll question"
        />
      </label>

      <div className="mt-2 space-y-1.5">
        {value.options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
            >
              {String.fromCharCode(65 + index)}
            </span>
            <input
              value={option}
              onChange={(event) => setOption(index, event.target.value)}
              maxLength={80}
              placeholder={`Option ${index + 1}`}
              className="input h-9"
              aria-label={`Poll option ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={value.options.length <= 2}
              className="btn-ghost btn-sm shrink-0 px-2 disabled:opacity-30"
              aria-label={`Remove option ${index + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={addOption}
          disabled={value.options.length >= MAX_POLL_OPTIONS}
          className="btn-ghost btn-sm disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add option
        </button>
        <span className="text-[10px] text-muted">
          {value.options.length}/{MAX_POLL_OPTIONS} options · one vote each
        </span>
      </div>
    </div>
  );
}
