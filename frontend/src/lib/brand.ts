/**
 * Product identity. The platform is "አዲስ ገበታ" (Addis Gebeta) — a community hub
 * for Ethiopian stories, interests and everyday conversation.
 */
export const BRAND = {
  name: "አዲስ ገበታ",
  latin: "Addis Gebeta",
  meaning: "new table · a seat for every story",
  tagline: "አዲስ ገበታ — a new table, shared stories.",
  description:
    "አዲስ ገበታ (Addis Gebeta) is an Ethiopian community hub where every story has a seat at the table — coffee, cinema, books, trails, sport and the people who love them.",
  title: "አዲስ ገበታ · Addis Gebeta",
  domain: "addisgebeta.et",
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

const CATEGORY_TIGRINYA: Record<string, string> = {
  "coffee-talk": "ቤት ቡን",
  "sports-talk": "ስፖርት",
  "whats-new": "ሓድሽ ዜና",
  "ethiopian-cinema": "ኢትዮጵያዊ ፊልም",
  "book-reviews": "ገምጋም መጻሕፍቲ",
  "hiking-experiences": "ናይ እግሪ ጉዕዞ",
  music: "ሙዚቃ",
  "physical-exercise": "ናይ ኣካል ምንቅስቓስ",
  painting: "ስእሊ",
  travel: "ጉዕዞ",
  "life-stories": "ተመክሮ ህይወት",
};

export function categoryAmharic(slug?: string | null): string | null {
  if (!slug) return null;
  return CATEGORY_AMHARIC[slug] ?? null;
}

export function categoryOromo(slug?: string | null): string | null {
  if (!slug) return null;
  return CATEGORY_OROMO[slug] ?? null;
}

export function categoryTigrinya(slug?: string | null): string | null {
  if (!slug) return null;
  return CATEGORY_TIGRINYA[slug] ?? null;
}

export function localizedCategoryName(
  category: { slug: string; name: string },
  lang: "en" | "am" | "om" | "ti" = "en",
): string {
  if (lang === "am") return categoryAmharic(category.slug) || category.name;
  if (lang === "om") return categoryOromo(category.slug) || category.name;
  if (lang === "ti") return categoryTigrinya(category.slug) || category.name;
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

export function tigrinyaGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "ከመይ ሓዲርኩም";
  if (hour < 17) return "ከመይ ዋልኩም";
  return "ከመይ ኣምሲኹም";
}
