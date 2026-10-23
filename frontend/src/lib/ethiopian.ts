/**
 * Ethiopian (Ge'ez) calendar conversion.
 *
 * The Ethiopian calendar has twelve 30-day months plus ጳጉሜን (Pagume), and it
 * runs roughly seven to eight years behind the Gregorian calendar. Conversion
 * goes through the Julian Day Number so leap years fall out automatically.
 */

export type CalendarMode = "GREGORIAN" | "ETHIOPIAN";

export const ETHIOPIAN_MONTHS = [
  { am: "መስከረም", en: "Meskerem" },
  { am: "ጥቅምት", en: "Tikimt" },
  { am: "ኅዳር", en: "Hidar" },
  { am: "ታኅሣሥ", en: "Tahsas" },
  { am: "ጥር", en: "Tir" },
  { am: "የካቲት", en: "Yekatit" },
  { am: "መጋቢት", en: "Megabit" },
  { am: "ሚያዝያ", en: "Miazia" },
  { am: "ግንቦት", en: "Ginbot" },
  { am: "ሰኔ", en: "Sene" },
  { am: "ሐምሌ", en: "Hamle" },
  { am: "ነሐሴ", en: "Nehase" },
  { am: "ጳጉሜን", en: "Pagume" },
] as const;

/** Julian Day Number of 1 Meskerem 1 E.C. (Amete Mihret). */
const ETHIOPIAN_EPOCH_JDN = 1723856;

export interface EthiopianDate {
  year: number;
  /** 1–13 */
  month: number;
  /** 1–30 (1–6 in ጳጉሜን) */
  day: number;
  monthAmharic: string;
  monthEnglish: string;
}

function mod(value: number, base: number): number {
  return value - base * Math.floor(value / base);
}

function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** Converts a Gregorian instant to its Ethiopian calendar date in local time. */
export function toEthiopianDate(value: string | Date): EthiopianDate {
  const date = typeof value === "string" ? new Date(value) : value;
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const offset = jdn - ETHIOPIAN_EPOCH_JDN;
  const r = mod(offset, 1461);
  const n = mod(r, 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor(offset / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.min(13, Math.floor(n / 30) + 1);
  const day = mod(n, 30) + 1;
  const names = ETHIOPIAN_MONTHS[month - 1];

  return {
    year,
    month,
    day,
    monthAmharic: names.am,
    monthEnglish: names.en,
  };
}

/** "ጥቅምት 13, 2019" — the era suffix is added by the caller where it fits. */
export function formatEthiopianDate(value: string | Date): string {
  const eth = toEthiopianDate(value);
  return `${eth.monthAmharic} ${eth.day}, ${eth.year}`;
}

/** "ጥቅምት 2019" */
export function formatEthiopianMonthYear(value: string | Date): string {
  const eth = toEthiopianDate(value);
  return `${eth.monthAmharic} ${eth.year}`;
}

/** "ጥቅምት 13, 2019 ዓ.ም." */
export function formatEthiopianDateEra(value: string | Date): string {
  return `${formatEthiopianDate(value)} ዓ.ም.`;
}
