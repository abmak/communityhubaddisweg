import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useUI } from "../store/ui";
import { cn } from "../lib/utils";

export function ToastViewport() {
  const toasts = useUI((state) => state.toasts);
  const dismissToast = useUI((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end">
      {toasts.map((toast) => {
        const Icon = toast.tone === "error" ? AlertCircle : toast.tone === "success" ? CheckCircle2 : Info;
        const content = (
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lift animate-slide-up",
              toast.tone === "error" && "border-rose-200 dark:border-rose-500/30",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                toast.tone === "error"
                  ? "text-rose-600"
                  : toast.tone === "success"
                    ? "text-emerald-600"
                    : "text-brand-700",
              )}
            />
            <span className="flex-1 leading-5 text-ink">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-0.5 text-muted transition hover:text-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );

        return toast.href ? (
          <Link key={toast.id} to={toast.href} className="w-full max-w-sm" onClick={() => dismissToast(toast.id)}>
            {content}
          </Link>
        ) : (
          <div key={toast.id} className="w-full max-w-sm">
            {content}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
