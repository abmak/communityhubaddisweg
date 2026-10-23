/**
 * Product identity. The platform is "አዲስ ወግ" (Addis Weg) — a community hub for
 * Ethiopian stories, interests and everyday conversation.
 */
export const BRAND = {
  name: "አዲስ ወግ",
  latin: "Addis Weg",
  meaning: "new way · shared table",
  tagline: "አዲስ ወግ — a new way, shared stories.",
  description:
    "አዲስ ወግ (Addis Weg) is an Ethiopian community hub where every story has a seat at the table — coffee, cinema, books, trails, sport and the people who love them.",
  title: "አዲስ ወግ · Addis Weg",
  domain: "addisweg.et",
} as const;

/**
 * Amharic room names for the seeded categories. Administrators can add more
 * categories at runtime; unknown slugs simply fall back to the English name.
 */
const CATEGORY_AMHARIC: Record<string, string> = {
  "coffee-talk": "ቡና ቤት",
  "sports-talk": "ስፖርት",
  "whats-new": "አዲስ ዜና",
  "ethiopian-cinema": "የኢትዮጵያ ፊልም",
  "book-reviews": "የመጽሐፍ ግምገማ",
  "hiking-experiences": "የእግር ጉዞ",
  music: "ሙዚቃ",
  "physical-exercise": "የአካል እንቅስቃሴ",
  painting: "ሥዕል",
  travel: "ጉዞ",
  "life-stories": "የሕይወት ተሞክሮ",
};

const CATEGORY_OROMO: Record<string, string> = {
  "coffee-talk": "Mana Bunaa",
  "sports-talk": "Ispoortii",
  "whats-new": "Oduu Haaraa",
  "ethiopian-cinema": "Fiilmii Itoophiyaa",
  "book-reviews": "Gamaaggama Kitaabaa",
  "hiking-experiences": "Imala Gaaraa",
  music: "Muuziqaa",
  "physical-exercise": "Sochii Qaamaa",
  painting: "Fakkii / Aartii",
  travel: "Imala",
  "life-stories": "Muuxannoo Jireenyaa",
};

export function categoryAmharic(slug?: string | null): string | null {
  if (!slug) return null;
  return CATEGORY_AMHARIC[slug] ?? null;
}

export function categoryOromo(slug?: string | null): string | null {
  if (!slug) return null;
  return CATEGORY_OROMO[slug] ?? null;
}

export function localizedCategoryName(
  category: { slug: string; name: string },
  lang: "en" | "am" | "om" = "en",
): string {
  if (lang === "am") return categoryAmharic(category.slug) || category.name;
  if (lang === "om") return categoryOromo(category.slug) || category.name;
  return category.name;
}

/** Ethiopian-flavoured greetings used on the feed. */
export function amharicGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "እንደምን አደሩ";
  if (hour < 17) return "እንደምን ዋሉ";
  return "እንደምን አመሹ";
}

export function oromoGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Akkam bultan";
  if (hour < 17) return "Akkam ooltan";
  return "Akkam bultan";
}
