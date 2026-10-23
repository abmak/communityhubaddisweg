import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Clapperboard,
  Coffee,
  Compass,
  Heart,
  LocateFixed,
  MapPin,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  Music,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useUI } from "../store/ui";
import { useQuery } from "../hooks/useApi";
import type {
  ExploreData,
  Place,
  PlaceKind,
  PlacesResponse,
  Post,
  PostsResponse,
} from "../types";
import { Avatar } from "../components/ui";
import { BrandMark, Wordmark } from "../components/Brand";
import { CategoryCard } from "../components/CategoryCard";
import { PostCard } from "../components/PostCard";
import { cn, formatCount } from "../lib/utils";
import { KIND_META, PLACE_KINDS, formatDistance, placePath } from "../lib/places";
import { BRAND } from "../lib/brand";
// The hero shows the interests the hub brings together — coffee, trails, books and cinema.
// All four photos are CC-licensed Wikimedia Commons files; credit lives in README.md.
import coffeeTalkTile from "../assets/rooms/coffee-talk.webp";
import hikingTile from "../assets/rooms/hiking.webp";
import booksTile from "../assets/rooms/books.webp";
import cinemaTile from "../assets/rooms/cinema.webp";
import musicTile from "../assets/rooms/music.webp";
import paintingTile from "../assets/rooms/painting.webp";

const FEATURES = [
  {
    icon: Coffee,
    title: "A table to talk at",
    body: "Coffee, cinema, books, trails, music, art and travel — rooms where every voice has a seat.",
  },
  {
    icon: Mic,
    title: "Your voice, not just text",
    body: "Record a thought on the way home and drop it into the conversation.",
  },
  {
    icon: MessageCircle,
    title: "Replies worth reading",
    body: "Threaded comments that keep a discussion readable, with notifications when someone answers.",
  },
  {
    icon: ShieldCheck,
    title: "Kept generous",
    body: "Reports reach real moderators. Presence is private by default. You choose what you share.",
  },
];

const ROOM_TILES = [
  {
    label: "Coffee Talk",
    am: "ቡና ቤት",
    icon: Coffee,
    image: coffeeTalkTile,
    alt: "Ethiopian coffee ceremony — jebena poured into small cups",
  },
  {
    label: "Hiking",
    am: "የእግር ጉዞ",
    icon: Compass,
    image: hikingTile,
    alt: "Highland escarpment and trails in the Simien Mountains",
  },
  {
    label: "Books",
    am: "መጻሕፍት",
    icon: BookOpen,
    image: booksTile,
    alt: "Shelves of biography volumes in a reading room",
  },
  {
    label: "Cinema",
    am: "ፊልም",
    icon: Clapperboard,
    image: cinemaTile,
    alt: "Cinema auditorium with rows of seats facing the screen",
  },
  {
    label: "Music",
    am: "ሙዚቃ",
    icon: Music,
    image: musicTile,
    alt: "Musician singing and playing a krar, the Ethiopian lyre",
  },
  {
    label: "Painting",
    am: "ሥዕል",
    icon: Palette,
    image: paintingTile,
    alt: "Painter working at an easel with a palette in hand",
  },
];

function WegScene({ members, posts, rooms }: { members: number; posts: number; rooms: number }) {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-md">
      <div className="relative overflow-hidden rounded-[2rem] border border-brand-900/20 bg-brand-950 shadow-lift">
        <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 z-10 h-1.5 opacity-80" />

        <div className="grid grid-cols-2 gap-px bg-white/10">
          {ROOM_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <figure key={tile.label} className="relative overflow-hidden">
                <img
                  src={tile.image}
                  alt={tile.alt}
                  className="aspect-square w-full object-cover"
                  width={640}
                  height={640}
                  loading="eager"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-950/25 to-transparent"
                />
                <figcaption className="absolute inset-x-2.5 bottom-2 flex min-w-0 items-center gap-1.5 text-white">
                  <Icon className="h-3 w-3 shrink-0 text-accent-300" />
                  <span lang="am" className="font-ethiopic shrink-0 text-[11px] text-accent-100">
                    {tile.am}
                  </span>
                  <span className="truncate text-[9px] uppercase tracking-[0.16em] text-white/70">
                    {tile.label}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>

        <div className="relative px-4 pb-4 pt-3.5 text-white">
          <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <UtensilsCrossed className="h-3 w-3 shrink-0 text-accent-300" />
              <span lang="am" className="font-ethiopic normal-case tracking-normal text-accent-200">
                የወግ ጊዜ
              </span>
              <span className="text-white/25">·</span>
              <span className="truncate">the shared table</span>
            </span>
            <span className="shrink-0">{rooms} rooms</span>
          </div>

          <p className="mt-2 font-display text-[1.15rem] leading-snug">One table, every interest.</p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Rooms", value: String(rooms) },
              { label: "Members", value: `${formatCount(members)}+` },
              { label: "Stories", value: formatCount(posts) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-2"
              >
                <p className="font-display text-lg font-semibold text-white">{stat.value}</p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-3 hidden w-full max-w-md items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-card sm:flex">
        <Avatar name="Selam Tesfaye" username="selam" size="xs" />
        <p className="min-w-0 flex-1 truncate text-[11px] leading-4 text-muted">
          <span className="font-semibold text-ink">Selam</span> shared a photo in Coffee Talk
        </p>
        <span className="shrink-0 text-[9px] text-muted/70">now</span>
      </div>
    </div>
  );
}

function NearbyPreview({ places }: { places: Place[] }) {
  const navigate = useNavigate();
  const [locating, setLocating] = useState(false);

  if (places.length === 0) return null;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      navigate("/places");
      return;
    }
    setLocating(true);
    // A dismissed or ignored permission prompt never fires a callback in some
    // browsers, so the directory stays reachable either way.
    let settled = false;
    const fallback = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setLocating(false);
      navigate("/places");
    }, 9000);

    const done = () => {
      settled = true;
      window.clearTimeout(fallback);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        done();
        const { latitude, longitude } = position.coords;
        navigate(`/places?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}&sort=distance`);
      },
      () => {
        if (settled) return;
        done();
        setLocating(false);
        navigate("/places");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  };

  return (
    <section id="nearby" className="py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="kicker">አቅራቢያ · Nearby</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              Cinema, coffee, castles, trails.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              A member-kept directory of the places worth leaving the house for — sorted by how
              far they are from wherever you are standing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="btn-secondary btn-sm"
            >
              <LocateFixed className={cn("h-3.5 w-3.5", locating && "animate-spin")} />
              {locating ? "Finding you…" : "Places near me"}
            </button>
            <Link
              to="/places"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              Open the directory <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {PLACE_KINDS.slice(0, 6).map((kind) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <Link
                key={kind}
                to={`/places?kind=${kind}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:border-brand-400/60 hover:text-ink"
              >
                <Icon className={cn("h-3.5 w-3.5", meta.iconTone)} /> {meta.label}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((place) => {
            const meta = KIND_META[place.kind];
            const Icon = meta.icon;
            const distance = formatDistance(place.distanceKm);
            return (
              <Link
                key={place.id}
                to={placePath(place)}
                className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-brand-600/25 hover:shadow-lift"
              >
                <div className="relative h-40 overflow-hidden bg-brand-950">
                  <img
                    src={meta.photo}
                    alt={meta.photoAlt}
                    loading="lazy"
                    width={1200}
                    height={800}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/40 to-transparent"
                  />
                  <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1 opacity-80" />

                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5 text-white">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] backdrop-blur-sm">
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <h3 className="mt-1.5 truncate font-display text-[1.1rem] font-semibold leading-tight">
                        {place.name}
                      </h3>
                    </div>
                    {distance && (
                      <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
                        {distance}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-[11px] text-muted">
                    {place.area ? `${place.area} · ` : ""}
                    {place.city}
                  </p>
                  <p className="line-clamp-2 text-[13px] leading-6 text-muted">
                    {place.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 pt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {place.rating.toFixed(1)}
                      <span className="font-normal text-muted">({place.reviewCount})</span>
                    </span>
                    <span className="inline-flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700 dark:text-brand-300">
                      {place.highlight ?? "Worth the trip"} <ArrowRight className="h-3 w-3 shrink-0" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  const user = useAuth((state) => state.user);
  const theme = useUI((state) => state.theme);
  const setTheme = useUI((state) => state.setTheme);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const { data: explore } = useQuery<ExploreData>("/api/explore");
  const { data: popular } = useQuery<PostsResponse>("/api/posts?sort=popular&limit=3");
  const { data: categoriesData } = useQuery<{ categories: ExploreData["categories"] }>("/api/categories");
  const { data: placesData } = useQuery<PlacesResponse>("/api/places?limit=8");

  // One card per kind, so the preview reads as a mix rather than three trailheads.
  const nearbyPicks = useMemo(() => {
    const seen = new Set<PlaceKind>();
    const picks: Place[] = [];
    for (const place of placesData?.places ?? []) {
      if (seen.has(place.kind)) continue;
      seen.add(place.kind);
      picks.push(place);
      if (picks.length === 3) break;
    }
    return picks;
  }, [placesData]);

  const categories = categoriesData?.categories ?? explore?.categories ?? [];
  const members = explore?.stats.members ?? 0;
  const posts = explore?.stats.posts ?? 0;
  const previewPosts: Post[] = popular?.posts ?? [];

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const cycleTheme = () =>
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (term.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10" glow />
            <Wordmark />
          </Link>

          <nav className="ml-8 hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a href="#rooms" className="transition hover:text-ink">
              Rooms
            </a>
            <a href="#nearby" className="transition hover:text-ink">
              Nearby
            </a>
            <a href="#happening" className="transition hover:text-ink">
              Today at the table
            </a>
            <a href="#why" className="transition hover:text-ink">
              Why join
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={cycleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink"
              aria-label="Switch theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            {user ? (
              <>
                <Link to="/home" className="btn-primary btn-sm">
                  Open feed <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link to={`/u/${user.username}`} className="ml-0.5">
                  <Avatar name={user.displayName} username={user.username} src={user.avatarUrl} size="sm" />
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm hidden sm:inline-flex">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  Join the table
                </Link>
              </>
            )}
          </div>
        </div>
        <span className="eth-band absolute inset-x-0 bottom-0 h-[2px] opacity-70" />
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <span aria-hidden="true" className="eth-hero-glow absolute inset-0" />
          <span aria-hidden="true" className="tilet-strip absolute inset-y-0 left-0 w-16 opacity-25 sm:w-28" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:pb-24 lg:pt-16">
            <div className="min-w-0 animate-slide-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
                <Sparkles className="h-3.5 w-3.5 text-accent-600" />
                <span lang="am" className="font-ethiopic">እንኳን ደህና መጡ</span>
                <span className="text-brand-700/40 dark:text-brand-200/40">·</span>
                Welcome to the table
              </span>

              <h1 className="mt-5 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.02em] text-ink sm:text-6xl">
                <span lang="am" className="font-ethiopic block text-[2.55rem] leading-[1.15] text-brand-800 dark:text-brand-300 sm:text-[3.4rem]">
                  አዲስ ወግ
                </span>
                <span className="mt-3 block">
                  A new way,
                  <span className="relative ml-2 inline-block">
                    <span className="relative z-10">shared stories.</span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-1 z-0 h-3 -rotate-1 rounded-full bg-accent-300/60 dark:bg-accent-500/25"
                    />
                  </span>
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
                A community hub with an Ethiopian soul — coffee-table conversation, cinema, books,
                trails, music, painting, travel and the life stories in between. Share a photo,
                leave a voice note, and stay for the replies.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to={user ? "/home" : "/register"} className="btn-primary px-5 py-3">
                  {user ? "Open the feed" : "Pull up a chair"} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/categories" className="btn-secondary px-5 py-3">
                  <Compass className="h-4 w-4" /> Browse the rooms
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-xs text-muted">
                <span className="flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {["#0f6b3a", "#b57c3f", "#c8102e", "#e9b949"].map((color) => (
                      <span
                        key={color}
                        className="h-6 w-6 rounded-full border-2 border-canvas"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span>{formatCount(members)}+ members around the table</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-brand-700" /> {formatCount(posts)} stories
                </span>
                <span className="flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-brand-700" /> voice-first
                </span>
              </div>
            </div>

            <WegScene members={members} posts={posts} rooms={categories.length} />
          </div>
        </section>

        {/* Rooms */}
        <section id="rooms" className="border-y border-line bg-surface/70 py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="kicker">የእኛ ማህበረሰብ · Community rooms</p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                  {categories.length || 11} tables. One community.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Each room has its own feed, photos, voice notes and threaded discussion. Pick a
                  chair.
                </p>
              </div>
              <Link
                to="/categories"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                All categories <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.slice(0, 12).map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
              {categories.length === 0 &&
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="skeleton h-[156px] w-full rounded-2xl" />
                ))}
            </div>
          </div>
        </section>

        <NearbyPreview places={nearbyPicks} />

        {/* Happening now */}
        <section id="happening" className="border-t border-line py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="kicker">በዛሬው ዕለት · Live from the community</p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                    Happening right now.
                  </h2>
                </div>
                <Link
                  to="/home"
                  className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block dark:text-brand-300"
                >
                  Open the feed
                </Link>
              </div>
              <div className="space-y-4">
                {previewPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {previewPosts.length === 0 && (
                  <div className="card p-8 text-center text-sm text-muted">
                    The first conversations are just getting started.
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card">
                <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-1.5" />
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-700" />
                  <h3 className="text-sm font-semibold text-ink">The community so far</h3>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted">Members</dt>
                    <dd className="font-display text-2xl font-semibold text-ink">{formatCount(members)}+</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted">Stories</dt>
                    <dd className="font-display text-2xl font-semibold text-ink">{formatCount(posts)}</dd>
                  </div>
                </dl>
                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  {FEATURES.slice(0, 3).map((feature) => (
                    <div key={feature.title} className="flex items-start gap-2.5">
                      <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
                      <p className="text-xs leading-5 text-muted">{feature.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-brand-900 p-5 text-white">
                <span aria-hidden="true" className="tilet-strip absolute inset-y-0 right-0 w-16 opacity-25" />
                <Heart className="h-5 w-5 text-accent-300" />
                <p lang="am" className="mt-3 font-ethiopic text-base leading-7 text-white/90">
                  “ቡና ሲጠጡ ወዳጅ ይሆናሉ።”
                </p>
                <p className="mt-2 font-display text-sm leading-6 text-white/80">
                  Share a cup, and strangers become friends.
                </p>
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Ethiopian proverb
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* Why join */}
        <section id="why" className="border-y border-line bg-surface/60 py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-8 max-w-2xl">
              <p className="kicker">ለምን አዲስ ወግ · Thoughtfully built</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
                Made for conversation, not performance.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="card p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-display text-base font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{feature.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Coffee, label: "ቡና ቤት", value: "Coffee Talk" },
                { icon: Clapperboard, label: "የኢትዮጵያ ፊልም", value: "Ethiopian Cinema" },
                { icon: BookOpen, label: "የመጽሐፍ ግምገማ", value: "Book Reviews" },
              ].map((item) => (
                <Link
                  key={item.value}
                  to="/categories"
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition hover:border-brand-400/60 hover:shadow-card"
                >
                  <item.icon className="h-5 w-5 text-brand-700 dark:text-brand-300" />
                  <span>
                    <span lang="am" className="block font-ethiopic text-sm font-semibold text-ink">
                      {item.label}
                    </span>
                    <span className="block text-[11px] text-muted">{item.value}</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted/60" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="relative overflow-hidden rounded-[28px] bg-brand-900 px-7 py-12 text-white sm:px-12">
              <span aria-hidden="true" className="tilet-strip absolute inset-x-0 top-0 h-2 opacity-50" />
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
              />
              <div className="relative max-w-2xl">
                <Coffee className="h-7 w-7 text-accent-300" />
                <h2 className="mt-4 font-display text-3xl font-medium leading-tight sm:text-4xl">
                  Pull up a chair. The next story is already starting.
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-white/65">
                  Free to join, easy to leave, and built to feel like the best table at your
                  favourite café. Bring what you are reading, watching, cooking or planning.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/register" className="btn bg-accent-400 px-5 py-3 text-brand-950 hover:bg-accent-300">
                    Create your account <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/explore"
                    className="btn border border-white/20 px-5 py-3 text-white hover:bg-white/10"
                  >
                    Have a look around
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <div>
              <p className="font-ethiopic text-sm font-semibold text-ink" lang="am">
                አዲስ ወግ <span className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Addis Weg</span>
              </p>
              <p className="text-[11px] text-muted">{BRAND.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-muted">
            <Link to="/categories" className="hover:text-ink">
              Categories
            </Link>
            <Link to="/explore" className="hover:text-ink">
              Explore
            </Link>
            <Link to="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link to="/register" className="hover:text-ink">
              Join
            </Link>
            <form onSubmit={search} className="relative">
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search…"
                className="h-8 rounded-full border border-line bg-transparent px-3 pr-8 text-xs focus:outline-none"
                aria-label="Search Addis Weg"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted" aria-label="Search">
                <Search className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}
