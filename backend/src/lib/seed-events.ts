import { prisma } from "./prisma";
import { EventSourceAdapter, EventTopic, RsvpStatus } from "@prisma/client";

const DEMO_EVENT_SOURCES = [
  {
    key: "et-premier-league",
    name: "Ethiopian Premier League fixtures",
    adapter: EventSourceAdapter.SPORTS_API,
    topic: EventTopic.SPORTS,
    config: { provider: "TheSportsDB", leagueId: "4959", apiKey: "123" },
  },
  {
    key: "century-cinema",
    name: "Century Cinema — Addis Ababa",
    adapter: EventSourceAdapter.TELEGRAM,
    topic: EventTopic.CINEMA,
    config: { channel: "Century_Cinema" },
  },
  {
    key: "intl-sport-fixtures",
    name: "International sport — every major league",
    adapter: EventSourceAdapter.SPORTS_API,
    topic: EventTopic.SPORTS,
    // Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League,
    // Europa League and the NBA, refreshed on every sync. ESPN carries whole
    // matchweeks, so the sports page has a real schedule to show.
    config: { preset: "international", provider: "ESPN" },
  },
  {
    key: "ai-events-desk",
    name: "AI events desk — Addis & world sport",
    adapter: EventSourceAdapter.GEMINI,
    topic: EventTopic.OTHER,
    // Paused by default: the AI desk can surface events no feed carries, but an
    // admin should switch it on and read the first results before trusting it.
    enabled: false,
    config: {
      grounded: true,
      horizonDays: 21,
      prompt:
        "International football, athletics, basketball, Formula 1 and tennis in the next three weeks, plus cinema, theatre and live music in Addis Ababa.",
    },
  },
];

/**
 * Gives the importer something to read on a fresh install. Upsert with an empty
 * update so an admin who disables or reconfigures a source keeps their changes.
 */
export async function ensureSeedEventSources(): Promise<void> {
  for (const source of DEMO_EVENT_SOURCES) {
    await prisma.eventSource.upsert({
      where: { key: source.key },
      update: {},
      create: source,
    });
  }
}

export async function ensureSeedEvents() {
  const existingCount = await prisma.event.count();
  if (existingCount > 0) return;

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) return;

  const hikingRoom = await prisma.category.findUnique({ where: { slug: "hiking-experiences" } });
  const cinemaRoom = await prisma.category.findUnique({ where: { slug: "ethiopian-cinema" } });
  const coffeeRoom = await prisma.category.findUnique({ where: { slug: "coffee-talk" } });
  const sportsRoom = await prisma.category.findUnique({ where: { slug: "sports-talk" } });

  const cinemaPlace = await prisma.place.findFirst({ where: { kind: "CINEMA" } });
  const cafePlace = await prisma.place.findFirst({ where: { kind: "CAFE" } });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const demoEvents = [
    {
      title: "Sunday Morning Highland Hike to Entoto Peak",
      slug: "sunday-morning-entoto-hike",
      description:
        "Join fellow community trail lovers for our weekly fresh air walk through the eucalyptus ridges of Entoto. We meet at 7:30 AM at the gate, hike for 2 hours, and enjoy Buna and fresh bread at the summit view. Bring water, trail shoes, and a light jacket.",
      startDate: new Date(now + 2 * DAY + 7 * 3600 * 1000),
      endDate: new Date(now + 2 * DAY + 11 * 3600 * 1000),
      location: "Entoto Mountain Park Main Trailhead, Addis Ababa",
      lat: 9.0833,
      lng: 38.7500,
      categoryId: hikingRoom?.id,
      creatorId: admin.id,
      maxAttendees: 25,
      coverUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Community Cinema Night & Director Discussion",
      slug: "community-cinema-night-addis",
      description:
        "Special community screening of classic Ethiopian cinema followed by an informal discussion over tea. Gathering 30 minutes before showtime in the lobby. Discounted group tickets arranged by Addis Gebeta members.",
      startDate: new Date(now + 4 * DAY + 17 * 3600 * 1000),
      endDate: new Date(now + 4 * DAY + 21 * 3600 * 1000),
      location: cinemaPlace ? `${cinemaPlace.name}, ${cinemaPlace.area || cinemaPlace.city}` : "Ambassador Cinema, Piassa",
      lat: cinemaPlace?.lat ?? 9.0181,
      lng: cinemaPlace?.lng ?? 38.7541,
      placeId: cinemaPlace?.id,
      categoryId: cinemaRoom?.id,
      creatorId: admin.id,
      maxAttendees: 40,
      coverUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=75",
    },
    {
      title: "Saturday Jebena Coffee Ceremony & Book Chat",
      slug: "saturday-coffee-ceremony-piassa",
      description:
        "A quiet, fragrant afternoon with freshly roasted buna, popcorn (fendisha), and recommendations from our recent book club reads. Pull up a chair and bring a book you loved this month.",
      startDate: new Date(now + 5 * DAY + 14 * 3600 * 1000),
      endDate: new Date(now + 5 * DAY + 17 * 3600 * 1000),
      location: cafePlace ? `${cafePlace.name}, ${cafePlace.area || cafePlace.city}` : "Tomoca Coffee, Piassa",
      lat: cafePlace?.lat ?? 9.0326,
      lng: cafePlace?.lng ?? 38.7522,
      placeId: cafePlace?.id,
      categoryId: coffeeRoom?.id,
      creatorId: admin.id,
      maxAttendees: 15,
      coverUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=75",
    },
  ];

  for (const item of demoEvents) {
    try {
      await prisma.event.create({
        data: {
          ...item,
          rsvps: {
            create: {
              userId: admin.id,
              status: RsvpStatus.GOING,
            },
          },
        },
      });
    } catch (e) {
      console.warn("Could not seed event:", item.slug, e);
    }
  }
}
