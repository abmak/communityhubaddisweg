import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedPlaces } from "./seed-places";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(days: number, hours = 0): Date {
  return new Date(Date.now() - days * DAY - hours * HOUR);
}

const photos = {
  coffee: [
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1400&q=70",
  ],
  sports: [
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1400&q=70",
  ],
  cinema: [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=1400&q=70",
  ],
  books: [
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=1400&q=70",
  ],
  hiking: [
    "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1400&q=70",
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1400&q=70",
  ],
};

interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  phone: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  bio: string;
  interests: string[];
  initials: string;
  colors: [string, string];
  cover?: string;
}

const seedUsers: SeedUser[] = [
  {
    username: "admin",
    displayName: "Amanuel Bekele",
    email: "admin@communityhub.et",
    phone: "+251911000001",
    role: "ADMIN",
    bio: "Community steward. I keep the lights on, the conversations kind, and the coffee warm.",
    interests: ["Community", "Coffee", "Product"],
    initials: "AB",
    colors: ["#0f172a", "#334155"],
    cover: photos.coffee[0],
  },
  {
    username: "selam",
    displayName: "Selam Tesfaye",
    email: "selam@communityhub.et",
    phone: "+251911000002",
    role: "USER",
    bio: "Writer, coffee enthusiast and unapologetic film lover. Usually found on a trail or in a bookshop in Addis.",
    interests: ["Ethiopian cinema", "Coffee", "Books", "Hiking"],
    initials: "ST",
    colors: ["#0f766e", "#14b8a6"],
    cover: photos.hiking[0],
  },
  {
    username: "dawit",
    displayName: "Dawit Bekele",
    email: "dawit@communityhub.et",
    phone: "+251911000003",
    role: "USER",
    bio: "Football obsessive. Weekend runner. I will argue about tactics for hours.",
    interests: ["Football", "Athletics", "Match analysis"],
    initials: "DB",
    colors: ["#1d4ed8", "#3b82f6"],
    cover: photos.sports[0],
  },
  {
    username: "hana",
    displayName: "Hana Girma",
    email: "hana@communityhub.et",
    phone: "+251911000004",
    role: "MODERATOR",
    bio: "Trail guide and sunrise chaser. I write about the mountains around Addis and beyond.",
    interests: ["Hiking", "Mountains", "Photography", "Coffee"],
    initials: "HG",
    colors: ["#15803d", "#22c55e"],
    cover: photos.hiking[1],
  },
  {
    username: "yonas",
    displayName: "Yonas Alemu",
    email: "yonas@communityhub.et",
    phone: "+251911000005",
    role: "USER",
    bio: "Film programmer and projectionist. Happiest in a dark room with a good story on screen.",
    interests: ["Ethiopian cinema", "Film festivals", "Directing"],
    initials: "YA",
    colors: ["#9f1239", "#e11d48"],
    cover: photos.cinema[0],
  },
  {
    username: "meron",
    displayName: "Meron Haile",
    email: "meron@communityhub.et",
    phone: "+251911000006",
    role: "USER",
    bio: "Reader, reviewer, and collector of quotations. Ask me for a recommendation.",
    interests: ["Books", "Poetry", "History", "Bookshops"],
    initials: "MH",
    colors: ["#7c3aed", "#a78bfa"],
    cover: photos.books[0],
  },
  {
    username: "abel",
    displayName: "Abel Tadesse",
    email: "abel@communityhub.et",
    phone: "+251911000007",
    role: "USER",
    bio: "Long-distance hiker and map nerd. Slowly walking every trail I can reach.",
    interests: ["Hiking", "Maps", "Camping", "Photography"],
    initials: "AT",
    colors: ["#b45309", "#f59e0b"],
    cover: photos.hiking[2],
  },
  {
    username: "sara",
    displayName: "Sara Mekonnen",
    email: "sara@communityhub.et",
    phone: "+251911000008",
    role: "USER",
    bio: "Book club host. Always halfway through three books at once.",
    interests: ["Books", "Book clubs", "Fiction"],
    initials: "SM",
    colors: ["#be185d", "#f472b6"],
    cover: photos.books[1],
  },
  {
    username: "kalkidan",
    displayName: "Kalkidan Assefa",
    email: "kalkidan@communityhub.et",
    phone: "+251911000009",
    role: "USER",
    bio: "Product designer curious about tech, cities and the people building them.",
    interests: ["Design", "Technology", "Cities"],
    initials: "KA",
    colors: ["#0e7490", "#06b6d4"],
    cover: photos.coffee[1],
  },
];

function avatarSvg(initials: string, colors: [string, string]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img" aria-label="${initials}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors[0]}"/>
      <stop offset="100%" stop-color="${colors[1]}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="160" fill="url(#g)"/>
  <circle cx="238" cy="82" r="96" fill="rgba(255,255,255,0.10)"/>
  <circle cx="70" cy="270" r="110" fill="rgba(0,0,0,0.08)"/>
  <text x="160" y="196" font-family="Georgia, 'Times New Roman', serif" font-size="118" fill="rgba(255,255,255,0.94)" text-anchor="middle" letter-spacing="-4">${initials}</text>
</svg>`;
}

async function clearDatabase() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.report.deleteMany(),
    prisma.media.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.verificationCode.deleteMany(),
    prisma.commentLike.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.postLike.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.movieReview.deleteMany(),
    prisma.bookReview.deleteMany(),
    prisma.movieDetail.deleteMany(),
    prisma.bookDetail.deleteMany(),
    prisma.hikeDetail.deleteMany(),
    prisma.post.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  console.log("• Clearing existing data");
  await clearDatabase();

  const uploads = path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(uploads, { recursive: true });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log("• Creating members and avatars");
  const users = [];
  for (const seed of seedUsers) {
    fs.writeFileSync(
      path.join(uploads, `seed-avatar-${seed.username}.svg`),
      avatarSvg(seed.initials, seed.colors),
    );
    const user = await prisma.user.create({
      data: {
        username: seed.username,
        displayName: seed.displayName,
        email: seed.email,
        phone: seed.phone,
        phoneVerifiedAt: ago(30),
        passwordHash,
        role: seed.role,
        bio: seed.bio,
        interests: seed.interests,
        avatarUrl: `/uploads/seed-avatar-${seed.username}.svg`,
        coverUrl: seed.cover ?? null,
        lastSeenAt: ago(0, 1),
        createdAt: ago(120),
      },
    });
    users.push(user);
  }
  const byName = new Map(users.map((user) => [user.username, user]));

  console.log("• Creating categories");
  const categorySeeds = [
    {
      slug: "coffee-talk",
      name: "Coffee Talk",
      icon: "Coffee",
      color: "#9a5b2b",
      kind: "DISCUSSION" as const,
      sortOrder: 1,
      description:
        "Everyday conversations, personal stories, small discoveries and the things that connect us. Pull up a chair.",
    },
    {
      slug: "sports-talk",
      name: "Sports Talk",
      icon: "Trophy",
      color: "#1f5f8b",
      kind: "DISCUSSION" as const,
      sortOrder: 2,
      description:
        "Football, athletics, basketball and the local and international competitions we can't stop talking about.",
    },
    {
      slug: "whats-new",
      name: "What's New",
      icon: "Sparkles",
      color: "#b57c09",
      kind: "DISCUSSION" as const,
      sortOrder: 3,
      description:
        "Trending topics, community announcements, technology, entertainment and the discoveries worth sharing.",
    },
    {
      slug: "ethiopian-cinema",
      name: "Ethiopian Cinema",
      icon: "Clapperboard",
      color: "#b3261e",
      kind: "MOVIE" as const,
      sortOrder: 4,
      description:
        "Ethiopian films, directors, actors and the scenes we keep returning to. Rate a film, recommend a favourite.",
    },
    {
      slug: "book-reviews",
      name: "Book Reviews",
      icon: "BookOpen",
      color: "#6f5b3e",
      kind: "BOOK" as const,
      sortOrder: 5,
      description:
        "What are you reading? Share reviews, ratings, quotations and the authors who changed how you see things.",
    },
    {
      slug: "hiking-experiences",
      name: "Hiking Experiences",
      icon: "Mountain",
      color: "#2f6b45",
      kind: "HIKE" as const,
      sortOrder: 6,
      description:
        "Trail stories, photographs, difficulty notes and practical advice for getting outside — near Addis and far beyond.",
    },
    {
      slug: "music",
      name: "Music",
      icon: "Music",
      color: "#7c3aed",
      kind: "DISCUSSION" as const,
      sortOrder: 7,
      description:
        "Tizita on a Sunday, azmari nights, new releases and the songs that carry a whole decade. What is on repeat for you, and who should we be listening to?",
    },
    {
      slug: "physical-exercise",
      name: "Physical Exercise",
      icon: "Dumbbell",
      color: "#0f766e",
      kind: "DISCUSSION" as const,
      sortOrder: 8,
      description:
        "Morning runs, gym routines, weekend football and the small habits that keep a body moving. Progress over perfection — share the week you actually had.",
    },
    {
      slug: "painting",
      name: "Painting",
      icon: "Palette",
      color: "#b45309",
      kind: "DISCUSSION" as const,
      sortOrder: 9,
      description:
        "Sketchbooks, murals, church art and brave first attempts. Show the work in progress as well as the finished piece — the messy middle is the interesting part.",
    },
    {
      slug: "travel",
      name: "Travel",
      icon: "Plane",
      color: "#1f5f8b",
      kind: "DISCUSSION" as const,
      sortOrder: 10,
      description:
        "Harar at dawn, the road to Bahir Dar, a weekend at Wenchi. Itineraries, budgets, packing lists and the mistakes worth sparing the next person.",
    },
    {
      slug: "life-stories",
      name: "Life Stories & Experiences",
      icon: "Heart",
      color: "#9d174d",
      kind: "DISCUSSION" as const,
      sortOrder: 11,
      description:
        "The chapters that made you: a first job, a hard year, a person you miss, a lesson learned late. Read generously, reply kindly.",
    },
  ];

  const categories = [];
  for (const seed of categorySeeds) {
    categories.push(await prisma.category.create({ data: seed }));
  }
  const byCategory = new Map(categories.map((category) => [category.slug, category]));

  console.log("• Connecting members");
  const followMatrix: Record<string, string[]> = {
    selam: ["dawit", "hana", "meron", "abel", "sara", "yonas"],
    dawit: ["selam", "hana", "yonas", "kalkidan"],
    hana: ["selam", "dawit", "abel", "meron"],
    yonas: ["selam", "meron", "dawit"],
    meron: ["selam", "sara", "hana", "yonas"],
    abel: ["selam", "hana", "kalkidan"],
    sara: ["meron", "selam", "hana"],
    kalkidan: ["selam", "dawit", "hana"],
    admin: ["selam", "hana"],
  };

  for (const [follower, following] of Object.entries(followMatrix)) {
    for (const target of following) {
      await prisma.follow.create({
        data: {
          followerId: byName.get(follower)!.id,
          followingId: byName.get(target)!.id,
          createdAt: ago(40),
        },
      });
    }
  }

  interface PostSeed {
    author: string;
    category: string;
    title?: string;
    body: string;
    daysAgo: number;
    hoursAgo?: number;
    image?: string;
    likes?: string[];
    bookmarks?: string[];
    shareCount?: number;
    viewCount?: number;
    movie?: {
      movieTitle: string;
      director?: string;
      year?: number;
      genre?: string;
      synopsis?: string;
      trailerUrl?: string;
      posterUrl?: string;
    };
    book?: {
      bookTitle: string;
      author?: string;
      genre?: string;
      synopsis?: string;
      coverUrl?: string;
    };
    hike?: {
      location: string;
      difficulty: "EASY" | "MODERATE" | "HARD" | "EXPERT";
      distanceKm?: number;
      durationHours?: number;
      tips?: string;
    };
    reviews?: Array<{ user: string; rating: number; body: string; daysAgo?: number }>;
  }

  const postSeeds: PostSeed[] = [
    {
      author: "selam",
      category: "coffee-talk",
      body: "The Ethiopian coffee ceremony is not really about coffee. It is about the twenty minutes of permission it gives everyone to sit down, stop working, and tell each other the truth. Three rounds, no phones, no hurry. What is the best cup you've had this week — and who were you sitting with?",
      daysAgo: 0,
      hoursAgo: 3,
      image: photos.coffee[0],
      likes: ["dawit", "hana", "meron", "abel", "yonas", "sara", "kalkidan"],
      bookmarks: ["dawit", "meron"],
      shareCount: 5,
      viewCount: 482,
    },
    {
      author: "dawit",
      category: "sports-talk",
      title: "That derby reminded me why we watch football",
      body: "Two goals in the last ten minutes, a keeper who refused to give up, and a stadium that sounded like one voice. Whatever your colours, nights like that are why the league matters. What was the moment you'll still be talking about on Monday?",
      daysAgo: 0,
      hoursAgo: 7,
      image: photos.sports[0],
      likes: ["selam", "yonas", "kalkidan", "abel", "hana"],
      bookmarks: ["selam"],
      shareCount: 3,
      viewCount: 610,
    },
    {
      author: "admin",
      category: "whats-new",
      title: "እንኳን ደህና መጡ · Welcome to Addis Weg 🎉",
      body: "We built this place for the conversations that do not fit in a group chat: film recommendations, half-finished book reviews, trail notes, and the kind of sports arguments that end with everyone laughing.\n\nA few small house rules: be generous, assume good faith, and report things that feel unsafe. Everything else is yours to shape. Say hello below and tell us what brought you here.",
      daysAgo: 1,
      hoursAgo: 2,
      likes: ["selam", "dawit", "hana", "meron", "yonas", "abel", "sara", "kalkidan"],
      bookmarks: ["selam", "sara"],
      shareCount: 11,
      viewCount: 1280,
    },
    {
      author: "meron",
      category: "ethiopian-cinema",
      title: "Lambadina: a quiet masterpiece about memory",
      body: "Lambadina sneaks up on you. It looks like a love story, then turns into a film about what we choose to remember and what we quietly agree to forget. The framing is patient, almost stubbornly still, and by the end those long shots feel like a form of respect.\n\nI keep thinking about the final scene. Would love to hear what everyone else took from it.",
      daysAgo: 2,
      hoursAgo: 4,
      image: photos.cinema[0],
      likes: ["selam", "yonas", "sara", "hana"],
      bookmarks: ["selam", "yonas"],
      shareCount: 2,
      viewCount: 344,
      movie: {
        movieTitle: "Lambadina",
        director: "Messay Getahun",
        year: 2015,
        genre: "Drama / Romance",
        synopsis:
          "Two strangers meet in a changing Addis Ababa and are drawn together by grief, memory and the city's disappearing corners.",
        posterUrl: photos.cinema[0],
        trailerUrl: "https://www.youtube.com/results?search_query=lambadina+ethiopian+film",
      },
      reviews: [
        { user: "selam", rating: 9, body: "The kind of film that makes you sit in the car for ten minutes afterwards." },
        { user: "yonas", rating: 8, body: "Beautifully composed. The restraint is the point." },
        { user: "hana", rating: 10, body: "I cried at the scene by the river. No notes." },
        { user: "sara", rating: 8, body: "Gentle, sad, and full of light." },
      ],
    },
    {
      author: "yonas",
      category: "ethiopian-cinema",
      title: "Difret and the courage to choose your own path",
      body: "Difret is often discussed for what it says about law and tradition, but what stays with me is the small, stubborn courage of its central character. The film never lets her become a symbol; it keeps her a person. That is harder than it looks, and it is why the story still lands a decade later.",
      daysAgo: 4,
      hoursAgo: 2,
      image: photos.cinema[1],
      likes: ["selam", "meron", "dawit"],
      bookmarks: ["meron"],
      shareCount: 4,
      viewCount: 512,
      movie: {
        movieTitle: "Difret",
        director: "Zeresenay Berhane Mehari",
        year: 2014,
        genre: "Drama",
        synopsis:
          "A young girl's abduction sets in motion a legal case that forces a community to confront an old custom.",
        posterUrl: photos.cinema[1],
      },
      reviews: [
        { user: "selam", rating: 9, body: "A necessary film, and a compassionate one." },
        { user: "meron", rating: 8, body: "The courtroom scenes are quietly devastating." },
        { user: "dawit", rating: 7, body: "Strong central performance carries the slower middle." },
      ],
    },
    {
      author: "abel",
      category: "ethiopian-cinema",
      title: "Five Ethiopian films to watch this month",
      body: "A short list for anyone building a cinema night: start with Teza if you want something that refuses easy comfort, then go lighter with Lambadina. I have added my notes on each below, and I would love to hear what should be on the next list.",
      daysAgo: 6,
      hoursAgo: 3,
      image: photos.cinema[2],
      likes: ["meron", "yonas", "selam", "sara", "hana"],
      bookmarks: ["sara"],
      shareCount: 7,
      viewCount: 730,
      movie: {
        movieTitle: "Teza",
        director: "Haile Gerima",
        year: 2008,
        genre: "Historical drama",
        synopsis:
          "An Ethiopian doctor returns home after years abroad and confronts the political violence that reshaped his country.",
        posterUrl: photos.cinema[2],
      },
      reviews: [
        { user: "yonas", rating: 10, body: "One of the great Ethiopian films. See it on the biggest screen you can." },
        { user: "meron", rating: 9, body: "Dense, poetic and worth revisiting." },
      ],
    },
    {
      author: "sara",
      category: "book-reviews",
      title: "Beneath the Lion's Gaze still haunts me",
      body: "I finished this weeks ago and I am still thinking about the family at its centre — how ordinary people try to keep ordinary routines while history pushes through their front door. The prose is unshowy, which makes the violence land harder.\n\nMy only hesitation is pacing: the middle section asks for patience. It repays you. Has anyone read Maaza Mengiste's later work?",
      daysAgo: 1,
      hoursAgo: 5,
      image: photos.books[0],
      likes: ["meron", "selam", "hana"],
      bookmarks: ["meron", "selam"],
      shareCount: 3,
      viewCount: 298,
      book: {
        bookTitle: "Beneath the Lion's Gaze",
        author: "Maaza Mengiste",
        genre: "Historical fiction",
        synopsis:
          "A family in 1970s Addis Ababa is pulled apart by revolution, loyalty and the cost of speaking up.",
        coverUrl: photos.books[0],
      },
      reviews: [
        { user: "selam", rating: 5, body: "A book I will be recommending for years." },
        { user: "meron", rating: 4, body: "Quietly devastating. The father's chapters are unforgettable." },
      ],
    },
    {
      author: "selam",
      category: "book-reviews",
      title: "The Shadow King is a chorus of forgotten voices",
      body: "Mengiste writes history as a chorus rather than a parade of generals. The women in this novel are not background; they are the mechanism by which memory survives. There is a scene with a photograph that does more work than a whole chapter of exposition.\n\nRating: 5 stars. Recommended to anyone who loved Homegoing.",
      daysAgo: 3,
      hoursAgo: 4,
      image: photos.books[1],
      likes: ["meron", "sara", "yonas", "hana"],
      bookmarks: ["meron"],
      shareCount: 4,
      viewCount: 401,
      book: {
        bookTitle: "The Shadow King",
        author: "Maaza Mengiste",
        genre: "Literary fiction",
        synopsis:
          "Ethiopian women take up arms against the Italian invasion, and a photographer tries to decide what a war should look like.",
        coverUrl: photos.books[1],
      },
      reviews: [
        { user: "meron", rating: 5, body: "Ambitious, lyrical and deeply moving." },
        { user: "sara", rating: 5, body: "The best novel I read this year." },
      ],
    },
    {
      author: "kalkidan",
      category: "book-reviews",
      title: "Reading Addis: three bookshops worth your afternoon",
      body: "I spent a slow Saturday mapping secondhand bookshops and came away with a bag I could barely carry. Sharing the route below. If you have a favourite corner shop with a dangerously good poetry shelf, add it in the comments.",
      daysAgo: 5,
      hoursAgo: 1,
      image: photos.books[2],
      likes: ["sara", "meron", "selam"],
      shareCount: 2,
      viewCount: 187,
      book: {
        bookTitle: "Oromay",
        author: "Baalu Girma",
        genre: "Historical fiction",
        synopsis:
          "A journalist is sent to cover a war and discovers that the story he is allowed to tell is not the one happening around him.",
        coverUrl: photos.books[2],
      },
      reviews: [{ user: "sara", rating: 4, body: "A classic for a reason. The ending is brutal." }],
    },
    {
      author: "hana",
      category: "hiking-experiences",
      title: "Sunrise on Mount Entoto: a beginner's trail guide",
      body: "If you have been meaning to start hiking but keep putting it off, Entoto is the friendliest beginning in Addis. I went up before dawn last Saturday and had the whole ridge to myself for about twenty minutes.\n\nThe full notes are below. Go with a friend, carry more water than you think you need, and stop for the view even if you are not tired.",
      daysAgo: 0,
      hoursAgo: 12,
      image: photos.hiking[0],
      likes: ["selam", "abel", "meron", "dawit", "kalkidan"],
      bookmarks: ["selam", "abel", "sara"],
      shareCount: 6,
      viewCount: 655,
      hike: {
        location: "Mount Entoto, Addis Ababa",
        difficulty: "EASY",
        distanceKm: 7.5,
        durationHours: 2.5,
        tips:
          "Start from the Entoto Maryam gate at around 5:45am. The path is wide and easy to follow. Bring a light layer — the wind at the top is cold even in the dry season. Coffee at the top is a must.",
      },
    },
    {
      author: "abel",
      category: "hiking-experiences",
      title: "Three days in the Simien Mountains",
      body: "Day one is all uphill and second thoughts. Day two is the reason people come back. Day three you will promise yourself you are never doing this again, then start planning the next one on the bus home.\n\nWe walked from Sankaber to Geech and back, and the ibex sightings alone justified the altitude. Full logistics and a packing list in the comments.",
      daysAgo: 2,
      hoursAgo: 8,
      image: photos.hiking[1],
      likes: ["hana", "selam", "dawit", "yonas", "sara"],
      bookmarks: ["hana", "dawit"],
      shareCount: 9,
      viewCount: 812,
      hike: {
        location: "Simien Mountains National Park, Amhara",
        difficulty: "HARD",
        distanceKm: 42,
        durationHours: 30,
        tips:
          "Book a licensed scout at the park gate and carry cash for the park fee. Altitude is real: sleep low, walk slowly, drink water. The views at Imet Gogo are worth every step.",
      },
    },
    {
      author: "yonas",
      category: "hiking-experiences",
      title: "Wenchi Crater Lake: what I wish I had known",
      body: "The lake is as green as the photos promise, but the walk down is steeper than any review prepared me for. Wear shoes with grip, not trainers you care about. There is a hot spring not far from the shore that feels like a small reward for the descent — and then you have to climb back up.",
      daysAgo: 4,
      hoursAgo: 5,
      image: photos.hiking[3],
      likes: ["hana", "abel", "meron"],
      shareCount: 2,
      viewCount: 276,
      hike: {
        location: "Wenchi Crater Lake, Oromia",
        difficulty: "MODERATE",
        distanceKm: 8,
        durationHours: 4,
        tips:
          "Go early. The descent takes about an hour and the climb back up is the hard part. Take a mule if your knees object; it is not cheating, it is common sense.",
      },
    },
    {
      author: "selam",
      category: "coffee-talk",
      body: "Question for the room: where in Addis do you go when you need two hours, a reliable plug point and absolutely no one rushing you? My usual place changed its playlist to something that sounds like a bank advertisement and I am looking for a new home.",
      daysAgo: 0,
      hoursAgo: 18,
      likes: ["kalkidan", "hana", "meron", "dawit"],
      bookmarks: ["kalkidan"],
      shareCount: 1,
      viewCount: 233,
    },
    {
      author: "dawit",
      category: "sports-talk",
      title: "Ethiopian athletes to watch this season",
      body: "The depth in the women's distance squad is genuinely absurd right now. Three athletes who could win on any given day, and a few juniors coming through who look like they have been doing this for a decade. Who am I missing?",
      daysAgo: 3,
      hoursAgo: 6,
      image: photos.sports[1],
      likes: ["selam", "hana", "abel"],
      shareCount: 3,
      viewCount: 389,
    },
    {
      author: "meron",
      category: "whats-new",
      title: "The little tech meetups happening across Addis",
      body: "There is something quietly hopeful about a room of thirty people showing half-finished projects on a Thursday night. I have been to three meetups this month and every one had a different definition of community. Shared notes below — add yours.",
      daysAgo: 2,
      hoursAgo: 10,
      likes: ["kalkidan", "selam", "dawit", "yonas"],
      shareCount: 2,
      viewCount: 264,
    },
    {
      author: "sara",
      category: "whats-new",
      title: "A reading list for the rainy season",
      body: "Rainy afternoons are for thick books and long cups of tea. I asked the book club for comfort reads and got a beautifully chaotic list: one family saga, one essay collection, one thriller nobody could put down, and one book we all disagreed about.",
      daysAgo: 6,
      hoursAgo: 9,
      likes: ["meron", "selam"],
      shareCount: 1,
      viewCount: 198,
    },
    {
      author: "dawit",
      category: "hiking-experiences",
      title: "Gheralta churches: faith, rock and silence",
      body: "You climb because the church is carved into the cliff, and then you sit inside and forget that you were ever afraid. The silence up there has a weight to it. Not a hike for everyone, and I would not do it without a guide.",
      daysAgo: 7,
      hoursAgo: 2,
      image: photos.hiking[2],
      likes: ["hana", "abel", "selam", "yonas"],
      bookmarks: ["hana"],
      shareCount: 4,
      viewCount: 456,
      hike: {
        location: "Gheralta Mountains, Tigray",
        difficulty: "EXPERT",
        distanceKm: 5.5,
        durationHours: 5,
        tips:
          "Hire a local guide — the routes are not all marked and some scrambles are exposed. Take water and a hat. The climb to Abuna Yemata Guh is short but not for anyone uneasy with heights.",
      },
    },
    {
      author: "meron",
      category: "music",
      title: "The songs that raised us",
      body: "My mother had three cassettes in the car and no interest in adding a fourth: Mahmoud Ahmed, Aster Aweke and a tizita mixtape with a hand-written label. I spent years thinking that was a limitation. Now I understand it was an education.\n\nTizita does something no other music does for me — it makes missing something feel like a place you can visit rather than a wound you carry. What is the song that takes you straight back to a room you have not stood in for years?",
      daysAgo: 0,
      hoursAgo: 5,
      likes: ["selam", "yonas", "sara", "hana", "dawit"],
      bookmarks: ["yonas", "selam"],
      shareCount: 4,
      viewCount: 318,
    },
    {
      author: "dawit",
      category: "music",
      title: "Five Ethiopian albums for a long drive",
      body: "A friend asked me for a road-trip playlist and I sent back a lecture. Passing it on, shortened: one album for the first hour while the city is still behind you, one for the mountain stretch where the radio dies, one for when everyone is asleep except the driver, one for the last thirty minutes, and one you save for the arrival.\n\nThe rule is simple — no skipping. An album is a conversation, not a shuffle.",
      daysAgo: 3,
      hoursAgo: 4,
      likes: ["selam", "meron", "abel"],
      bookmarks: ["abel"],
      shareCount: 2,
      viewCount: 205,
    },
    {
      author: "hana",
      category: "physical-exercise",
      title: "Twenty minutes before the day starts",
      body: "I used to plan ninety-minute workouts and then skip them entirely. Now the rule is twenty minutes, before coffee, no negotiation. Some days it is a jog around the block, some days it is stretching on the balcony while the kettle boils.\n\nThe strange part is that it is not really about fitness. It is about beginning the day with one thing I did not have to be persuaded into. If you have a version of this that survived longer than a month, I want to hear it.",
      daysAgo: 0,
      hoursAgo: 9,
      image: photos.sports[1],
      likes: ["selam", "dawit", "abel", "kalkidan", "sara"],
      bookmarks: ["kalkidan", "sara"],
      shareCount: 3,
      viewCount: 412,
    },
    {
      author: "kalkidan",
      category: "painting",
      title: "I started painting badly and it fixed my week",
      body: "I bought the cheapest set of gouache in the shop and gave myself permission to be terrible. Eleven weeks later the paintings are still terrible, and I have never looked forward to a Tuesday evening more.\n\nWhat changed is not the output, it is the attention. You cannot think about a deadline while you are mixing a green that refuses to be the green you wanted. Posting a photo of attempt number nine, mostly so the beginners know they are in good company.",
      daysAgo: 1,
      hoursAgo: 6,
      likes: ["meron", "selam", "hana", "sara"],
      bookmarks: ["sara"],
      shareCount: 2,
      viewCount: 264,
    },
    {
      author: "abel",
      category: "travel",
      title: "Harar in three days: the route I would take again",
      body: "Day one inside the old walls, slowly, with no plan beyond the next gate. Day two the hyena feeding at dusk and a long dinner with people I had met that morning. Day three out to the coffee farms, which I nearly skipped and would now put first.\n\nPractical notes: cash, comfortable shoes for the cobbles, and a guide who is happy to be asked questions rather than recite dates. The city rewards walking in circles.",
      daysAgo: 2,
      hoursAgo: 6,
      image: photos.hiking[2],
      likes: ["hana", "selam", "yonas", "sara", "meron"],
      bookmarks: ["hana", "selam"],
      shareCount: 6,
      viewCount: 587,
    },
    {
      author: "sara",
      category: "travel",
      title: "What the overnight bus to Bahir Dar taught me",
      body: "Book the seat on the side that faces the window at sunrise, bring a jumper even in the dry season, and do not trust the person who says the bus leaves at eight. We left at nine-forty and arrived in time for the best breakfast of the trip.\n\nThere is something clarifying about eleven hours with no wifi. I read half a book and had three conversations that would never have happened on a plane.",
      daysAgo: 5,
      hoursAgo: 2,
      likes: ["meron", "abel", "dawit"],
      shareCount: 1,
      viewCount: 176,
    },
    {
      author: "selam",
      category: "life-stories",
      title: "The year I learned to ask for help",
      body: "For a long time I thought being dependable meant never needing anything. Then a bad year arrived — the kind that does not announce itself — and I discovered that everyone I had been quietly helping was waiting for a chance to help back.\n\nAsking is still hard. But I have stopped treating it as a failure of character. It turns out people like being useful; it is one of the kindest things you can let them be. If you are in the middle of a year like that, this is your sign to send the message.",
      daysAgo: 0,
      hoursAgo: 14,
      likes: ["meron", "hana", "sara", "kalkidan", "dawit", "yonas", "abel"],
      bookmarks: ["sara", "kalkidan"],
      shareCount: 8,
      viewCount: 702,
    },
    {
      author: "meron",
      category: "life-stories",
      title: "My grandmother wrote her recipes in the margins",
      body: "When we cleared the house we found her cookbook: a printed collection of recipes with almost none of her own cooking in it, and every margin full of corrections. Less salt. Twice the berbere. Ask Almaz about the onions.\n\nIt is the most honest thing she left us. Not a finished book — an argument with one, in her handwriting. I have started writing in my own margins now, mostly so there is something to argue with later.",
      daysAgo: 4,
      hoursAgo: 3,
      likes: ["selam", "sara", "hana", "kalkidan", "yonas"],
      bookmarks: ["selam", "sara"],
      shareCount: 5,
      viewCount: 431,
    },
    {
      author: "kalkidan",
      category: "whats-new",
      title: "CHEAP PHONE SALE!!! DM FOR PRICE",
      body: "Latest phones, unbeatable prices, limited stock. Message me now now now. Only serious buyers.",
      daysAgo: 0,
      hoursAgo: 1,
      likes: ["dawit"],
      shareCount: 0,
      viewCount: 42,
    },
  ];

  console.log("• Publishing posts, images, reactions and reviews");
  const createdPosts: Array<{ id: string; seed: PostSeed }> = [];

  for (const seed of postSeeds) {
    const author = byName.get(seed.author)!;
    const category = byCategory.get(seed.category)!;
    const createdAt = ago(seed.daysAgo, seed.hoursAgo ?? 0);

    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        categoryId: category.id,
        title: seed.title ?? null,
        body: seed.body,
        createdAt,
        updatedAt: createdAt,
        shareCount: seed.shareCount ?? 0,
        viewCount: seed.viewCount ?? 0,
        ...(seed.image
          ? {
              media: {
                create: {
                  ownerId: author.id,
                  kind: "IMAGE",
                  url: seed.image,
                  thumbnailUrl: seed.image,
                  mimeType: "image/jpeg",
                  sizeBytes: 0,
                  width: 1400,
                  height: 933,
                  createdAt,
                },
              },
            }
          : {}),
        ...(seed.movie ? { movie: { create: seed.movie } } : {}),
        ...(seed.book ? { book: { create: seed.book } } : {}),
        ...(seed.hike ? { hike: { create: seed.hike } } : {}),
      },
    });

    const likers = (seed.likes ?? []).map((username) => byName.get(username)!).filter(Boolean);
    if (likers.length > 0) {
      await prisma.postLike.createMany({
        data: likers.map((user) => ({ postId: post.id, userId: user.id, createdAt })),
      });
    }

    const bookmarkers = (seed.bookmarks ?? []).map((username) => byName.get(username)!).filter(Boolean);
    if (bookmarkers.length > 0) {
      await prisma.bookmark.createMany({
        data: bookmarkers.map((user) => ({ postId: post.id, userId: user.id, createdAt })),
      });
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        likeCount: likers.length,
        bookmarkCount: bookmarkers.length,
      },
    });

    if (seed.reviews && seed.category === "ethiopian-cinema") {
      for (const review of seed.reviews) {
        await prisma.movieReview.create({
          data: {
            postId: post.id,
            userId: byName.get(review.user)!.id,
            rating: review.rating,
            body: review.body,
            createdAt: ago(review.daysAgo ?? seed.daysAgo, 1),
          },
        });
      }
    }
    if (seed.reviews && seed.category === "book-reviews") {
      for (const review of seed.reviews) {
        await prisma.bookReview.create({
          data: {
            postId: post.id,
            userId: byName.get(review.user)!.id,
            rating: review.rating,
            body: review.body,
            createdAt: ago(review.daysAgo ?? seed.daysAgo, 1),
          },
        });
      }
    }

    createdPosts.push({ id: post.id, seed });
  }

  const postByTitle = new Map(
    createdPosts.map((post) => [post.seed.title ?? post.seed.body, post.id]),
  );

  console.log("• Adding conversations in the comments");

  interface CommentSeed {
    post: string;
    author: string;
    body: string;
    daysAgo: number;
    hoursAgo?: number;
    likes?: string[];
    replies?: Array<{ author: string; body: string; daysAgo: number; hoursAgo?: number; likes?: string[] }>;
  }

  const commentSeeds: CommentSeed[] = [
    {
      post: "The Ethiopian coffee ceremony is not really about coffee.",
      author: "hana",
      body: "This is exactly it. The ceremony is the only part of my week where nobody expects me to be productive. Best cup this week: a small place near Piassa with my aunt.",
      daysAgo: 0,
      hoursAgo: 2,
      likes: ["selam", "meron", "dawit"],
      replies: [
        {
          author: "selam",
          body: "Piassa with an aunt is a whole genre of afternoon. Adding it to my list.",
          daysAgo: 0,
          hoursAgo: 1,
          likes: ["hana"],
        },
        {
          author: "meron",
          body: "The no-phones rule is the real luxury.",
          daysAgo: 0,
          hoursAgo: 1,
        },
      ],
    },
    {
      post: "The Ethiopian coffee ceremony is not really about coffee.",
      author: "dawit",
      body: "Mine was at home after the derby, still arguing about the offside call. Coffee tasted better because we won.",
      daysAgo: 0,
      hoursAgo: 1,
      likes: ["selam", "yonas"],
    },
    {
      post: "Lambadina: a quiet masterpiece about memory",
      author: "yonas",
      body: "That final scene is doing so much with so little. The camera refuses to cut away, and that refusal is the whole film in miniature.",
      daysAgo: 2,
      hoursAgo: 3,
      likes: ["meron", "selam", "sara"],
      replies: [
        {
          author: "meron",
          body: "Yes — and the sound design. You can hear the city even when the frame is almost empty.",
          daysAgo: 2,
          hoursAgo: 2,
          likes: ["yonas"],
        },
      ],
    },
    {
      post: "Sunrise on Mount Entoto: a beginner's trail guide",
      author: "selam",
      body: "This is the push I needed. Is the path clear enough to go solo around 6am, or better to find a group?",
      daysAgo: 0,
      hoursAgo: 9,
      likes: ["hana"],
      replies: [
        {
          author: "hana",
          body: "Solo is fine on the main path, but the first part is quiet — go with someone if you can. There is a group that leaves from the gate most Saturdays.",
          daysAgo: 0,
          hoursAgo: 8,
          likes: ["selam", "abel"],
        },
        {
          author: "abel",
          body: "Second the Saturday group. They are friendly and they know the shortcuts.",
          daysAgo: 0,
          hoursAgo: 7,
        },
      ],
    },
    {
      post: "Difret and the courage to choose your own path",
      author: "meron",
      body: "The film trusts the audience to sit with discomfort instead of explaining it. That is rare.",
      daysAgo: 4,
      hoursAgo: 2,
      likes: ["yonas", "selam"],
    },
    {
      post: "እንኳን ደህና መጡ · Welcome to Addis Weg 🎉",
      author: "selam",
      body: "Hello! I came for the film recommendations and stayed for the trail notes. Glad to be here.",
      daysAgo: 1,
      hoursAgo: 1,
      likes: ["admin", "hana", "meron"],
    },
    {
      post: "እንኳን ደህና መጡ · Welcome to Addis Weg 🎉",
      author: "kalkidan",
      body: "Here for the design and tech conversations. Also happy to help anyone who wants to talk about making this place more accessible.",
      daysAgo: 1,
      hoursAgo: 1,
      likes: ["admin", "selam"],
    },
    {
      post: "Beneath the Lion's Gaze still haunts me",
      author: "selam",
      body: "The pacing is deliberate, I think — it makes you feel the years passing inside the house. Her later novel is even better.",
      daysAgo: 1,
      hoursAgo: 4,
      likes: ["sara", "meron"],
    },
    {
      post: "Three days in the Simien Mountains",
      author: "hana",
      body: "The ibex at Geech are almost suspiciously calm. Also, your point about going slowly is underrated advice.",
      daysAgo: 2,
      hoursAgo: 4,
      likes: ["abel"],
    },
    {
      post: "The songs that raised us",
      author: "yonas",
      body: "Tizita is the only kind of music where missing someone counts as a form of company. Three cassettes in a car is a complete curriculum, honestly.",
      daysAgo: 0,
      hoursAgo: 4,
      likes: ["meron", "selam"],
      replies: [
        {
          author: "meron",
          body: "“A complete curriculum” — I am stealing that.",
          daysAgo: 0,
          hoursAgo: 3,
          likes: ["yonas"],
        },
      ],
    },
    {
      post: "Five Ethiopian albums for a long drive",
      author: "abel",
      body: "The no-skipping rule is the whole point. We did the Addis–Bahir Dar road with one album on repeat and I still cannot hear the third track without seeing that first view of the lake.",
      daysAgo: 3,
      hoursAgo: 2,
      likes: ["dawit"],
    },
    {
      post: "Twenty minutes before the day starts",
      author: "kalkidan",
      body: "The “one thing I did not have to be persuaded into” framing is the useful bit. I have been treating exercise as a debt I owe myself; this makes it feel like a way of starting.",
      daysAgo: 0,
      hoursAgo: 6,
      likes: ["hana", "sara"],
    },
    {
      post: "I started painting badly and it fixed my week",
      author: "sara",
      body: "Attempt number nine is better than you think it is. Also, “a green that refuses to be the green you wanted” is a whole philosophy.",
      daysAgo: 1,
      hoursAgo: 4,
      likes: ["kalkidan", "meron"],
    },
    {
      post: "The year I learned to ask for help",
      author: "hana",
      body: "This one stayed with me all day. I am the person who offers help and then apologises for needing it. Sending the message tonight.",
      daysAgo: 0,
      hoursAgo: 10,
      likes: ["selam", "meron", "sara"],
      replies: [
        {
          author: "selam",
          body: "Tell me how it goes. I suspect the reply will be kinder than the scenario you have been rehearsing.",
          daysAgo: 0,
          hoursAgo: 8,
          likes: ["hana"],
        },
      ],
    },
    {
      post: "CHEAP PHONE SALE!!! DM FOR PRICE",
      author: "dawit",
      body: "This is a scam. Please report it.",
      daysAgo: 0,
      hoursAgo: 1,
      likes: ["selam", "hana", "kalkidan"],
    },
  ];

  for (const seed of commentSeeds) {
    const postId = postByTitle.get(seed.post);
    if (!postId) continue;
    const createdAt = ago(seed.daysAgo, seed.hoursAgo ?? 0);
    const comment = await prisma.comment.create({
      data: {
        postId,
        authorId: byName.get(seed.author)!.id,
        body: seed.body,
        createdAt,
        updatedAt: createdAt,
      },
    });
    await prisma.comment.update({
      where: { id: comment.id },
      data: { likeCount: seed.likes?.length ?? 0 },
    });
    if (seed.likes?.length) {
      await prisma.commentLike.createMany({
        data: seed.likes.map((username) => ({
          commentId: comment.id,
          userId: byName.get(username)!.id,
          createdAt,
        })),
      });
    }
    await prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

    for (const reply of seed.replies ?? []) {
      const replyAt = ago(reply.daysAgo, reply.hoursAgo ?? 0);
      const child = await prisma.comment.create({
        data: {
          postId,
          authorId: byName.get(reply.author)!.id,
          parentId: comment.id,
          body: reply.body,
          createdAt: replyAt,
          updatedAt: replyAt,
          likeCount: reply.likes?.length ?? 0,
        },
      });
      if (reply.likes?.length) {
        await prisma.commentLike.createMany({
          data: reply.likes.map((username) => ({
            commentId: child.id,
            userId: byName.get(username)!.id,
            createdAt: replyAt,
          })),
        });
      }
      await prisma.comment.update({
        where: { id: comment.id },
        data: { replyCount: { increment: 1 } },
      });
      await prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
    }
  }

  console.log("• Seeding private conversations");
  interface MessageSeed {
    from: string;
    body: string;
    minutesAgo: number;
    read: boolean;
  }

  async function seedConversation(a: string, b: string, messageSeeds: MessageSeed[]) {
    const first = byName.get(a)!;
    const second = byName.get(b)!;
    const [user1Id, user2Id] = first.id < second.id ? [first.id, second.id] : [second.id, first.id];
    const conversation = await prisma.conversation.create({
      data: {
        user1Id,
        user2Id,
        createdAt: ago(10),
        lastMessageAt: ago(0, 0),
      },
    });

    for (const message of messageSeeds) {
      const createdAt = new Date(Date.now() - message.minutesAgo * 60 * 1000);
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: byName.get(message.from)!.id,
          body: message.body,
          createdAt,
          readAt: message.read ? new Date(createdAt.getTime() + 4 * 60 * 1000) : null,
        },
      });
    }

    const last = await prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: last.createdAt },
      });
    }
    return conversation;
  }

  const selamDawit = await seedConversation("selam", "dawit", [
    { from: "dawit", body: "Selam! Did you catch the derby last night?", minutesAgo: 180, read: true },
    { from: "selam", body: "I did — that second goal was unreal. ⚽", minutesAgo: 175, read: true },
    { from: "dawit", body: "We should do a match-day thread next week.", minutesAgo: 170, read: true },
    { from: "selam", body: "Yes! I'll bring the coffee. ☕", minutesAgo: 160, read: true },
    {
      from: "dawit",
      body: "Deal. Also — have you seen Lambadina? Planning a cinema night.",
      minutesAgo: 25,
      read: false,
    },
  ]);

  await seedConversation("selam", "hana", [
    {
      from: "hana",
      body: "The Entoto trail is gorgeous at sunrise. Sending you photos tomorrow.",
      minutesAgo: 60 * 24,
      read: true,
    },
    { from: "selam", body: "Please do! I need a beginner-friendly route.", minutesAgo: 60 * 23, read: true },
    { from: "hana", body: "I'll write a trail guide post tonight.", minutesAgo: 60 * 22, read: true },
  ]);

  await seedConversation("selam", "meron", [
    {
      from: "meron",
      body: "That Maaza Mengiste review you wrote was wonderful.",
      minutesAgo: 120,
      read: false,
    },
  ]);

  await seedConversation("dawit", "yonas", [
    { from: "yonas", body: "I have two tickets for the film festival on Saturday.", minutesAgo: 300, read: true },
    { from: "dawit", body: "Take me with you.", minutesAgo: 290, read: true },
  ]);

  console.log("• Creating notifications and reports");
  const welcomePostId = postByTitle.get("እንኳን ደህና መጡ · Welcome to Addis Weg 🎉")!;
  const coffeePostId = postByTitle.get("The Ethiopian coffee ceremony is not really about coffee.")!;
  const spamPostId = postByTitle.get("CHEAP PHONE SALE!!! DM FOR PRICE")!;
  const spamComment = await prisma.comment.findFirst({ where: { postId: spamPostId }, select: { id: true } });

  const notifications = [
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("hana")!.id,
      type: "POST_LIKE" as const,
      body: "liked your post.",
      postId: coffeePostId,
      createdAt: ago(0, 2),
      readAt: null,
    },
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("dawit")!.id,
      type: "COMMENT" as const,
      body: "commented on your post.",
      postId: coffeePostId,
      createdAt: ago(0, 1),
      readAt: null,
    },
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("meron")!.id,
      type: "FOLLOW" as const,
      body: "started following you.",
      createdAt: ago(0, 5),
      readAt: null,
    },
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("dawit")!.id,
      type: "MESSAGE" as const,
      body: "sent you a message: “Deal. Also — have you seen Lambadina?…”",
      conversationId: selamDawit.id,
      createdAt: ago(0, 0),
      readAt: null,
    },
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("admin")!.id,
      type: "ANNOUNCEMENT" as const,
      body: "እንኳን ደህና መጡ · Welcome to Addis Weg 🎉",
      postId: welcomePostId,
      createdAt: ago(1, 2),
      readAt: ago(1, 0),
    },
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("yonas")!.id,
      type: "MOVIE_REVIEW" as const,
      body: "rated “Lambadina” 8/10.",
      postId: postByTitle.get("Lambadina: a quiet masterpiece about memory")!,
      createdAt: ago(2, 2),
      readAt: ago(2, 0),
    },
    {
      userId: byName.get("selam")!.id,
      actorId: byName.get("sara")!.id,
      type: "BOOK_REVIEW" as const,
      body: "reviewed “Beneath the Lion's Gaze”.",
      postId: postByTitle.get("Beneath the Lion's Gaze still haunts me")!,
      createdAt: ago(1, 3),
      readAt: null,
    },
  ];

  await prisma.notification.createMany({ data: notifications });

  await prisma.report.create({
    data: {
      reporterId: byName.get("dawit")!.id,
      targetType: "POST",
      targetId: spamPostId,
      reason: "SPAM",
      details: "Promotional spam with no connection to the community.",
      status: "OPEN",
      createdAt: ago(0, 1),
    },
  });

  if (spamComment) {
    await prisma.report.create({
      data: {
        reporterId: byName.get("selam")!.id,
        targetType: "COMMENT",
        targetId: spamComment.id,
        reason: "SPAM",
        details: "Reported alongside the post for promotional spam.",
        status: "OPEN",
        createdAt: ago(0, 1),
      },
    });
  }

  await seedPlaces(prisma);

  const counts = {
    places: await prisma.place.count(),
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    conversations: await prisma.conversation.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("\n✓ Seed complete");
  console.log(counts);
  console.log(`\nDemo sign-in: selam@communityhub.et / ${DEMO_PASSWORD}`);
  console.log(`Admin sign-in: admin@communityhub.et / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
