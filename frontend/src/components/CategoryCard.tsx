import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "../types";
import { categoryIcon, categoryPath, cn, formatCount, timeAgo } from "../lib/utils";
import { categoryAmharic, localizedCategoryName } from "../lib/brand";
import { roomArt } from "../lib/roomArt";
import { useTranslation } from "../store/i18n";

export function CategoryCard({ category, compact }: { category: Category; compact?: boolean }) {
  const { lang, t } = useTranslation();
  const Icon = categoryIcon(category.icon);
  const tint = `${category.color}14`;
  const amharic = categoryAmharic(category.slug);
  const art = roomArt(category.slug);
  const title = localizedCategoryName(category, lang);
  const subtitle = lang === "en" ? amharic : category.name;

  return (
    <Link
      to={categoryPath(category)}
      className={cn(
        "card group relative flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lift",
        "p-0",
      )}
    >
      {art ? (
        <div className="relative h-24 w-full overflow-hidden sm:h-28">
          <img
            src={art.photo}
            alt={art.alt}
            loading="lazy"
            width={640}
            height={280}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${category.color}3d, transparent 65%)` }}
          />
          <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-70" />
          <span
            className="absolute bottom-3 left-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 backdrop-blur-sm"
            style={{ backgroundColor: `${category.color}ee`, color: "#fff" }}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden" style={{ backgroundColor: tint }}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl"
            style={{ backgroundColor: tint }}
          />
          <div className="flex items-start justify-between px-5 pt-5">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: tint, color: category.color }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          {art && (
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
          )}
        </div>
        {subtitle && (
          <p lang={lang === "en" ? "am" : undefined} className={cn("text-xs text-muted", lang === "en" && "font-ethiopic")}>
            {subtitle}
          </p>
        )}
        {!compact && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{category.description}</p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-3 text-[11px] font-medium text-muted">
          <span>{formatCount(category.postCount ?? 0)} stories</span>
          {category.lastPostAt && (
            <>
              <span className="text-muted/40">·</span>
              <span>{timeAgo(category.lastPostAt)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
