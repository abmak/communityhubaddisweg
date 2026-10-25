import {
  BedDouble,
  BookMarked,
  Clapperboard,
  Coffee,
  Dumbbell,
  Frame,
  Fuel,
  Hospital,
  MapPin,
  Mountain,
  Pill,
  School,
  Theater,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Place, PlaceKind } from "../types";
// Kind photography keeps the directory feeling like a magazine, not a table.
// Every file is CC-licensed or public domain; credits live in README.md.
// Cinema, hiking, café and stadium reuse the credited room tiles so there is one source of truth.
import cafePhoto from "../assets/rooms/coffee-talk.webp";
import libraryPhoto from "../assets/rooms/books.webp";
import cinemaPhoto from "../assets/rooms/cinema.webp";
import hikingPhoto from "../assets/rooms/hiking.webp";
import sportsPhoto from "../assets/rooms/sports.webp";
import hotelPhoto from "../assets/places/hotel.webp";
import restaurantPhoto from "../assets/places/restaurant.webp";
import theatrePhoto from "../assets/places/theatre.webp";
import gymPhoto from "../assets/places/gym.webp";
import galleryPhoto from "../assets/places/gallery.webp";

interface KindMeta {
  label: string;
  /** Plural used in copy like "All gyms" — irregular forms set this explicitly. */
  plural?: string;
  am: string;
  icon: LucideIcon;
  wash: string;
  text: string;
  iconTone: string;
  /** Kind photography; null for service kinds, which use a gradient tile. */
  photo: string | null;
  photoAlt: string;
  /** Tailwind gradient for kinds without a photograph. */
  tile?: string;
}

export const KIND_META: Record<PlaceKind, KindMeta> = {
  CINEMA: {
    label: "Cinema",
    am: "ሲኒማ",
    icon: Clapperboard,
    wash: "from-rose-500/15 via-accent-400/10 to-transparent",
    text: "text-rose-700 dark:text-rose-300",
    iconTone: "text-rose-600 dark:text-rose-300",
    photo: cinemaPhoto,
    photoAlt: "Rows of seats facing a cinema screen",
  },
  THEATRE: {
    label: "Theatre",
    am: "ቲያትር",
    icon: Theater,
    wash: "from-violet-500/15 via-fuchsia-400/10 to-transparent",
    text: "text-violet-700 dark:text-violet-300",
    iconTone: "text-violet-600 dark:text-violet-300",
    photo: theatrePhoto,
    photoAlt: "Performers lit by stage lights under a theatre rig",
  },
  HOTEL: {
    label: "Hotel",
    am: "ሆቴል",
    icon: BedDouble,
    wash: "from-sky-500/15 via-brand-400/10 to-transparent",
    text: "text-sky-700 dark:text-sky-300",
    iconTone: "text-sky-600 dark:text-sky-300",
    photo: hotelPhoto,
    photoAlt: "The terracotta towers of a large Addis Ababa hotel",
  },
  HIKING: {
    label: "Hiking",
    am: "የእግር ጉዞ",
    icon: Mountain,
    wash: "from-emerald-500/15 via-brand-400/10 to-transparent",
    text: "text-emerald-700 dark:text-emerald-300",
    iconTone: "text-emerald-600 dark:text-emerald-300",
    photo: hikingPhoto,
    photoAlt: "Highland escarpment and trails in the Simien Mountains",
  },
  CAFE: {
    label: "Café",
    am: "ካፌ",
    icon: Coffee,
    wash: "from-amber-500/20 via-coffee-300/10 to-transparent",
    text: "text-coffee-700 dark:text-amber-300",
    iconTone: "text-coffee-600 dark:text-amber-300",
    photo: cafePhoto,
    photoAlt: "Ethiopian coffee ceremony — jebena poured into small cups",
  },
  RESTAURANT: {
    label: "Restaurant",
    am: "ምግብ ቤት",
    icon: UtensilsCrossed,
    wash: "from-orange-500/15 via-rose-400/10 to-transparent",
    text: "text-orange-700 dark:text-orange-300",
    iconTone: "text-orange-600 dark:text-orange-300",
    photo: restaurantPhoto,
    photoAlt: "Injera platter with a colourful vegetarian combination",
  },
  GYM: {
    label: "Gym",
    plural: "gyms",
    am: "ጂም",
    icon: Dumbbell,
    wash: "from-lime-500/15 via-emerald-400/10 to-transparent",
    text: "text-lime-700 dark:text-lime-300",
    iconTone: "text-lime-600 dark:text-lime-300",
    photo: gymPhoto,
    photoAlt: "Cable and rowing machines on a gym floor",
  },
  STADIUM: {
    label: "Stadium",
    plural: "stadiums",
    am: "ስታዲየም",
    icon: Trophy,
    wash: "from-teal-500/15 via-brand-400/10 to-transparent",
    text: "text-teal-700 dark:text-teal-300",
    iconTone: "text-teal-600 dark:text-teal-300",
    photo: sportsPhoto,
    photoAlt: "Addis Ababa Stadium seen from the stands",
  },
  GALLERY: {
    label: "Gallery",
    plural: "galleries",
    am: "ጋለሪ",
    icon: Frame,
    wash: "from-fuchsia-500/15 via-violet-400/10 to-transparent",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    iconTone: "text-fuchsia-600 dark:text-fuchsia-300",
    photo: galleryPhoto,
    photoAlt: "Visitors viewing a colourful painting at an exhibition",
  },
  LIBRARY: {
    label: "Library",
    plural: "libraries",
    am: "ቤተ መጻሕፍት",
    icon: BookMarked,
    wash: "from-brand-500/15 via-accent-400/10 to-transparent",
    text: "text-brand-700 dark:text-brand-300",
    iconTone: "text-brand-600 dark:text-brand-300",
    photo: libraryPhoto,
    photoAlt: "Shelves and reading light in a quiet library",
  },
  // Everyday services: the list is used for errands, not only for nights out.
  HOSPITAL: {
    label: "Hospital",
    plural: "hospitals",
    am: "ሆስፒታል",
    icon: Hospital,
    wash: "from-red-500/15 via-rose-400/10 to-transparent",
    text: "text-red-700 dark:text-red-300",
    iconTone: "text-red-600 dark:text-red-300",
    photo: null,
    photoAlt: "Hospital",
    tile: "from-red-600 via-rose-700 to-brand-950",
  },
  PHARMACY: {
    label: "Pharmacy",
    plural: "pharmacies",
    am: "ፋርማሲ",
    icon: Pill,
    wash: "from-emerald-500/15 via-teal-400/10 to-transparent",
    text: "text-emerald-700 dark:text-emerald-300",
    iconTone: "text-emerald-600 dark:text-emerald-300",
    photo: null,
    photoAlt: "Pharmacy",
    tile: "from-emerald-600 via-teal-700 to-brand-950",
  },
  GAS_STATION: {
    label: "Fuel station",
    plural: "fuel stations",
    am: "የነዳጅ ማደያ",
    icon: Fuel,
    wash: "from-amber-500/20 via-orange-400/10 to-transparent",
    text: "text-amber-700 dark:text-amber-300",
    iconTone: "text-amber-600 dark:text-amber-300",
    photo: null,
    photoAlt: "Fuel station",
    tile: "from-amber-500 via-orange-600 to-brand-950",
  },
  SCHOOL: {
    label: "School",
    plural: "schools",
    am: "ትምህርት ቤት",
    icon: School,
    wash: "from-sky-500/15 via-indigo-400/10 to-transparent",
    text: "text-sky-700 dark:text-sky-300",
    iconTone: "text-sky-600 dark:text-sky-300",
    photo: null,
    photoAlt: "School",
    tile: "from-sky-600 via-indigo-700 to-brand-950",
  },
};

export const PLACE_KINDS = Object.keys(KIND_META) as PlaceKind[];

/**
 * Bridges an online room to the real places worth visiting for it. The key is
 * the category slug, so admins creating new rooms simply get no bridge until
 * one is added here.
 */
export const ROOM_PLACE_KIND: Record<string, PlaceKind> = {
  "coffee-talk": "CAFE",
  "whats-new": "CAFE",
  "ethiopian-cinema": "CINEMA",
  "book-reviews": "LIBRARY",
  "hiking-experiences": "HIKING",
  music: "THEATRE",
  "physical-exercise": "GYM",
  "sports-talk": "STADIUM",
  painting: "GALLERY",
  travel: "HOTEL",
  "life-stories": "RESTAURANT",
};

/** Short, room-specific reason the linked places belong to this conversation. */
export const ROOM_PLACE_COPY: Record<string, string> = {
  "coffee-talk": "Cafés where the conversation runs long and nobody rushes the second round.",
  "whats-new": "Cafés that still print the paper and argue about it over a macchiato.",
  "ethiopian-cinema": "Screens around the city showing something worth sitting in the dark for.",
  "book-reviews": "Libraries and reading rooms where the shelves do the browsing for you.",
  "hiking-experiences": "Trailheads a morning's drive from the city — boots on, phone away.",
  music: "Stages and halls where the music is best heard without a screen in between.",
  "physical-exercise": "Gyms, tracks and clubs for the days a hill walk isn't the plan.",
  "sports-talk": "Stadiums where the whole city stands up at the same moment.",
  painting: "Galleries where the work hangs at full size, in daylight, with nobody scrolling past it.",
  travel: "Beds worth booking before the weekend disappears.",
  "life-stories": "Tables where the long stories get told, usually over a shared platter.",
};

export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function mapsHref(place: Pick<Place, "lat" | "lng"> | { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}

export function directionsHref(place: Place): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
}

export function placePath(place: Pick<Place, "slug">): string {
  return `/places/${place.slug}`;
}

export const PLACES_ICON = MapPin;
