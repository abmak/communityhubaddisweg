import booksPhoto from "../assets/rooms/books.webp";
import cinemaPhoto from "../assets/rooms/cinema.webp";
import coffeePhoto from "../assets/rooms/coffee-talk.webp";
import exercisePhoto from "../assets/rooms/exercise.webp";
import hikingPhoto from "../assets/rooms/hiking.webp";
import musicPhoto from "../assets/rooms/music.webp";
import newsPhoto from "../assets/rooms/news.webp";
import paintingPhoto from "../assets/rooms/painting.webp";
import sportsPhoto from "../assets/rooms/sports.webp";
import travelPhoto from "../assets/rooms/travel.webp";

export interface RoomArt {
  photo: string;
  alt: string;
}

/**
 * The photograph that gives a room its face on the directory and at the top of
 * its own page. Keyed by category slug, so admin-created rooms simply fall back
 * to the tinted gradient header rather than a broken image.
 */
export const ROOM_ART: Record<string, RoomArt> = {
  "coffee-talk": {
    photo: coffeePhoto,
    alt: "A jebena coffee ceremony, cups laid out on a woven tray",
  },
  "sports-talk": {
    photo: sportsPhoto,
    alt: "The stands of Addis Ababa Stadium seen from the pitch",
  },
  "whats-new": {
    photo: newsPhoto,
    alt: "A newsstand stacked with the day's papers",
  },
  "ethiopian-cinema": {
    photo: cinemaPhoto,
    alt: "A cinema screen glowing in a darkened auditorium",
  },
  "book-reviews": {
    photo: booksPhoto,
    alt: "A shelf of well-thumbed reference books",
  },
  "hiking-experiences": {
    photo: hikingPhoto,
    alt: "The escarpment of the Simien Mountains under open sky",
  },
  music: {
    photo: musicPhoto,
    alt: "A musician playing the krar, a traditional Ethiopian lyre",
  },
  "physical-exercise": {
    photo: exercisePhoto,
    alt: "Women running in the Great Ethiopian Run",
  },
  painting: {
    photo: paintingPhoto,
    alt: "A painter working at an easel",
  },
  travel: {
    photo: travelPhoto,
    alt: "A blue boat crossing Lake Tana near Bahir Dar",
  },
};

export function roomArt(slug: string): RoomArt | null {
  return ROOM_ART[slug] ?? null;
}
