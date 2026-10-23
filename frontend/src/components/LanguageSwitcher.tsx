import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useTranslation } from "../store/i18n";
import { cn } from "../lib/utils";

interface LanguageSwitcherProps {
  compact?: boolean;
  className?: string;
  dropUp?: boolean;
}

export function LanguageSwitcher({
  compact = false,
  className,
  dropUp = false,
}: LanguageSwitcherProps) {
  const { lang, setLang, availableLanguages, currentLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("common.selectLanguage", "Select language")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface/90 text-xs font-semibold text-muted backdrop-blur transition hover:border-brand-500/40 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          compact ? "h-9 px-2.5" : "h-10 px-3",
        )}
      >
        <Globe className="h-4 w-4 text-brand-700 dark:text-brand-300" />
        <span className="text-sm">{currentLanguage.flag}</span>
        <span className={cn("font-medium", currentLanguage.fontClass)}>
          {compact ? currentLanguage.code.toUpperCase() : currentLanguage.nativeName}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("common.language", "Language")}
          className={cn(
            "absolute z-50 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-lift backdrop-blur-xl transition duration-150 animate-in fade-in zoom-in-95",
            dropUp ? "bottom-full mb-2 left-0" : "top-full mt-2 right-0 sm:right-auto sm:left-0",
          )}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted/70">
            {t("common.selectLanguage", "Select language")}
          </div>
          <div className="space-y-0.5">
            {availableLanguages.map((item) => {
              const selected = item.code === lang;
              return (
                <button
                  key={item.code}
                  role="option"
                  aria-selected={selected}
                  type="button"
                  onClick={() => {
                    setLang(item.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition",
                    selected
                      ? "bg-brand-50 font-semibold text-brand-900 dark:bg-brand-500/15 dark:text-brand-100"
                      : "text-muted hover:bg-raised hover:text-ink",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{item.flag}</span>
                    <div>
                      <span className={cn("block text-xs font-semibold leading-tight text-ink", item.fontClass)}>
                        {item.nativeName}
                      </span>
                      <span className="block text-[10px] text-muted">{item.name}</span>
                    </div>
                  </div>
                  {selected && (
                    <Check className="h-4 w-4 text-brand-700 dark:text-brand-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
