import { Link } from "react-router-dom";
import { ArrowRight, LayoutGrid, Sparkles } from "lucide-react";
import type { Category } from "../types";
import { useQuery } from "../hooks/useApi";
import { CategoryCard } from "../components/CategoryCard";
import { EmptyState } from "../components/ui";
import { formatCount } from "../lib/utils";
import { useTranslation } from "../store/i18n";

export function CategoriesPage() {
  const { t, lang } = useTranslation();
  const { data, loading } = useQuery<{ categories: Category[] }>("/api/categories");
  const categories = data?.categories ?? [];
  const totalPosts = categories.reduce((sum, category) => sum + (category.postCount ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-8 text-white sm:px-8">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-accent-500/20 blur-3xl"
        />
        <span aria-hidden="true" className="tilet-strip absolute inset-y-0 right-0 w-24 opacity-30 sm:w-40" />
        <div className="relative max-w-xl">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-200">
            <LayoutGrid className="h-3.5 w-3.5" /> {t("nav.categories", "Community rooms")}
            {lang === "en" && (
              <span lang="am" className="font-ethiopic normal-case tracking-normal text-accent-200">
                የእኛ ማህበረሰብ
              </span>
            )}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
            {lang === "am"
              ? "እያንዳንዱ ፍላጎት በጠረጴዛችን ዙሪያ መቀመጫ አለው።"
              : lang === "om"
                ? "Fedhiin hundi teessuma qaba."
                : "Every interest has a seat at the table."}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            {categories.length} {t("nav.categories", "rooms")}, {formatCount(totalPosts)} {t("places.matches", "stories")}.
          </p>
        </div>
        <span className="eth-band absolute inset-x-0 bottom-0 h-[3px]" />
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-[170px] rounded-2xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Sparkles}
            title="No categories yet"
            description="An administrator can create the first community space from the admin dashboard."
            action={
              <Link to="/admin/overview" className="btn-primary btn-sm">
                Open admin <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-display text-base font-semibold text-ink">Not sure where to sit?</p>
          <p className="mt-1 text-sm text-muted">
            Start with ቡና ቤት (Coffee Talk), or browse the most active stories on Explore.
          </p>
        </div>
        <Link to="/explore" className="btn-secondary btn-sm">
          Explore the community <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
