import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Loader2, Star, X, type LucideIcon } from "lucide-react";
import { cn, initials } from "../lib/utils";
import { mediaSrc } from "../lib/api";

const AVATAR_SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
  hero: "h-28 w-28 text-3xl",
} as const;

type AvatarSize = keyof typeof AVATAR_SIZES;

const avatarGradients = [
  "from-brand-700 to-brand-400",
  "from-accent-600 to-accent-400",
  "from-coffee-700 to-coffee-400",
  "from-eth-red to-rose-400",
  "from-brand-900 to-accent-500",
  "from-coffee-800 to-accent-300",
];

interface AvatarProps {
  name?: string | null;
  username?: string | null;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  online?: boolean;
}

export function Avatar({ name, username, src, size = "md", className, online }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const label = name || username || "Community member";
  const hash = Array.from(username || label).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const gradient = avatarGradients[hash % avatarGradients.length];

  useEffect(() => setFailed(false), [src]);

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src && !failed ? (
        <img
          src={mediaSrc(src)}
          alt={label}
          className={cn(
            "rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10",
            AVATAR_SIZES[size],
          )}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span
          aria-label={label}
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-black/5 dark:ring-white/10",
            gradient,
            AVATAR_SIZES[size],
          )}
        >
          {initials(label)}
        </span>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full border-2 border-surface",
            size === "xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
            online ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
          )}
          title={online ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand-700", className)} aria-label="Loading" />;
}

export function PageLoader({ label = "Loading the conversation…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted">
      <Spinner className="h-7 w-7" />
      {label}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-raised text-brand-700 dark:text-brand-300">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "brand" | "accent" | "danger";
}) {
  const tones = {
    neutral: "bg-raised text-muted ring-line",
    brand: "bg-brand-50 text-brand-800 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300",
    accent: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
}

export function Modal({ open, onClose, title, description, children, className, hideClose }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-lift animate-slide-up sm:max-w-lg sm:rounded-2xl sm:p-6",
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted transition hover:bg-raised hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busy,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4 text-white" /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Dropdown({
  trigger,
  children,
  align = "right",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-40 mt-2 min-w-[190px] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-lift animate-fade-in",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function Stars({
  value,
  max = 5,
  size = 14,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of ${max}`}>
      {Array.from({ length: max }).map((_, index) => {
        const filled = index + 1 <= Math.round(value);
        return (
          <Star
            key={index}
            style={{ width: size, height: size }}
            className={filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-line"}
          />
        );
      })}
    </span>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PostSkeleton() {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
      </div>
      <div className="skeleton h-52 w-full rounded-xl" />
    </div>
  );
}

export function UserRowLink({
  user,
  subtitle,
}: {
  user: { username: string; displayName: string; avatarUrl: string | null; online?: boolean };
  subtitle?: string;
}) {
  return (
    <Link
      to={`/u/${user.username}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-raised"
    >
      <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="sm" online={user.online} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{user.displayName}</span>
        <span className="block truncate text-xs text-muted">{subtitle ?? `@${user.username}`}</span>
      </span>
    </Link>
  );
}
