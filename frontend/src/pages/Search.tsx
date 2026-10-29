import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clapperboard,
  Compass,
  LayoutGrid,
  Mountain,
  Search as SearchIcon,
  Users,
} from "lucide-react";
import type { Category, Post, User } from "../types";
import { useQuery } from "../hooks/useApi";
import { useAuth } from "../store/auth";
import { Avatar, Badge, EmptyState, PageLoader, Spinner } from "../components/ui";
import { CategoryCard } from "../components/CategoryCard";
import { PostCard } from "../components/PostCard";
import { SafeImage } from "../components/Media";
import { FollowButton } from "../components/UserCard";
import { tt } from "../lib/i18n";
import { cn, formatCount, postPath, timeAgo } from "../lib/utils";

type SearchType = "all" | "posts" | "members" | "categories" | "movies" | "books" | "hikes";

interface SearchResponse {
  query: string;
  type: SearchType;
  posts: Post[];
  movies: Post[];
  books: Post[];
  hikes: Post[];
  members: User[];
  categories: Category[];
  meta: { page: number; limit: number; hasMore: boolean; total?: number };
}

const TYPES: Array<{ id: SearchType; label: string; icon: typeof SearchIcon }> = [
  { id: "all", label: "Everything", icon: Compass },
  { id: "posts", label: "Conversations", icon: SearchIcon },
  { id: "members", label: "Members", icon: Users },
  { id: "categories", label: "Categories", icon: LayoutGrid },
  { id: "movies", label: "Cinema", icon: Clapperboard },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "hikes", label: "Trails", icon: Mountain },
];

const SUGGESTIONS = [
  "Lambadina",
  "coffee ceremony",
  "Maaza Mengiste",
  "Simien Mountains",
  "Teza",
  "football",
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const user = useAuth((state) => state.user);
  const query = params.get("q") ?? "";
  const type = (params.get("type") as SearchType | null) ?? "all";
  const [term, setTerm] = useState(query);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"latest" | "popular">("latest");

  useEffect(() => {
    setTerm(query);
    setPage(1);
  }, [query, type]);

  const url =
    query.trim().length >= 2
      ? `/api/search?q=${encodeURIComponent(query.trim())}&type=${type}&page=${page}&limit=10&sort=${sort}`
      : null;
  const { data, loading, error } = useQuery<SearchResponse>(url);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    setPage(1);
    setParams({ q: trimmed, ...(type !== "all" ? { type } : {}) });
  };

  const changeType = (next: SearchType) => {
    setPage(1);
    setParams({ ...(query ? { q: query } : {}), ...(next !== "all" ? { type: next } : {}) });
  };

  const resultCount =
    (data?.posts.length ?? 0) +
    (data?.movies.length ?? 0) +
    (data?.books.length ?? 0) +
    (data?.hikes.length ?? 0) +
    (data?.members.length ?? 0) +
    (data?.categories.length ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          <SearchIcon className="h-3.5 w-3.5" /> Search
          <span lang="am" className="font-ethiopic normal-case tracking-normal text-muted">
            ፍለጋ
          </span>
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Find a conversation, a member or a recommendation.
        </h1>
      </header>

      <form onSubmit={submit} className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search አዲስ ገበታ — people, stories, films…"
          className="input h-12 rounded-2xl pl-12 pr-28 text-base shadow-card"
          aria-label="Search"
        />
        <button type="submit" className="btn-primary absolute right-1.5 top-1/2 -translate-y-1/2">
          Search
        </button>
      </form>

      {query.length < 2 ? (
        <div className="card p-6">
          <EmptyState
            icon={Compass}
            title="What are you curious about?"
            description="Search films, books, trails, members or categories. Try one of these to get started."
            className="py-8"
          />
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                onClick={() => setParams({ q: suggestion })}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
            {TYPES.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => changeType(option.id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition",
                    type === option.id
                      ? "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-700"
                      : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tt(option.label)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <p>
              {loading ? "Searching…" : `${formatCount(resultCount)} results for “${query}”`}
            </p>
            {(type === "posts" || type === "all") && (
              <div className="flex items-center gap-1">
                {(["latest", "popular"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSort(option);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-lg px-2 py-1 font-medium capitalize transition",
                      sort === option ? "bg-raised text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <Spinner className="h-7 w-7" />
            </div>
          ) : error ? (
            <div className="card p-8 text-center text-sm text-rose-600">{error}</div>
          ) : !data || resultCount === 0 ? (
            <div className="card">
              <EmptyState
                icon={SearchIcon}
                title={`No results for “${query}”`}
                description="Try a different name, a shorter phrase, or browse the categories instead."
                action={
                  <Link to="/categories" className="btn-secondary btn-sm">
                    <LayoutGrid className="h-3.5 w-3.5" /> Browse categories
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="space-y-6">
              {type === "all" ? (
                <>
                  {data.posts.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Conversations</h2>
                      <div className="space-y-4">
                        {data.posts.map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                      <Link
                        to={`/search?q=${encodeURIComponent(query)}&type=posts`}
                        className="btn-secondary btn-sm mt-3"
                      >
                        All conversation results <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </section>
                  )}

                  {data.movies.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-lg font-semibold text-ink">From Ethiopian cinema</h2>
                      <div className="space-y-2">
                        {data.movies.map((post) => (
                          <CompactResult key={post.id} post={post} label="Film" />
                        ))}
                      </div>
                    </section>
                  )}

                  {data.books.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Book reviews</h2>
                      <div className="space-y-2">
                        {data.books.map((post) => (
                          <CompactResult key={post.id} post={post} label="Book" />
                        ))}
                      </div>
                    </section>
                  )}

                  {data.hikes.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Trail stories</h2>
                      <div className="space-y-2">
                        {data.hikes.map((post) => (
                          <CompactResult key={post.id} post={post} label="Trail" />
                        ))}
                      </div>
                    </section>
                  )}

                  {data.members.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Members</h2>
                      <div className="card divide-y divide-line">
                        {data.members.map((member) => (
                          <MemberRow key={member.id} member={member} viewerId={user?.id} />
                        ))}
                      </div>
                    </section>
                  )}

                  {data.categories.length > 0 && (
                    <section>
                      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Categories</h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {data.categories.map((category) => (
                          <CategoryCard key={category.id} category={category} compact />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : type === "members" ? (
                <div className="card divide-y divide-line">
                  {data.members.map((member) => (
                    <MemberRow key={member.id} member={member} viewerId={user?.id} />
                  ))}
                </div>
              ) : type === "categories" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.categories.map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {(type === "posts" ? data.posts : type === "movies" ? data.movies : type === "books" ? data.books : data.hikes).map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}

              {type !== "all" && type !== "categories" && (
                <div className="flex items-center justify-between border-t border-line pt-4">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  <span className="text-xs text-muted">Page {page}</span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={!data.meta.hasMore}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CompactResult({ post, label }: { post: Post; label: string }) {
  const image =
    post.movie?.posterUrl ?? post.book?.coverUrl ?? post.media[0]?.thumbnailUrl ?? post.media[0]?.url;
  return (
    <Link
      to={postPath(post)}
      className="card flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <SafeImage src={image} alt={post.title ?? label} className="h-14 w-14 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
          {label}
        </p>
        <p className="truncate font-medium text-ink">
          {post.title ?? post.movie?.movieTitle ?? post.book?.bookTitle ?? post.hike?.location}
        </p>
        <p className="text-[11px] text-muted">
          {post.author.displayName} · {timeAgo(post.createdAt)}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}

function MemberRow({ member, viewerId }: { member: User; viewerId?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/u/${member.username}`} className="shrink-0">
        <Avatar name={member.displayName} username={member.username} src={member.avatarUrl} size="md" online={member.online} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/u/${member.username}`} className="block truncate font-semibold text-ink hover:text-brand-700">
          {member.displayName}
        </Link>
        <p className="truncate text-xs text-muted">
          @{member.username}
          {member.followerCount !== undefined && ` · ${formatCount(member.followerCount)} followers`}
        </p>
        {member.bio && <p className="mt-0.5 line-clamp-1 text-xs text-muted/80">{member.bio}</p>}
      </div>
      {viewerId !== member.id && (
        <FollowButton user={member} className="shrink-0" />
      )}
      {viewerId === member.id && <Badge>You</Badge>}
    </div>
  );
}
